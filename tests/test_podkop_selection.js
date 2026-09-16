const fs = require('fs');
const assert = require('assert/strict');
const vm = require('vm');
const cp = require('child_process');
const os = require('os');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v64.js'), 'utf8');
const selection = source.slice(source.indexOf('const selectedCommunities ='), source.indexOf('const selectedYoutubeMode ='));
for (const mode of ['vpn', 'direct']) {
 const root = { querySelectorAll: () => [
  {value:'vpn', dataset:{communityRoute:'russia_inside'}},
  {value:'direct', dataset:{communityRoute:'telegram'}},
  {value:'direct', dataset:{communityRoute:'google_ai'}},
  {value:mode, dataset:{communityRoute:'youtube'}}
 ] };
 const result = vm.runInNewContext(selection + ';[selectedCommunities("vpn"), selectedCommunities("direct")]', {root});
 assert.equal(result[0], mode === 'vpn' ? 'russia_inside\nyoutube' : 'russia_inside');
 assert.equal(result[1], mode === 'direct' ? 'youtube' : '');
}
const backend = fs.readFileSync(path.join(__dirname, '../luci-app-oum/root/usr/libexec/oum-podkop-config'), 'utf8');
const start = backend.indexOf('\tgrep -Fvx youtube "$tmp/proxy_lists"');
const end = backend.indexOf('\n\t# GearUP', start);
assert(start >= 0 && end > start);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oum-selection-test-'));
try {
 for (const mode of ['vpn','zapret']) {
  fs.writeFileSync(path.join(tmp,'proxy_lists'), 'russia_inside\nyoutube\n');
  fs.writeFileSync(path.join(tmp,'direct_lists'), 'telegram\ngoogle_ai\nyoutube\n');
  cp.execFileSync('sh', ['-eu','-c',backend.slice(start,end)], {env:{...process.env,tmp,youtube_mode:mode}});
  assert.equal(fs.readFileSync(path.join(tmp,'proxy_lists'),'utf8'),mode==='vpn'?'russia_inside\nyoutube\n':'russia_inside\n');
  assert.equal(fs.readFileSync(path.join(tmp,'direct_lists'),'utf8'),mode==='zapret'?'youtube\n':'');
 }
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
console.log('Podkop selection: unchecked lists omitted; YouTube VPN/Zapret preserved, including cached requests.');
