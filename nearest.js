(() => {
  const button = document.getElementById('nearestCity');
  const selector = document.getElementById('citySelect');
  const status = document.getElementById('nearestStatus');
  let request = 0;
  selector.addEventListener('change', () => {
    request++;
    button.disabled = false;
    status.textContent = '';
  });

  function closest(lat, lon) {
    const rad = Math.PI / 180;
    let best;
    let minimum = Infinity;
    for (const place of PLACES) {
      const distance = Math.sin((place.lat - lat) * rad / 2) ** 2
        + Math.cos(lat * rad) * Math.cos(place.lat * rad)
        * Math.sin((place.lon - lon) * rad / 2) ** 2;
      if (distance < minimum) {
        best = place;
        minimum = distance;
      }
    }
    return best;
  }

  button.addEventListener('click', () => {
    if (!navigator.geolocation) {
      status.textContent = 'Platsåtkomst saknas. Välj ort i listan.';
      return;
    }
    const ticket = ++request;
    button.disabled = true;
    status.textContent = 'Söker närmaste ort …';
    navigator.geolocation.getCurrentPosition(position => {
      if (ticket !== request) return;
      const place = closest(position.coords.latitude, position.coords.longitude);
      selector.value = place.id;
      selector.dispatchEvent(new Event('change', {bubbles:true}));
      status.textContent = 'Närmaste ort i listan: ' + place.name;
    }, error => {
      if (ticket !== request) return;
      button.disabled = false;
      status.textContent = error.code === 1
        ? 'Platsåtkomst nekades. Välj ort i listan eller tillåt platsåtkomst i webbläsaren.'
        : 'Kunde inte hitta din position. Försök igen eller välj ort i listan.';
    }, {enableHighAccuracy:true, maximumAge:0, timeout:15000});
  });
})();
