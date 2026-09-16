const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const text = fs.readFileSync(__dirname + '/../luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v64.js', 'utf8');
const code = text.slice(text.indexOf('const switchNodeConfirmed ='), text.indexOf('const waitDevicePolicy =')).replace('const switchNodeConfirmed =', 'globalThis.switchNodeConfirmed =');
async function scenario(statuses, expected) {
 const events = []; let reads = 0;
 const ctx = {beginRoutingProgress: () => ({applying: () => events.push('applying'), success: () => events.push('success'), failed: () => events.push('failed')}), callSelectNode: async () => ({ok:true, engine:'passwall', applying:true}), callNodeStatus: async () => statuses[Math.min(reads++, statuses.length-1)], updateNodes: () => {}, window:{setTimeout: f => f()}};
 vm.runInNewContext(code, ctx);
 try { await ctx.switchNodeConfirmed('target'); } catch (_) {}
 assert.equal(events.at(-1), expected);
 assert.ok(reads >= 3, 'must await application, not just command acceptance');
 return events;
}
(async () => {
 await scenario([{applying:true}, {applying:false,current_id:'target'}], 'success');
 await scenario([{applying:false,current_id:'old'}], 'failed');
 await scenario([{applying:true}], 'failed');
 console.log('Node progress: completion, rollback and timeout OK');
})().catch(e => { console.error(e); process.exit(1); });
