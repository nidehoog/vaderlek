/* Pure calculations shared by the influencer UI and Node tests. */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  function solarPosition(ms, lat, lon) {
    const days = ms / 86400000 - 10957.5;
    const g = (357.529 + .98560028 * days) * RAD;
    const q = (280.459 + .98564736 * days) * RAD;
    const lambda = q + (1.915 * Math.sin(g) + .020 * Math.sin(2 * g)) * RAD;
    const tilt = (23.439 - .00000036 * days) * RAD;
    const dec = Math.asin(Math.sin(tilt) * Math.sin(lambda));
    const ra = Math.atan2(Math.cos(tilt) * Math.sin(lambda), Math.cos(lambda));
    const h = (280.46061837 + 360.98564736629 * (ms / 86400000 + 2440587.5 - 2451545) + lon) * RAD - ra;
    const phi = lat * RAD;
    return {
      altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)) / RAD,
      azimuth: (Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360
    };
  }
  function dateKey(ms, tz) {
    return new Intl.DateTimeFormat('sv-SE', {timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(ms));
  }
  function dayBoundary(key, tz) {
    const noon = Date.parse(key + 'T12:00:00Z');
    let lo = noon - 36 * 3600000, hi = noon + 36 * 3600000;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (dateKey(mid, tz) < key) lo = mid; else hi = mid;
    }
    return hi;
  }
  // Geometric solar altitude -4° to +6°; cloud cover can obscure the light.
  function goldenPeriods(key, place) {
    const tomorrow = new Date(key + 'T12:00:00Z');
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const start = dayBoundary(key, place.tz);
    const end = dayBoundary(tomorrow.toISOString().slice(0,10), place.tz);
    const altitude = t => solarPosition(t, place.lat, place.lon).altitude;
    const cuts = [start, end];
    // At high latitudes the Sun may never reach +6°. Split continuous
    // low winter light at solar noon so morning and evening stay distinct.
    let peak=start;
    for(let t=start;t<=end;t+=60000)if(altitude(t)>altitude(peak))peak=t;
    if(peak>start+60000 && peak<end-60000 && altitude(peak)>-4 && altitude(peak)<6){
      let lo=peak-60000,hi=peak+60000;
      while(hi-lo>100){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(altitude(a)<altitude(b))lo=a;else hi=b;}
      cuts.push((lo+hi)/2);
    }
    for (let a = start; a < end; a += 60000) {
      const b = Math.min(a + 60000, end), aa = altitude(a), ab = altitude(b);
      for (const threshold of [-4, 6]) {
        if ((aa < threshold) === (ab < threshold)) continue;
        let lo = a, hi = b;
        while (hi - lo > 100) {
          const mid = (lo + hi) / 2;
          if ((altitude(mid) < threshold) === (aa < threshold)) lo = mid; else hi = mid;
        }
        cuts.push((lo + hi) / 2);
      }
    }
    cuts.sort((a,b) => a-b);
    const periods = [];
    for (let i = 1; i < cuts.length; i++) {
      const mid = (cuts[i-1] + cuts[i]) / 2, alt = altitude(mid);
      if (alt < -4 || alt > 6) continue;
      const partial = cuts[i-1] === start || cuts[i] === end;
      periods.push({start:cuts[i-1], end:cuts[i], partial,
        label:partial ? 'Fotoljus' : altitude(mid+1000) > altitude(mid-1000) ? 'Morgon' : 'Kväll',
        azimuth:solarPosition(mid, place.lat, place.lon).azimuth});
    }
    return periods;
  }
  function goldenStatus(period, now) {
    if (now >= period.start && now < period.end) return Math.ceil((period.end-now)/60000) + ' min kvar';
    if (now < period.start && period.start-now <= 30*60000) return '⏳ Gyllene timmen om ' + Math.ceil((period.start-now)/60000) + ' min';
    return '';
  }
  function compass(degrees) {
    return ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSV','SV','VSV','V','VNV','NV','NNV'][Math.round(degrees/22.5)%16];
  }
  function compassWords(degrees) {
    return ['norr','nordost','öster','sydost','söder','sydväst','väster','nordväst'][Math.round(degrees/45)%8];
  }
  function moveBoundary(start,end,value,edge,duration) {
    const limit=Math.min(29.9,duration), gap=Math.min(.05,duration);
    value=Math.round(value*100)/100;
    if(edge==='start')start=Math.max(0,Math.min(value,end-gap));
    else end=Math.min(duration,Math.max(value,start+gap));
    if(end-start>limit){if(edge==='start')end=start+limit;else start=end-limit;}
    return {start,end};
  }
  function waveformPeaks(buffer,bins=1000) {
    const peaks=new Float32Array(bins);
    for(let c=0;c<buffer.numberOfChannels;c++){
      const data=buffer.getChannelData(c);
      for(let i=0;i<data.length;i++){
        const bin=Math.min(bins-1,Math.floor(i*bins/data.length));
        peaks[bin]=Math.max(peaks[bin],Math.abs(data[i]));
      }
    }
    return peaks;
  }
  function calendarInfo(ms,tz){
    const key=dateKey(ms,tz), thursday=new Date(key+'T00:00:00Z');
    thursday.setUTCDate(thursday.getUTCDate()+4-(thursday.getUTCDay()||7));
    return {year:Number(key.slice(0,4)),week:Math.floor((thursday-Date.UTC(thursday.getUTCFullYear(),0,1))/604800000)+1};
  }
  function clipAudio(buffer, start, end, fadeIn, fadeOut) {
    const rate = buffer.sampleRate;
    if (![start,end,fadeIn,fadeOut,rate].every(Number.isFinite) || rate <= 0 || start < 0 || end > buffer.duration + 1e-6 || end <= start || end-start > 30.000001 || fadeIn < 0 || fadeOut < 0 || fadeIn > end-start || fadeOut > end-start) {
      throw new Error('Välj ett klipp på högst 30 sekunder och toningar som ryms i klippet.');
    }
    const first = Math.round(start*rate), length = Math.min(Math.round(end*rate), buffer.length)-first;
    if (length < 2) throw new Error('Klippet är för kort.');
    const channels = [];
    for (let c=0;c<Math.min(2,buffer.numberOfChannels);c++) {
      const source=buffer.getChannelData(c), output=new Float32Array(length);
      for (let i=0;i<length;i++) {
        const gain=Math.min(1,fadeIn ? i/(fadeIn*rate) : 1,fadeOut ? (length-1-i)/(fadeOut*rate) : 1);
        output[i]=source[first+i]*gain;
      }
      channels.push(output);
    }
    if (!channels.length) throw new Error('Filen saknar ljudspår.');
    return {channels, sampleRate:rate, length};
  }
  function encodeWav(clip) {
    const count=clip.channels.length, size=clip.length*count*2;
    const view=new DataView(new ArrayBuffer(44+size));
    const word=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
    word(0,'RIFF');view.setUint32(4,36+size,true);word(8,'WAVE');word(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,count,true);
    view.setUint32(24,clip.sampleRate,true);view.setUint32(28,clip.sampleRate*count*2,true);
    view.setUint16(32,count*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,size,true);
    let offset=44;
    for(let i=0;i<clip.length;i++)for(const channel of clip.channels){
      const n=Math.max(-1,Math.min(1,channel[i]));view.setInt16(offset,Math.round(n<0?n*32768:n*32767),true);offset+=2;
    }
    return view.buffer;
  }
  const api={solarPosition,dateKey,dayBoundary,goldenPeriods,goldenStatus,compass,compassWords,moveBoundary,waveformPeaks,calendarInfo,clipAudio,encodeWav};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.InfluencerTools=api;
})(globalThis);
