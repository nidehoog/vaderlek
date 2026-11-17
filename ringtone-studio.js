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
      <legend>Klipp och tona ljudet · högst 30 sekunder</legend>
      <div class="studioFields">
        <label>Start (sekunder)<input id="ringtoneStart" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label>
        <label>Slut (sekunder)<input id="ringtoneEnd" type="number" min="0" step="0.01" value="30" inputmode="decimal"></label>
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
    </details>
    <details><summary>Behöver du en video? Så gör du en skärminspelning</summary>
      <ol><li>Öppna videon eller appen med ljudet du vill använda.</li><li>Svep ned från skärmens övre högra hörn för att öppna Kontrollcenter. På en iPhone med hemknapp sveper du upp från nederkanten.</li><li>Tryck på Skärminspelning, symbolen med en cirkel i en ring. Saknas den: håll på en tom yta i Kontrollcenter, välj Lägg till ett reglage och sedan Skärminspelning.</li><li>Vänta tills nedräkningen är klar, stäng Kontrollcenter och spela upp ljudet. Låt mikrofonen vara av om du bara vill ha ljudet från videon eller appen.</li><li>Stoppa via inspelningssymbolen överst på skärmen eller via Kontrollcenter. Inspelningen sparas i Bilder.</li><li>Gå tillbaka hit, tryck på Välj video eller skärminspelning och välj inspelningen från bildbiblioteket.</li></ol>
      <p>Vissa appar tillåter inte inspelning av bild eller ljud.</p>
      <a href="https://support.apple.com/sv-se/102653" target="_blank" rel="noopener noreferrer">Visa Apples hjälp för skärminspelning</a>
    </details>`;
  document.querySelector('.proteinCard').after(panel);
  const $=id=>panel.querySelector('#'+id);
  const status=$('ringtoneStatus'), controls=$('ringtoneControls'), audio=$('ringtoneAudio');
  const fields=['Start','End','FadeIn','FadeOut'].map(name=>$('ringtone'+name));
  let buffer=null, context=null, url=null, exportFile=null, generation=0, trigger=null;
  function clearOutput(){
    audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;
    if(url)URL.revokeObjectURL(url);url=null;exportFile=null;
    $('ringtoneDownload').hidden=true;$('ringtoneShare').hidden=true;$('ringtoneInstall').hidden=true;
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
