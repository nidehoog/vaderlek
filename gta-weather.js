(() => {
  const panel = document.querySelector('#gtaWeather');
  let request;
  function weather(code, day = 1) {
    if (!Number.isFinite(code)) return ['—','Weather unavailable'];
    if (code === 0) return day ? ['☀️','Clear skies'] : ['🌙','Clear skies'];
    if (code < 3) return [day ? '🌤️' : '☁️','Partly cloudy'];
    if (code === 3) return ['☁️','Overcast'];
    if (code < 50) return ['🌫️','Fog'];
    if (code >= 95) return ['⛈️','Thunderstorms'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['🌨️','Snow'];
    return ['🌧️',code < 60 ? 'Drizzle' : 'Rain'];
  }
  function clock(stamp, minutes = false) {
    if (!stamp) return '—';
    const [h,m] = stamp.slice(11,16).split(':');
    return (Number(h)%12 || 12) + (minutes ? ':'+m : '') + '<sup>'+(Number(h)<12?'AM':'PM')+'</sup>';
  }
  function temperature(v) { return Number.isFinite(v) ? Math.round(v)+'°' : '—'; }
  async function render(scroll = false) {
    request?.abort();
    if (document.body.dataset.view !== 'gta6') return;
    const controller = new AbortController();
    request = controller;
    const place = selectedEarthPlace();
    panel.innerHTML = '<h2 class="place"></h2><div class="now">Loading forecast…</div>';
    panel.firstElementChild.textContent = '⚲ '+place.name;
    if (scroll) requestAnimationFrame(()=>panel.scrollIntoView({block:'start'}));
    const params = new URLSearchParams({latitude:place.lat, longitude:place.lon, timezone:place.tz,
      current:'temperature_2m,weather_code,is_day,pressure_msl,precipitation',
      hourly:'temperature_2m,weather_code,is_day',daily:'temperature_2m_max,weather_code,sunset',forecast_days:2});
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:controller.signal});
      if (!response.ok) throw Error();
      const {current:c,hourly:h,daily:d} = await response.json();
      if (controller.signal.aborted) return;
      const [icon,description] = weather(c.weather_code,c.is_day);
      let condition = c.weather_code <= 1 && c.pressure_msl >= 1020 ? 'High pressure' : description;
      if (c.precipitation > 0) condition += ' · '+Number(c.precipitation)+' mm';
      panel.lastElementChild.innerHTML = 'Now<div class="reading"><span>'+temperature(c.temperature_2m)+'</span><span>'+icon+'</span></div>'+condition;
      const start = h.time.findIndex(t=>t>c.time);
      const hours = start<0 ? [] : h.time.slice(start,start+5);
      const cards = hours.map((t,i)=>'<div class="hour"><span>'+clock(t)+'</span><b>'+weather(h.weather_code[start+i],h.is_day[start+i])[0]+'</b>'+temperature(h.temperature_2m[start+i])+'</div>').join('');
      const rows = ['Today','Tomorrow'].map((day,i)=>'<div class="row"><span>'+day+'</span><strong>'+weather(d.weather_code[i])[0]+'　'+temperature(d.temperature_2m_max[i])+'</strong></div>').join('');
      panel.insertAdjacentHTML('beforeend','<div class="hours">'+cards+'</div><div class="box"><h3>2 Day Forecast</h3>'+rows+'</div><div class="box row"><span>Sunset</span><strong>'+clock(d.sunset[0],true)+'</strong></div>');
    } catch { if (!controller.signal.aborted) panel.lastElementChild.textContent = 'Forecast unavailable'; }
  }
  document.querySelector('#viewMode').addEventListener('change',()=>render(true));
  document.querySelector('#citySelect').addEventListener('change',()=>render(true));
  document.querySelector('#refresh').addEventListener('click',()=>render());
  render(true);
})();