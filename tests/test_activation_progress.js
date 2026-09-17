'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v64.js', 'utf8');
const paint = source.slice(source.indexOf('\t\tconst showVpnJob ='), source.indexOf('\t\tconst watchVpnJob ='));
const activation = source.slice(source.indexOf('\t\tconst openActivationSheet ='), source.indexOf('\t\tconst openVpnSheet ='));
const desktop = source.slice(source.indexOf("\t\timportButton.addEventListener('click'"), source.indexOf("\n\n\t\troot.querySelector('#apply-wifi')"));

function fixture(kind, jobs, startResult = { ok: true }) {
  let document;
  class Element {
    constructor(tag, attrs = {}, children = []) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.style = {}; this.dataset = {};
      this.hidden = attrs.hidden != null; this.disabled = false; this.listeners = {};
      this.children = []; this._text = ''; this.value = '';
      this.classList = { add() {}, remove() {} };
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('data-')) this.dataset[key.slice(5)] = value;
      }
      if (typeof children === 'string') this.textContent = children;
      else for (const child of [].concat(children)) this.appendChild(child);
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
    get firstChild() { return this.children[0]; }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(value) { this._text = value; this.children = []; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    focus() { document.activeElement = this; }
    matches(selector) {
      if (selector[0] === '.') return (this.attrs.class || '').split(' ').includes(selector.slice(1));
      if (selector[0] === '#') return this.attrs.id === selector.slice(1);
      if (selector[0] === '[') return Object.hasOwn(this.attrs, selector.slice(1, -1));
      return this.tagName === selector.toUpperCase();
    }
    querySelectorAll(selector) { return this.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const E = (tag, attrs, children) => new Element(tag, attrs, children);
  document = { body: E('body'), addEventListener() {}, removeEventListener() {}, getElementById(id) { return this.body.querySelector('#' + id); } };
  const importButton = document.body.appendChild(E('button', { id: 'import-source' }));
  const vpnJobNode = document.body.appendChild(E('div', { id: 'vpn-job-status' }));
  const configInput = document.body.appendChild(E('textarea')); configInput.value = 'test input';
  document.activeElement = importButton;
  const timers = [], starts = [], context = {
    E, document, importButton, vpnJobNode, configInput, selectedSource: kind,
    window: { setTimeout: fn => timers.push(fn) },
    resultError(result, message) { if (!result.ok) throw Error(result.message || message); },
    callStartVpnImport: async (kind, payload) => { starts.push({ kind, payload }); return startResult; },
    callVpnJobStatus: async () => { assert(jobs.length, 'unexpected status poll'); return jobs.shift(); }
  };
  vm.runInNewContext(paint + activation + desktop + '\nglobalThis.open = openActivationSheet;', context);
  return { context, importButton, vpnJobNode, configInput, timers, starts,
    sheet: () => document.getElementById('oum-activation-sheet'),
    flush: async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); },
    click: () => importButton.listeners.click({ preventDefault() {} }) };
}

(async () => {
  // Execute the actual desktop button: it must open the shared dialog, not just status text.
  const f = fixture('subscription', [
    { state: 'running', code: 'downloading', message: 'Загружаем подписку' },
    { state: 'running', code: 'importing', message: 'Импортируем' },
    { state: 'success', code: 'active', message: 'PassWall активирован' }
  ]);
  f.click();
  assert.equal(f.sheet().hidden, false);
  assert.equal(f.sheet().querySelector('.oum-act-title').textContent, 'Активация подписки');
  assert.equal(f.vpnJobNode.hidden, true);
  assert.equal(f.importButton.disabled, true);
  f.click(); // A second request must not duplicate an active import.
  assert.equal(f.starts.length, 1);
  await f.flush();
  assert.equal(f.sheet().querySelectorAll('.oum-act-step')[1].dataset.state, 'active');
  assert.equal(f.configInput.value, '');
  f.timers.shift()(); await f.flush();
  assert.equal(f.sheet().querySelectorAll('.oum-act-step')[2].dataset.state, 'active');
  f.sheet().querySelector('[data-act-close]').listeners.click();
  assert.equal(f.sheet().hidden, true);
  assert.equal(f.vpnJobNode.hidden, false);
  assert.equal(f.importButton.disabled, true, 'hiding the dialog must not allow concurrent imports');
  f.timers.shift()(); await f.flush();
  assert.equal(f.importButton.disabled, false, 'hidden jobs still reach completion');
  assert.equal(f.sheet().querySelector('.oum-act-fill').style.width, '100%');
  assert.equal(f.vpnJobNode.textContent, 'PassWall активирован');

  for (const kind of ['awg', 'proxy']) {
    const f = fixture(kind, [{ state: 'failed', code: 'activation_failed', message: 'Прежнее подключение восстановлено' }]);
    f.context.open(kind, 'test input'); await f.flush(); // Mobile and desktop share the same entry point.
    assert.equal(f.sheet().querySelectorAll('.oum-act-step').length, 2);
    assert.equal(f.sheet().querySelectorAll('.oum-act-step')[1].dataset.state, 'failed');
    assert.equal(f.sheet().querySelector('.oum-act-result').hidden, false);
    assert.equal(f.sheet().querySelector('[data-act-close]').textContent, 'Закрыть');
    assert.equal(f.importButton.disabled, false);
  }
  const empty = fixture('subscription', []); empty.configInput.value = ''; empty.click();
  assert.equal(empty.starts.length, 0);
  assert.match(empty.sheet().querySelector('.oum-act-result').textContent, /Введите данные/);
  assert.equal(empty.importButton.disabled, false);
  const failed = fixture('subscription', [], { ok: false, message: 'Импорт уже выполняется' });
  failed.click(); await failed.flush();
  assert.equal(failed.configInput.value, 'test input', 'rejected requests retain the input');
  assert.equal(failed.sheet().querySelector('.oum-act-result').textContent, 'Импорт уже выполняется');
  assert.equal(failed.importButton.disabled, false);
  const address = source.match(/const smbAddress = ([^;]+);/)[1];
  for (const ip of ['192.168.5.1', '192.168.1.1']) {
    assert.equal(vm.runInNewContext(address, { lan: { address: ip } }), 'smb://' + ip + '/OUM');
  }
  console.log('Activation progress: desktop/mobile, stages, failure, hide/completion, duplicate guard and SMB address OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
