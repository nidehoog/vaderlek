(()=>{
const converter = document.querySelector('#converter');
const body = document.querySelector('#converterBody');
let loading = false;
converter.addEventListener('toggle', async () => {
  if (!converter.open || loading || body.querySelector('iframe')) return;
  loading = true;
  try {
    const response = await fetch('./converter.json');
    if (!response.ok) throw Error();
    const categories = await response.json();
    body.replaceChildren();
    function menu(title) {
      const label = document.createElement('label');
      label.textContent = title;
      const select = document.createElement('select');
      label.append(select);
      body.append(label);
      return select;
    }
    const category = menu('Kategori'), from = menu('Från'), to = menu('Till');
    const frame = document.createElement('iframe');
    frame.title = 'Enhetsomvandlare';
    frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
    const credit = document.createElement('a');
    credit.textContent = 'Skapad med Konvertera.nu';
    credit.href = 'https://konvertera.nu/sv/';
    body.append(frame, credit);
    for (const c of categories) category.add(new Option(c.name,c.slug));
    function update() {
      const units = categories[category.selectedIndex].units;
      if (to.value === from.value) to.value = units.find(u => u.slug !== from.value).slug;
      for (const option of to.options) option.disabled = option.value === from.value;
      frame.src = 'https://konvertera.nu/sv/omvandla/embed/' + category.value + '/' + from.value + '-till-' + to.value + '/#theme=light&bg=transparent&border=off';
    }
    function populate() {
      const units = categories[category.selectedIndex].units;
      for (const select of [from,to]) select.replaceChildren(...units.map(u => new Option(u.name,u.slug)));
      to.selectedIndex = 1;
      update();
    }
    category.onchange = populate;
    from.onchange = to.onchange = update;
    populate();
  } catch {
    body.textContent = 'Kunde inte ladda enheterna. Stäng och öppna för att försöka igen.';
  } finally { loading = false; }
});

})();