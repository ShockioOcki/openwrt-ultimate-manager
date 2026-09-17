/* Progressive presentation only: LuCI owns polling, forms and action buttons. */
(() => {
  'use strict';
  const page = document.body.dataset.page;
  // Desktop wireless uses LuCI native rows; mobile retains its radio cards.
  if (page === 'admin-network-wireless' && matchMedia('(min-width:901px)').matches) return;
  if (!['admin', 'admin-status-overview', 'admin-network-wireless', ''].includes(page)) return;
  const main = document.getElementById('maincontent');
  const expanded = new Map();
  const ru = document.documentElement.lang.startsWith('ru');
  const tr = (a, b) => ru ? a : b;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag); if (cls) n.className = cls;
    if (text != null) n.textContent = text; return n;
  };
  function fact(label, value) {
    const n = el('div', 'oum-radio-fact'); n.append(el('span', '', label), el('strong', '', value == null || value === '' ? '—' : value)); return n;
  }
  function details(key, facts) {
    const d = el('details', 'oum-radio-details'); d.open = expanded.get(key) || false;
    d.append(el('summary', '', tr('Подробнее', 'Details')));
    const grid = el('div', 'oum-radio-facts'); grid.append(...facts); d.append(grid);
    d.addEventListener('toggle', () => expanded.set(key, d.open)); return d;
  }
  function netContent(net, associations, nativeButtons) {
    const n = el('div', 'oum-radio-network');
    n.append(el('strong', 'oum-radio-ssid', net.getActiveSSID() || '—'));
    const facts = el('div', 'oum-radio-network-facts');
    facts.append(fact(tr('Режим', 'Mode'), net.getActiveModeI18n()), fact(tr('Защита', 'Security'), net.getActiveEncryption()));
    if (associations != null) facts.append(fact(tr('Клиенты', 'Clients'), associations));
    if (net.isDisabled()) facts.append(el('span', '', tr('Сеть отключена', 'Network disabled')));
    n.append(facts, details('net-' + net.getName(), [fact('BSSID', net.getActiveBSSID())]));
    if (nativeButtons?.length) { const actions = el('div', 'oum-radio-extra-actions'); actions.append(...nativeButtons); n.append(actions); }
    return n;
  }
  function radioContent(radio, nets, includeNetworks, counts, buttons) {
    const n = el('div', 'oum-radio-content');
    const net = nets.find(n => !n.isDisabled() && n.getFrequency()) || nets[0];
    const head = el('div', 'oum-radio-title'); const name = el('strong', '', radio.getName());
    name.className = radio.isUp() ? 'is-up' : 'is-down';
    const freq = Number(net?.getFrequency());
    head.append(name, el('span', 'oum-radio-band', freq ? (freq < 3 ? '2.4' : freq < 6 ? '5' : '6') + ' ' + tr('ГГц', 'GHz') : ''));
    n.append(head, el('div', 'oum-radio-hardware', radio.getI18n().replace(/^Generic | Wireless Controller .+$/g, '')));
    const facts = el('div', 'oum-radio-facts');
    facts.append(fact(tr('Канал', 'Channel'), net?.getChannel() ? net.getChannel() + (freq ? ' (' + freq.toFixed(3) + ' ' + tr('ГГц', 'GHz') + ')' : '') : null), fact(tr('Битрейт', 'Bitrate'), net?.getBitRate() ? net.getBitRate() + ' ' + tr('Мбит/с', 'Mbit/s') : null));
    n.append(facts, details('radio-' + radio.getName(), [fact(tr('Шум', 'Noise'), net?.getNoise() ? net.getNoise() + ' dBm' : null), fact(tr('Мощность передачи', 'TX power'), net?.getTXPower() != null ? net.getTXPower() + ' dBm' : null), fact(tr('Код страны', 'Country code'), net?.getCountryCode())]));
    if (includeNetworks) for (const net of nets) n.append(netContent(net, counts?.get(net.getActiveSSID()), buttons?.get(net.getActiveSSID())));
    return n;
  }
  // Restore the last rendered nodes in the mutation microtask, before paint.
  // Native LuCI remains free to replace its cells; asynchronous reads no longer
  // expose that intermediate compact markup to the user.
  const retained = new WeakMap();
  const overviewRetained = new Map();
  const rawUpdates = new WeakMap();
  const dirty = new WeakSet();
  const watch = () => observer.observe(main, {childList:true, subtree:true});
  function stabilize() {
    observer.disconnect();
    if (page === 'admin-network-wireless') {
      for (const stat of main.querySelectorAll('#cbi-wireless-wifi-device [data-name="_stat"]')) {
        if (stat.querySelector('.oum-radio-content,.oum-radio-network') || !retained.has(stat)) continue;
        rawUpdates.set(stat, stat.cloneNode(true));
        dirty.add(stat);
        stat.replaceChildren(...retained.get(stat));
      }
    } else {
      for (const box of main.querySelectorAll('.ifacebox')) {
        if (box.querySelector('.oum-radio-content')) continue;
        const name = box.querySelector('.ifacebox-head strong')?.textContent.trim();
        if (!overviewRetained.has(name)) continue;
        const source = document.createElement('div');
        source.append(...box.childNodes);
        rawUpdates.set(box, source);
        dirty.add(box);
        box.dataset.oumRadioName = name;
        box.classList.add('oum-radio-card');
        box.replaceChildren(overviewRetained.get(name));
      }
    }
    watch();
  }
  let busy = false, queued = false, timer;
  let network;
  async function refresh() {
    if (busy) { queued = true; return; }
    busy = true;
    try {
      const [radios, nets] = await Promise.all([network.getWifiDevices(), network.getWifiNetworks()]);
      const clientCounts = new Map();
      if (page === 'admin-network-wireless') {
        const pendingNets = nets.filter(n => { const row = document.getElementById('cbi-wireless-' + n.getName()); return row && (!row.querySelector('.oum-radio-network') || dirty.has(row.querySelector('[data-name="_stat"]'))); });
        await Promise.all(pendingNets.map(async n => { try { clientCounts.set(n.getName(), (await n.getAssocList()).length); } catch (_) { /* Unknown count stays absent. */ } }));
      }
      observer.disconnect();
      if (page === 'admin-network-wireless') {
        for (const row of main.querySelectorAll('#cbi-wireless-wifi-device tr[data-sid]')) {
          const stat = row.querySelector('[data-name="_stat"]'); if (!stat || (stat.querySelector('.oum-radio-content,.oum-radio-network') && !dirty.has(stat))) continue;
          const notices = [...(rawUpdates.get(stat) || stat).querySelectorAll('em')];
          const radio = radios.find(r => r.getName() === row.dataset.sid);
          const net = nets.find(n => n.getName() === row.dataset.sid);
          if (radio) { stat.replaceChildren(radioContent(radio, nets.filter(n => n.getWifiDeviceName() === radio.getName()), false)); row.classList.add('oum-radio-row'); }
          else if (net) { stat.replaceChildren(netContent(net, clientCounts.get(net.getName()))); row.classList.add('oum-radio-net-row'); }
          if (notices.length) stat.append(...notices);
          retained.set(stat, [...stat.childNodes]); dirty.delete(stat); rawUpdates.delete(stat);
          const add = row.querySelector('button.cbi-button-add');
          if (add) add.textContent = tr('Добавить', 'Add');
        }
      } else {
        for (const box of main.querySelectorAll('.ifacebox')) {
          if (box.querySelector('.oum-radio-content') && !dirty.has(box)) continue;
          const source = rawUpdates.get(box) || box;
          const name = source.querySelector('.ifacebox-head strong')?.textContent.trim();
          const radio = radios.find(r => r.getName() === name); if (!radio) continue;
          const counts = new Map(), buttons = new Map();
          for (const badge of source.querySelectorAll('.ifacebadge')) {
            const values = [...badge.querySelectorAll('.nowrap')];
            const ssid = values.find(v => /^SSID/.test(v.textContent))?.textContent.replace(/^SSID:\s*/, '');
            const count = values.find(v => /^(Associations|Клиенты|Ассоциации)/.test(v.textContent));
            if (ssid && count) counts.set(ssid, count.textContent.replace(/^[^:]+:\s*/, ''));
            if (ssid) buttons.set(ssid, [...badge.querySelectorAll('button')]);
          }
          box.classList.add('oum-radio-card');
          box.replaceChildren(radioContent(radio, nets.filter(n => n.getWifiDeviceName() === name), true, counts, buttons));
          overviewRetained.set(name, box.firstElementChild); dirty.delete(box); rawUpdates.delete(box);
        }
      }
    } catch (error) { console.warn('OUM radio presentation:', error.message); }
    finally { observer.observe(main, {childList:true, subtree:true}); busy = false; if (queued) { queued = false; schedule(); } }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 80); }
  const observer = new MutationObserver(() => { stabilize(); schedule(); });
  L.require('network').then(n => { network = n; observer.observe(main, {childList:true, subtree:true}); refresh(); });
})();
