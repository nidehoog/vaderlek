(() => {
  const cards = document.querySelector('#outfitCards');
  const resources = [...document.querySelectorAll('.resourceLink')];
  const legacyList = document.querySelector('#netscapeLegacy ul');
  function syncLinks() {
    const extras = [...legacyList.children].filter(li => /^(SMHI|Text-TV)$/.test(li.textContent.trim()));
    legacyList.replaceChildren(...resources.map(source => {
      const link = document.createElement('a');
      link.href = source.href;
      link.textContent = source.querySelector('strong').textContent;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const item = document.createElement('li');
      item.append(link);
      return item;
    }), ...extras);
  }
  function weatherIcon(code, night) {
    if (code == null) return '—';
    if (code < 2) return night ? '🌙' : '☀️';
    if (code < 4) return code === 2 && !night ? '🌤️' : '☁️';
    if (code < 50) return '🌫️';
    if (code >= 95) return '⛈️';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
    return '🌧️';
  }
  function shortAdvice(result) {
    const items = (result.items || []).join(' ').toLowerCase();
    if (/rain jacket|umbrella/.test(items)) return '☔ Jacka + paraply';
    if (/parka|winter coat|winter jacket/.test(items)) return '🧣 Vinterjacka';
    if (/heavy jacket|wool coat|insulated jacket/.test(items)) return '🧥 Varm jacka';
    if (/jacket|trench/.test(items)) return '🧥 Jacka';
    if (/tank top|t-shirt|short.sleeve/.test(items)) return '👕 T-shirt';
    if (/sweater|hoodie|long.sleeve/.test(items)) return '👚 Tröja';
    return '';
  }
  let active;
  let goldenTimer;
  let renderedDate;
  function updateGolden(panel, place) {
    const now=Date.now(), key=InfluencerTools.dateKey(now,place.tz);
    if(panel.dataset.date!==key){
      panel.dataset.date=key;
      panel._periods=InfluencerTools.goldenPeriods(key,place);
    }
    const time=t=>new Intl.DateTimeFormat('sv-SE',{timeZone:place.tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
    panel.querySelector('.goldenTimes').replaceChildren(...panel._periods.map(period=>{
      const row=document.createElement('p');
      const status=InfluencerTools.goldenStatus(period,now);
      const heading=document.createElement('strong');
      heading.textContent=period.label+' · '+(status ? status.replace('Gyllene timmen','Fotoljus').replace('min kvar','minuter kvar med fotoljus') : '✨ Perfekt fotoljus i '+Math.round((period.end-period.start)/60000)+' minuter');
      const direction=document.createElement('small');
      direction.textContent=time(period.start)+'–'+time(period.end)+' · Mot '+InfluencerTools.compassWords(period.azimuth);
      row.append(heading,direction);return row;
    }));
    if(!panel._periods.length)panel.querySelector('.goldenTimes').textContent='Ingen gyllene timme på den här orten i dag.';
  }
  async function read(url, signal) {
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }
  function render() {
    syncLinks();
    active?.abort();
    clearInterval(goldenTimer);
    if (document.body.dataset.view !== 'influencer') return;
    active = new AbortController();
    const {signal} = active;
    const place = selectedEarthPlace();
    const now = new Date();
    const date = new Intl.DateTimeFormat('sv-SE', {timeZone:place.tz, year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    renderedDate=date;
    const hour = Number(new Intl.DateTimeFormat('sv-SE',{timeZone:place.tz,hour:'2-digit',hourCycle:'h23'}).format(now));
    const next = new Date(date + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate()+1);
    const tomorrow = next.toISOString().slice(0,10);
    const fields = 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m';
    const params = new URLSearchParams({latitude:place.lat, longitude:place.lon, timezone:place.tz, wind_speed_unit:"ms", current:fields, hourly:fields, forecast_days:2});
    const weather = read('https://api.open-meteo.com/v1/forecast?' + params,signal);
    const periods = [
      ['Nu',date,hour,hour<6 || hour>=18?'night':'day'],
      ['I kväll',date,Math.max(20,hour),'night'],
      ['I morgon',tomorrow,12,'day']
    ];
    cards.replaceChildren();
    const adviceRequests = new Map();
    periods.forEach(([title,day,h,period], index) => {
      const card = document.createElement('article');
      card.className='outfitCard';
      card.innerHTML='<h2></h2><div class="outfitIcon"></div><span>Känns som</span><strong class="outfitTemp">—</strong><small class="airTemp">Lufttemp —</small><b class="outfitWind"></b><div class="outfitAdvice"></div>';
      card.querySelector('h2').textContent=title;
      if(index===0){
        card.classList.add('outfitNow');
        card.querySelector('h2').insertAdjacentHTML('afterend','<small class="sunState"></small>');
      }
      cards.append(card);
      weather.then(data => {
        const i=data.hourly.time.indexOf(day+'T'+String(h).padStart(2,'0')+':00');
        const value=k => index===0 ? data.current[k] : data.hourly[k][i];
        if(index===0 && (value('is_day')===0 || value('is_day')===1)){
          card.querySelector('.sunState').textContent=value('is_day')?'☀️ Solen är uppe':'🌙 Solen är nere';
        }
        const wind=value('wind_speed_10m');
        if(Number.isFinite(wind)){
          const words=wind<0.5?'Vindstilla':wind<4?'Blåser lite':wind<8?'Blåser en del':wind<14?'Blåser mycket':'Blåser jättemycket';
          card.querySelector('.outfitWind').textContent='💨 '+words;
        }
        const degrees=v => Number.isFinite(v)?Math.round(v)+'°':'—';
        card.querySelector('.outfitTemp').textContent=degrees(value('apparent_temperature'));
        card.querySelector('.airTemp').textContent='Lufttemp '+degrees(value('temperature_2m'));
        card.querySelector('.outfitIcon').textContent=weatherIcon(value('weather_code'),!value('is_day'));
      }).catch(()=>{if(!signal.aborted) card.querySelector('.airTemp').textContent='Vädret otillgängligt';});
      const query=new URLSearchParams({lat:place.lat,lon:place.lon,date:day,period,style:'casual',units:'metric'});
      const url='https://api.whattowear.ca/recommend?'+query;
      if (!adviceRequests.has(url)) adviceRequests.set(url,read(url,signal));
      adviceRequests.get(url).then(data=>{
        card.querySelector('.outfitAdvice').textContent=shortAdvice(data);
      }).catch(()=>{if(!signal.aborted) card.querySelector('.outfitAdvice').textContent='Klädråd saknas';});
    });
    const golden=document.createElement('article');
    golden.className='goldenCard';
    golden.setAttribute('aria-label','Gyllene timmen');
    golden.innerHTML='<h2>🌅 Gyllene timmen</h2><div class="goldenTimes" aria-live="polite"></div><small>Bästa tiden för mjukt, varmt fotoljus. Moln kan påverka ljuset.</small>';
    cards.append(golden);
    updateGolden(golden,place);
    goldenTimer=setInterval(()=>{
      if(InfluencerTools.dateKey(Date.now(),place.tz)!==renderedDate){render();return;}
      updateGolden(golden,place);
    },15000);
    const calendar = document.createElement('article');
    calendar.className = 'outfitCard outfitCalendar';
    calendar.innerHTML = '<span>Idag är det</span><h2></h2><span>Vecka</span><strong></strong><small class="calendarYear"></small><span>Dagens namnsdagar</span><b aria-live="polite">…</b>';
    cards.append(calendar);
    const weekday = new Intl.DateTimeFormat('sv-SE',{timeZone:place.tz,weekday:'long'}).format(now);
    calendar.querySelector('h2').textContent = weekday[0].toUpperCase() + weekday.slice(1);
    const calendarDate=InfluencerTools.calendarInfo(now.getTime(),place.tz);
    calendar.querySelector('strong').textContent=calendarDate.week;
    calendar.querySelector('.calendarYear').textContent=calendarDate.year;
    const names = calendar.querySelector('b');
    read('https://sholiday.faboul.se/dagar/v2.1/' + date.replaceAll('-', '/'), signal)
      .then(data => {
        const day = data.dagar.find(entry => entry.datum === date);
        names.textContent = day.namnsdag.filter(Boolean).join(', ') || 'Ingen namnsdag';
      })
      .catch(() => { if (!signal.aborted) names.textContent = 'Kunde inte hämtas'; });
  }
  document.querySelector('#citySelect').addEventListener('change',render);
  document.querySelector('#viewMode').addEventListener('change',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && document.body.dataset.view==='influencer')render();});
  setInterval(()=>{if(document.body.dataset.view==='influencer') render();}, 30*60*1000);
  const weight=document.querySelector('#proteinWeight');
  const goal=document.querySelector('#proteinGoal');
  const foods=document.querySelector('#proteinFoods');
  function updateProtein(){
    const kg=weight.valueAsNumber;
    foods.replaceChildren();
    if(!Number.isFinite(kg)||kg<1){
      goal.textContent='Skriv din vikt i kilo';
      return;
    }
    const grams=kg*0.83;
    goal.textContent='≈ '+Math.round(grams)+' g protein';
    const hint=document.createElement('p');
    hint.textContent='Samma mängd protein i ett av dessa:';
    foods.append(hint);
    for(const [name,per100] of [['🥣 Kvarg',11],['🥄 Whey-pulver',80],['🍗 Kycklingfilé (rå vikt)',23]]){
      const row=document.createElement('div');
      row.textContent=name+' · '+Math.round(grams*100/per100)+' g';
      foods.append(row);
    }
    const eggs=document.createElement('div');
    const egg=document.createElement('button');
    egg.type='button';egg.className='studioEgg';egg.textContent='🥚';
    egg.setAttribute('aria-label','Öppna ringsignalstudion');
    egg.setAttribute('aria-controls','ringtoneStudio');
    egg.setAttribute('aria-expanded',String(!document.getElementById('ringtoneStudio').hidden));
    egg.addEventListener('click',()=>RingtoneStudio.open(egg));
    eggs.append(egg,document.createTextNode(' Ägg · cirka '+Math.round(grams/6)+' st'));
    foods.append(eggs);
  }
  weight.addEventListener('input',updateProtein);
  for(const [id,step] of [['weightDown',-1],['weightUp',1]]){
    document.getElementById(id).addEventListener('click',()=>{
      weight.value=Math.max(1,Math.round(((weight.valueAsNumber||70)+step)*10)/10);
      updateProtein();
    });
  }
  updateProtein();
  render();
})();

