(() => {
  'use strict';
  const panel=document.createElement('section');
  panel.id='ringtoneStudio';panel.className='ringtoneStudio';panel.hidden=true;
  panel.setAttribute('aria-labelledby','ringtoneTitle');
  panel.innerHTML=`
    <button type="button" class="studioClose" aria-label="Stäng ringsignalstudion">✕</button>
    <h2 id="ringtoneTitle" tabindex="-1">🎵 Ringsignalstudio</h2>
    <p>Gör en ringsignal med ljud från en video eller skärminspelning. Filen bearbetas bara på din enhet.</p>
    <label for="ringtoneFile">Välj video eller skärminspelning</label>
    <input id="ringtoneFile" type="file" accept="video/*,.mov,.mp4">
    <p id="ringtoneStatus" role="status"></p>
    <fieldset id="ringtoneControls" disabled>
      <legend>Klipp och tona ljudet · högst 29,9 sekunder</legend>
      <p>Dra handtagen för att välja delen du vill spara.</p>
      <div id="ringtoneWave" class="ringtoneWave">
        <canvas id="ringtoneCanvas" width="1000" height="160" aria-label="Ljudets vågform"></canvas>
        <div id="ringtoneRegion" class="ringtoneRegion"></div>
        <button type="button" id="ringtoneStartHandle" class="waveHandle" role="slider" aria-label="Markeringens start" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">↔</button>
        <button type="button" id="ringtoneEndHandle" class="waveHandle" role="slider" aria-label="Markeringens slut" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">↔</button>
      </div>
      <div class="studioFields">
        <label>Start (sekunder)<input id="ringtoneStart" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label>
        <label>Slut (sekunder)<input id="ringtoneEnd" type="number" min="0" step="0.01" value="29.9" inputmode="decimal"></label>
        <label>Intoning (sekunder)<input id="ringtoneFadeIn" type="number" min="0" step="0.1" value="0" inputmode="decimal"></label>
        <label>Uttoning (sekunder)<input id="ringtoneFadeOut" type="number" min="0" step="0.1" value="1" inputmode="decimal"></label>
      </div>
      <p id="ringtoneLength"></p>
      <div class="studioActions"><button type="button" id="ringtonePreview">▶ Lyssna på klippet</button><button type="button" id="ringtoneExport">Skapa ringsignal</button></div>
    </fieldset>
    <audio id="ringtoneAudio" controls hidden aria-label="Förhandslyssna med toningar"></audio>
    <div class="studioActions" id="ringtoneDownload" hidden><a download="ringsignal.wav">Spara ringsignalen</a><button type="button" id="ringtoneShare" hidden>Dela ringsignalen</button></div>
    <details id="ringtoneInstall" hidden><summary>Nästa steg: använd ringsignalen på din iPhone</summary>
      <ol><li>Spara ringsignalen i appen Filer.</li><li>Öppna Filer och håll fingret på den sparade filen.</li><li>Tryck på Dela och välj Använd som ringsignal. Det här alternativet finns i iOS 26 och senare för ljudfiler som stöds.</li></ol>
      <p>Om alternativet saknas, öppna filen och prova delningsknappen där. Prova också att göra klippet kortare än 30 sekunder.</p>
      <p><a href="https://support.apple.com/sv-se/120692" target="_blank" rel="noopener noreferrer">Alternativ: Apples instruktion för ringsignal via GarageBand</a></p>
    </details>
    <p><a href="https://support.apple.com/sv-se/102653" target="_blank" rel="noopener noreferrer">Apple: så gör du en skärminspelning</a></p>`;
  document.querySelector('.proteinCard').after(panel);
  const $=id=>panel.querySelector('#'+id);
  const status=$('ringtoneStatus'), controls=$('ringtoneControls'), audio=$('ringtoneAudio');
  const fields=['Start','End','FadeIn','FadeOut'].map(name=>$('ringtone'+name));
  let buffer=null, context=null, url=null, exportFile=null, generation=0, trigger=null;
  let peaks=null;
  const wave=$('ringtoneWave'), canvas=$('ringtoneCanvas');
  const handles=[$('ringtoneStartHandle'),$('ringtoneEndHandle')];
  function drawWave(){
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,1000,160);
    wave.hidden=!buffer;
    if(!buffer||!peaks)return;
    const start=fields[0].valueAsNumber,end=fields[1].valueAsNumber;
    const valid=Number.isFinite(start)&&Number.isFinite(end)&&end>start;
    ctx.strokeStyle='#927ba9';ctx.beginPath();
    for(let i=0;i<peaks.length;i++){const h=Math.max(1,peaks[i]*70);ctx.moveTo(i,80-h);ctx.lineTo(i,80+h);}
    ctx.stroke();
    if(!valid)return;
    const left=start/buffer.duration*100,right=end/buffer.duration*100;
    $('ringtoneRegion').style.left=left+'%';$('ringtoneRegion').style.width=(right-left)+'%';
    handles.forEach((handle,i)=>{
      const value=i?end:start;
      handle.style.left=(i?right:left)+'%';
      handle.setAttribute('aria-valuemax',String(buffer.duration));
      handle.setAttribute('aria-valuenow',String(value));
      handle.setAttribute('aria-valuetext',value.toFixed(2)+' sekunder');
    });
    // Show the fade envelope inside the selected waveform.
    ctx.strokeStyle='#442164';ctx.lineWidth=3;ctx.beginPath();
    const x1=start/buffer.duration*1000,x2=end/buffer.duration*1000;
    const fi=Math.min(end-start,fields[2].valueAsNumber||0)/buffer.duration*1000;
    const fo=Math.min(end-start,fields[3].valueAsNumber||0)/buffer.duration*1000;
    for(let i=0;i<=200;i++){
      const x=x1+(x2-x1)*i/200;
      const gain=Math.max(0,Math.min(1,fi?(x-x1)/fi:1,fo?(x2-x)/fo:1));
      const y=150-gain*140;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();ctx.lineWidth=1;
  }
  function adjust(edge,value){
    if(!buffer)return;
    const next=InfluencerTools.moveBoundary(fields[0].valueAsNumber||0,fields[1].valueAsNumber||Math.min(29.9,buffer.duration),value,edge,buffer.duration);
    fields[0].value=next.start.toFixed(2);fields[1].value=next.end.toFixed(2);
    const length=next.end-next.start;
    fields[2].value=Math.min(fields[2].valueAsNumber||0,length).toFixed(2);
    fields[3].value=Math.min(fields[3].valueAsNumber||0,length).toFixed(2);
    validate();
  }
  let drag=null;
  wave.addEventListener('pointerdown',event=>{
    if(!buffer||controls.disabled||event.button!==0)return;
    const rect=wave.getBoundingClientRect(),value=(event.clientX-rect.left)/rect.width*buffer.duration;
    const edge=event.target===handles[0]?'start':event.target===handles[1]?'end':Math.abs(value-fields[0].valueAsNumber)<Math.abs(value-fields[1].valueAsNumber)?'start':'end';
    drag={edge,id:event.pointerId};wave.setPointerCapture(event.pointerId);event.preventDefault();adjust(edge,value);
  });
  wave.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const rect=wave.getBoundingClientRect();adjust(drag.edge,(event.clientX-rect.left)/rect.width*buffer.duration);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])wave.addEventListener(type,()=>{drag=null;});
  handles.forEach((handle,i)=>handle.addEventListener('keydown',event=>{
    if(!buffer)return;
    const edge=i?'end':'start',value=fields[i].valueAsNumber;
    const step=event.shiftKey?1:.1;
    const target={ArrowLeft:value-step,ArrowDown:value-step,ArrowRight:value+step,ArrowUp:value+step,Home:0,End:buffer.duration}[event.key];
    if(target!==undefined){event.preventDefault();adjust(edge,target);}
  }));
  function clearOutput(){
    audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;
    if(url)URL.revokeObjectURL(url);url=null;exportFile=null;
    $('ringtoneDownload').hidden=true;$('ringtoneShare').hidden=true;$('ringtoneInstall').hidden=true;
  }
  function selection(){return InfluencerTools.clipAudio(buffer,...fields.map(field=>field.valueAsNumber));}
  function validate(){
    clearOutput();drawWave();
    try {
      if(!buffer)throw new Error('Välj en fil med ljud.');
      const [start,end,fadeIn,fadeOut]=fields.map(f=>f.valueAsNumber);
      if(![start,end,fadeIn,fadeOut].every(Number.isFinite)||start<0||end>buffer.duration||end<=start||end-start>29.900001||Math.min(fadeIn,fadeOut)<0||Math.max(fadeIn,fadeOut)>end-start)throw new Error('Välj start och slut inom filen, högst 29,9 sekunder. Toningarna måste rymmas i klippet.');
      $('ringtoneLength').textContent='Klippets längd: '+(end-start).toFixed(2)+' s';
      $('ringtonePreview').disabled=false;$('ringtoneExport').disabled=false;
      return true;
    }catch(error){
      $('ringtoneLength').textContent=error.message;
      $('ringtonePreview').disabled=true;$('ringtoneExport').disabled=true;return false;
    }
  }
  function close(){panel.hidden=true;audio.pause();trigger?.setAttribute('aria-expanded','false');trigger?.focus();}
  panel.querySelector('.studioClose').addEventListener('click',close);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  window.RingtoneStudio={open(button){
    trigger=button;panel.hidden=false;button.setAttribute('aria-expanded','true');
    $('ringtoneTitle').focus();panel.scrollIntoView({behavior:'smooth',block:'start'});
  }};
  document.querySelector('#viewMode').addEventListener('change',()=>{
    if(document.body.dataset.view!=='influencer'){audio.pause();panel.hidden=true;trigger?.setAttribute('aria-expanded','false');}
  });
  fields.forEach(field=>field.addEventListener('input',validate));
  $('ringtoneFile').addEventListener('change',async event=>{
    const ticket=++generation, file=event.target.files[0];
    buffer=null;peaks=null;controls.disabled=true;clearOutput();drawWave();$('ringtoneLength').textContent='';
    if(!file){status.textContent='Välj en video eller skärminspelning.';return;}
    if(file.size>50*1024*1024){status.textContent='Filen är för stor. Välj ett kortare klipp, högst 50 MB.';return;}
    status.textContent='Läser ljudet i '+file.name+' …';
    try{
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)throw new Error('Webbläsaren saknar stöd för ljudbearbetning.');
      context ||= new AudioContext();
      const decoded=await context.decodeAudioData(await file.arrayBuffer());
      if(ticket!==generation)return;
      if(!decoded.numberOfChannels||decoded.duration<=0)throw new Error('Filen saknar ljud.');
      if(decoded.duration>600)throw new Error('Välj en video som är kortare än 10 minuter.');
      buffer=decoded;peaks=InfluencerTools.waveformPeaks(buffer);fields[0].value=0;fields[1].value=Math.min(29.9,Math.floor(buffer.duration*100)/100);
      fields[2].value=0;fields[3].value=Math.min(1,Number(fields[1].value));
      fields[0].max=buffer.duration;fields[1].max=buffer.duration;controls.disabled=false;
      status.textContent=file.name+' · '+buffer.duration.toFixed(2)+' sekunder';validate();
    }catch(error){
      if(ticket!==generation)return;
      status.textContent=error.name==='EncodingError'||error.name==='NotSupportedError'?'Ljudet kunde inte läsas. Filen kan sakna ljudspår eller använda ett format som webbläsaren inte stöder. Prova MP4/MOV med AAC-ljud eller en WAV-fil.':error.message;
    }
  });
  drawWave();
  function prepare(){
    clearOutput();
    const wav=InfluencerTools.encodeWav(selection());
    exportFile=new File([wav],'ringsignal.wav',{type:'audio/wav'});
    url=URL.createObjectURL(exportFile);audio.src=url;audio.hidden=false;
  }
  $('ringtonePreview').addEventListener('click',async()=>{
    try{prepare();await audio.play();}catch(error){status.textContent='Kunde inte spela klippet: '+error.message;}
  });
  $('ringtoneExport').addEventListener('click',()=>{
    try{
      prepare();$('ringtoneDownload').querySelector('a').href=url;$('ringtoneDownload').hidden=false;
      $('ringtoneShare').hidden=!(navigator.canShare&&navigator.canShare({files:[exportFile]}));
      $('ringtoneInstall').hidden=false;$('ringtoneInstall').open=true;
      status.textContent='Din ringsignal är klar. Spara den i Filer och följ nästa steg nedan.';
    }catch(error){status.textContent=error.message;}
  });
  $('ringtoneShare').addEventListener('click',async()=>{
    if(!exportFile)return;
    try{await navigator.share({files:[exportFile],title:'Min ringsignal'});}
    catch(error){if(error.name!=='AbortError')status.textContent='Delning misslyckades. Tryck på Spara ringsignalen i stället.';}
  });
  window.addEventListener('pagehide',()=>{clearOutput();context?.close();context=null;});
})();
