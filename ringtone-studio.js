(() => {
  'use strict';
  const panel=document.createElement('section');
  panel.id='ringtoneStudio';panel.className='ringtoneStudio';panel.hidden=true;
  panel.setAttribute('aria-labelledby','ringtoneTitle');
  panel.innerHTML=`
    <button type="button" class="studioClose" aria-label="Stäng ringsignalstudion">✕</button>
    <h2 id="ringtoneTitle" tabindex="-1">🎵 Ringsignalstudio</h2>
    <p>Gör en ringsignal av din egen video. Filen bearbetas bara på din enhet.</p>
    <label for="ringtoneFile">Välj video eller ljudfil</label>
    <input id="ringtoneFile" type="file" accept="video/*,audio/*,.mov,.mp4,.m4a,.wav">
    <p id="ringtoneStatus" role="status"></p>
    <fieldset id="ringtoneControls" disabled>
      <legend>Klipp och tona ljudet · högst 30 sekunder</legend>
      <div class="studioFields">
        <label>Start (sekunder)<input id="ringtoneStart" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label>
        <label>Slut (sekunder)<input id="ringtoneEnd" type="number" min="0" step="0.01" value="30" inputmode="decimal"></label>
        <label>Intoning (sekunder)<input id="ringtoneFadeIn" type="number" min="0" step="0.1" value="0" inputmode="decimal"></label>
        <label>Uttoning (sekunder)<input id="ringtoneFadeOut" type="number" min="0" step="0.1" value="1" inputmode="decimal"></label>
      </div>
      <p id="ringtoneLength"></p>
      <div class="studioActions"><button type="button" id="ringtonePreview">▶ Lyssna på klippet</button><button type="button" id="ringtoneExport">Exportera WAV</button></div>
    </fieldset>
    <audio id="ringtoneAudio" controls hidden aria-label="Förhandslyssna med toningar"></audio>
    <div class="studioActions" id="ringtoneDownload" hidden><a download="ringsignal.wav">Spara ringsignal.wav</a><button type="button" id="ringtoneShare" hidden>Dela ljudfil</button></div>
    <details><summary>Så använder du ljudet på iPhone</summary>
      <ol><li>Exportera WAV och spara filen i Filer på din iPhone.</li><li>Öppna GarageBand, skapa ett ljudinspelningsprojekt och välj spårvyn. Importera WAV-filen via loopknappen → Filer.</li><li>Lägg ljudet längst till vänster. Gå till Mina låtar, håll på projektet och välj Dela → Ringsignal → Exportera.</li></ol>
      <p>WAV är ljudfilen till GarageBand. Webbsidan installerar inte ringsignalen automatiskt och skapar ingen M4R-fil.</p>
      <a href="https://support.apple.com/sv-se/120692" target="_blank" rel="noopener noreferrer">Apples instruktioner</a>
    </details>`;
  document.querySelector('.proteinCard').after(panel);
  const $=id=>panel.querySelector('#'+id);
  const status=$('ringtoneStatus'), controls=$('ringtoneControls'), audio=$('ringtoneAudio');
  const fields=['Start','End','FadeIn','FadeOut'].map(name=>$('ringtone'+name));
  let buffer=null, context=null, url=null, exportFile=null, generation=0, trigger=null;
  function clearOutput(){
    audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;
    if(url)URL.revokeObjectURL(url);url=null;exportFile=null;
    $('ringtoneDownload').hidden=true;$('ringtoneShare').hidden=true;
  }
  function selection(){return InfluencerTools.clipAudio(buffer,...fields.map(field=>field.valueAsNumber));}
  function validate(){
    clearOutput();
    try {
      if(!buffer)throw new Error('Välj en fil med ljud.');
      const [start,end,fadeIn,fadeOut]=fields.map(f=>f.valueAsNumber);
      if(![start,end,fadeIn,fadeOut].every(Number.isFinite)||start<0||end>buffer.duration||end<=start||end-start>30.000001||Math.min(fadeIn,fadeOut)<0||Math.max(fadeIn,fadeOut)>end-start)throw new Error('Välj start och slut inom filen, högst 30 sekunder. Toningarna måste rymmas i klippet.');
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
    buffer=null;controls.disabled=true;clearOutput();$('ringtoneLength').textContent='';
    if(!file){status.textContent='Välj en video eller ljudfil.';return;}
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
      buffer=decoded;fields[0].value=0;fields[1].value=Math.min(30,Math.floor(buffer.duration*100)/100);
      fields[2].value=0;fields[3].value=Math.min(1,Number(fields[1].value));
      fields[0].max=buffer.duration;fields[1].max=buffer.duration;controls.disabled=false;
      status.textContent=file.name+' · '+buffer.duration.toFixed(2)+' sekunder';validate();
    }catch(error){
      if(ticket!==generation)return;
      status.textContent=error.name==='EncodingError'||error.name==='NotSupportedError'?'Ljudet kunde inte läsas. Filen kan sakna ljudspår eller använda ett format som webbläsaren inte stöder. Prova MP4/MOV med AAC-ljud eller en WAV-fil.':error.message;
    }
  });
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
      status.textContent='Ljudfilen är klar. Spara eller dela den till Filer.';
    }catch(error){status.textContent=error.message;}
  });
  $('ringtoneShare').addEventListener('click',async()=>{
    if(!exportFile)return;
    try{await navigator.share({files:[exportFile],title:'Min ringsignal'});}
    catch(error){if(error.name!=='AbortError')status.textContent='Delning misslyckades. Använd Spara ringsignal.wav i stället.';}
  });
  window.addEventListener('pagehide',()=>{clearOutput();context?.close();context=null;});
})();
