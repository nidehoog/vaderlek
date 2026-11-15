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
  async function read(url, signal) {
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }
  function render() {
    syncLinks();
    active?.abort();
    if (document.body.dataset.view !== 'influencer') return;
    active = new AbortController();
    const {signal} = active;
    const place = selectedEarthPlace();
    const now = new Date();
    const date = new Intl.DateTimeFormat('sv-SE', {timeZone:place.tz, year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const hour = Number(new Intl.DateTimeFormat('sv-SE',{timeZone:place.tz,hour:'2-digit',hourCycle:'h23'}).format(now));
    const next = new Date(date + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate()+1);
    const tomorrow = next.toISOString().slice(0,10);
    const fields = 'temperature_2m,apparent_temperature,weather_code,is_day';
    const params = new URLSearchParams({latitude:place.lat, longitude:place.lon, timezone:place.tz, current:fields, hourly:fields, forecast_days:2});
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
      card.innerHTML='<h2></h2><div class="outfitIcon"></div><span>Känns som</span><strong class="outfitTemp">—</strong><small>Lufttemp —</small><div class="outfitAdvice"></div>';
      card.querySelector('h2').textContent=title;
      cards.append(card);
      weather.then(data => {
        const i=data.hourly.time.indexOf(day+'T'+String(h).padStart(2,'0')+':00');
        const value=k => index===0 ? data.current[k] : data.hourly[k][i];
        const degrees=v => Number.isFinite(v)?Math.round(v)+'°':'—';
        card.querySelector('.outfitTemp').textContent=degrees(value('apparent_temperature'));
        card.querySelector('small').textContent='Lufttemp '+degrees(value('temperature_2m'));
        card.querySelector('.outfitIcon').textContent=weatherIcon(value('weather_code'),!value('is_day'));
      }).catch(()=>{if(!signal.aborted) card.querySelector('small').textContent='Vädret otillgängligt';});
      const query=new URLSearchParams({lat:place.lat,lon:place.lon,date:day,period,style:'casual',units:'metric'});
      const url='https://api.whattowear.ca/recommend?'+query;
      if (!adviceRequests.has(url)) adviceRequests.set(url,read(url,signal));
      adviceRequests.get(url).then(data=>{
        card.querySelector('.outfitAdvice').textContent=shortAdvice(data);
      }).catch(()=>{if(!signal.aborted) card.querySelector('.outfitAdvice').textContent='Klädråd saknas';});
    });
    const calendar = document.createElement('article');
    calendar.className = 'outfitCard outfitCalendar';
    calendar.innerHTML = '<span>Idag är det</span><h2></h2><span>Vecka</span><strong></strong><span>Dagens namnsdagar</span><b aria-live="polite">…</b>';
    cards.append(calendar);
    const weekday = new Intl.DateTimeFormat('sv-SE',{timeZone:place.tz,weekday:'long'}).format(now);
    calendar.querySelector('h2').textContent = weekday[0].toUpperCase() + weekday.slice(1);
    // The Thursday of an ISO week determines its week-year.
    const thursday = new Date(date + 'T00:00:00Z');
    thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
    const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    calendar.querySelector('strong').textContent = Math.floor((thursday - yearStart) / 604800000) + 1;
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
  setInterval(()=>{if(document.body.dataset.view==='influencer') render();}, 30*60*1000);
  render();
})();
