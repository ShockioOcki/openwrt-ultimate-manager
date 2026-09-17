'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,
  '../luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v64.js'), 'utf8');
const handlers = source.slice(source.indexOf('\t\tlet projectUpdate = null;'),
  source.indexOf("\t\troot.querySelector('#rollback-project').addEventListener"));
assert(handlers.length > 0);

async function main() {
  const nodes = Object.fromEntries(['check-project-update', 'update-project', 'project-update-status']
    .map(id => ['#' + id, { hidden: true, disabled: false, textContent: '',
      addEventListener(type, handler) { this.click = handler; } }]));
  let response, resolveCheck, confirmed = false;
  const installs = [];
  vm.runInNewContext(handlers, {
    root: { querySelector: selector => nodes[selector] }, projectVersion: '0.0.1',
    callCheckProjectUpdate: () => response || new Promise(resolve => { resolveCheck = resolve; }),
    resultError: result => { if (!result.ok) throw new Error(result.message); return result; },
    confirmation: async () => confirmed,
    callUpdateProject: (revision, version) => { installs.push({ revision, version }); return Promise.resolve(); },
    start: promise => promise
  });
  const check = nodes['#check-project-update'], update = nodes['#update-project'];
  const status = nodes['#project-update-status'];

  // A check is read-only, including while a new release is being discovered.
  const pending = check.click();
  assert.equal(check.disabled, true);
  assert.equal(update.hidden, true);
  assert.equal(installs.length, 0);
  resolveCheck({ ok: true, available: true, version: '0.0.2', revision: 'a'.repeat(40) });
  await pending;
  assert.equal(check.disabled, false);
  assert.equal(update.hidden, false);
  assert.equal(update.textContent, 'Обновить до 0.0.2');
  assert.equal(installs.length, 0);

  // Cancelling cannot install; confirmation installs exactly the checked target.
  await update.click();
  assert.equal(installs.length, 0);
  confirmed = true;
  await update.click();
  assert.deepEqual(installs, [{ revision: 'a'.repeat(40), version: '0.0.2' }]);

  // Failed and up-to-date checks both invalidate an earlier offer.
  response = { ok: false, message: 'Нет доступа к серверу обновлений.' };
  await check.click();
  assert.equal(update.hidden, true);
  assert.equal(status.textContent, response.message);
  assert.equal(check.disabled, false);
  await update.click();
  assert.equal(installs.length, 1);

  response = { ok: true, available: false, version: '0.0.1' };
  await check.click();
  assert.equal(update.hidden, true);
  assert.match(status.textContent, /Обновлений нет/);
  console.log('Project update UI: check, offer, confirmation, current version and retry OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
