const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const T=require('../influencer-tools.js');
const orebro={lat:59.2753,lon:15.2134,tz:'Europe/Stockholm'};
test('Golden hour crosses -4/+6 degrees in morning and reverse in evening',()=>{
  const p=T.goldenPeriods('2026-11-17',orebro);
  assert.equal(p.length,2);assert.equal(p[0].label,'Morgon');assert.equal(p[1].label,'Kväll');
  for(const [i,x] of p.entries()){
    assert.ok(x.end>x.start);
    assert.ok(Math.abs(T.solarPosition(x.start,orebro.lat,orebro.lon).altitude-(i?6:-4))<.001);
    assert.ok(Math.abs(T.solarPosition(x.end,orebro.lat,orebro.lon).altitude-(i?-4:6))<.001);
  }
  assert.ok(p[0].azimuth>90&&p[0].azimuth<180);
  assert.ok(p[1].azimuth>180&&p[1].azimuth<270);
});
test('Countdown boundaries: 30 minutes, start, last second and end',()=>{
  const p={start:2000000,end:5600000};
  assert.equal(T.goldenStatus(p,p.start-1800001),'');
  assert.match(T.goldenStatus(p,p.start-1800000),/30 min/);
  assert.equal(T.goldenStatus(p,p.start),'60 min kvar');
  assert.equal(T.goldenStatus(p,p.end-1),'1 min kvar');
  assert.equal(T.goldenStatus(p,p.end),'');
});
test('Local day boundaries handle DST and distant timezones',()=>{
  const hours=(a,b,tz)=>(T.dayBoundary(b,tz)-T.dayBoundary(a,tz))/3600000;
  assert.equal(hours('2026-03-29','2026-03-30',orebro.tz),23);
  assert.equal(hours('2026-10-25','2026-10-26',orebro.tz),25);
  for(const tz of ['Pacific/Auckland','America/Los_Angeles','Asia/Kathmandu']){
    const start=T.dayBoundary('2026-01-01',tz);
    assert.equal(T.dateKey(start,tz),'2026-01-01');
    assert.equal(T.dateKey(start-1,tz),'2025-12-31');
  }
});
test('Polar summer/winter produce no false sunrise periods',()=>{
  const pole={lat:89,lon:0,tz:'UTC'};
  assert.deepEqual(T.goldenPeriods('2026-06-21',pole),[]);
  assert.deepEqual(T.goldenPeriods('2026-12-21',pole),[]);
});
test('Low winter sun has morning/evening separated at solar noon',()=>{
  const place={lat:65,lon:20,tz:'Europe/Stockholm'};
  const p=T.goldenPeriods('2026-12-21',place);
  assert.equal(p.length,2);assert.equal(p[0].label,'Morgon');assert.equal(p[1].label,'Kväll');
  assert.equal(p[0].end,p[1].start);
});
test('Compass bearings',()=>{
  assert.equal(T.compass(0),'N');assert.equal(T.compass(90),'O');
  assert.equal(T.compass(180),'S');assert.equal(T.compass(270),'V');assert.equal(T.compass(359),'N');
});
function buffer(seconds=40){
  return {sampleRate:100,length:seconds*100,duration:seconds,numberOfChannels:2,getChannelData:c=>new Float32Array(seconds*100).fill(c?-.5:.5)};
}
test('Calendar shows local calendar year while retaining ISO week number',()=>{
  assert.deepEqual(T.calendarInfo(Date.parse('2021-01-01T12:00:00Z'),'Europe/Stockholm'),{year:2021,week:53});
  assert.deepEqual(T.calendarInfo(Date.parse('2026-12-31T23:30:00Z'),'Europe/Stockholm'),{year:2027,week:53});
  assert.deepEqual(T.calendarInfo(Date.parse('2026-12-31T23:30:00Z'),'America/Los_Angeles'),{year:2026,week:53});
});
test('Trim has precise duration and independent channel fade envelopes',()=>{
  const clip=T.clipAudio(buffer(),2,7,1,2);
  assert.equal(clip.length,500);assert.equal(clip.channels.length,2);
  assert.equal(clip.channels[0][0],0);assert.equal(clip.channels[0][499],0);
  assert.equal(clip.channels[0][100],.5);assert.equal(clip.channels[1][100],-.5);
  assert.ok(Math.abs(clip.channels[0][50]-.25)<1e-6);
  assert.ok(Math.abs(clip.channels[0][399]-.25)<1e-6);
});
test('Clip bounds and fade validation reject invalid input; 30 seconds accepted',()=>{
  for(const args of [[0,31,0,0],[-1,2,0,0],[4,4,0,0],[20,41,0,0],[0,5,6,0],[0,5,0,-1],[NaN,3,0,0]])assert.throws(()=>T.clipAudio(buffer(),...args));
  assert.equal(T.clipAudio(buffer(),0,30,0,0).length,3000);
  const overlap=T.clipAudio(buffer(),0,1,1,1);
  assert.ok(overlap.channels[0].every(x=>x>=0&&x<=.5));
});
test('WAV header, length, PCM format and interleaving are valid',()=>{
  const bytes=T.encodeWav(T.clipAudio(buffer(),0,1,0,0));
  const v=new DataView(bytes), b=Buffer.from(bytes);
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
  assert.equal(v.getUint16(20,true),1);assert.equal(v.getUint16(22,true),2);
  assert.equal(v.getUint32(24,true),100);assert.equal(v.getUint16(34,true),16);
  assert.equal(v.getUint32(40,true),400);assert.equal(bytes.byteLength,444);
  assert.equal(v.getInt16(44,true),16384);assert.equal(v.getInt16(46,true),-16384);
});
test('All JS including existing inline scripts parses',()=>{
  const root=path.join(__dirname,'..');
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  assert.ok(html.indexOf('influencer-tools.js?v=')<html.indexOf('influencer-extras.js'));
  assert.ok(html.indexOf('influencer-extras.js')<html.indexOf('outfit.js?v='));
});

