// Exercise the real mobile Apply handler with lightweight DOM doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v64.js', 'utf8');
const match = source.match(/click: (\(\) => \{\s*for \(const id of \['dns-current', 'bootstrap-dns-current'\][\s\S]*?\n\s*\}) \}, 'Применить DNS'/);
assert.ok(match, 'mobile DNS Apply handler exists');
const original = { 'dns-current': { value: '1.1.1.1' }, 'bootstrap-dns-current': { value: '1.0.0.1' } };
const mobile = { 'dns-current-mobile': { value: '8.8.8.8' }, 'bootstrap-dns-current-mobile': { value: '8.8.4.4' } };
let submitted;
const apply = vm.runInNewContext(match[1], {
  customDNS: { querySelector: selector => mobile[selector.slice(1)] },
  dnsSection: { querySelector: selector => original[selector.slice(1)] },
  document: { getElementById: id => {
    assert.equal(id, 'apply-engine-dns');
    return { click: () => { submitted = Object.values(original).map(s => s.value); } };
  } }
});
apply();
assert.deepEqual(submitted, ['8.8.8.8', '8.8.4.4']);
mobile['dns-current-mobile'].value = '9.9.9.9';
apply();
assert.deepEqual(submitted, ['9.9.9.9', '8.8.4.4']);
assert.ok(source.includes('VPN-движок будет кратковременно перезапущен.'));
console.log('Mobile DNS selected values: OK');
