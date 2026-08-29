'use strict';
'require view';
'require rpc';
'require poll';

const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });
const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });
const callNodeStatus = rpc.declare({ object: 'oum', method: 'nodeStatus', expect: { '': {} } });
const callMeasureNodeDelays = rpc.declare({ object: 'oum', method: 'measureNodeDelays', expect: { '': {} } });
const callSelectNode = rpc.declare({ object: 'oum', method: 'selectNode', params: [ 'name' ], expect: { '': {} } });
const callSetVpnEnabled = rpc.declare({ object: 'oum', method: 'setVpnEnabled', params: [ 'enabled' ], expect: { '': {} } });
const callSetDevicePolicy = rpc.declare({ object: 'oum', method: 'setDevicePolicy', params: [ 'mac', 'policy' ], expect: { '': {} } });
const callSetDeviceAlias = rpc.declare({ object: 'oum', method: 'setDeviceAlias', params: [ 'mac', 'alias' ], expect: { '': {} } });
const callSetDevicePaused = rpc.declare({ object: 'oum', method: 'setDevicePaused', params: [ 'mac', 'paused' ], expect: { '': {} } });
const callRefreshSubscriptionInfo = rpc.declare({ object: 'oum', method: 'refreshSubscriptionInfo', expect: { '': {} } });
const callPodkopRoutingStatus = rpc.declare({ object: 'oum', method: 'podkopRoutingStatus', expect: { '': {} } });
const callApplyPodkopRouting = rpc.declare({ object: 'oum', method: 'applyPodkopRouting', params: [ 'proxy_lists', 'proxy_domains', 'proxy_subnets', 'direct_lists', 'direct_domains', 'direct_subnets', 'youtube_mode' ], expect: { '': {} } });
const callPodkopDiagnostics = rpc.declare({ object: 'oum', method: 'podkopDiagnostics', expect: { '': {} } });
const callSetZapretQuic = rpc.declare({ object: 'oum', method: 'setZapretQuic', params: [ 'enabled' ], expect: { '': {} } });
const callPrepareZapretManager = rpc.declare({ object: 'oum', method: 'prepareZapretManager', expect: { '': {} } });
const callSystemJobStatus = rpc.declare({ object: 'oum', method: 'systemJobStatus', expect: { '': {} } });
const sourceNames = { none: 'Не настроено', subscription: 'Subscription', awg: 'AWG Tunnel', proxy: 'Reality / Proxy', passwall: 'PassWall', podkop: 'Podkop + Zapret' };

function countryKey(name) {
	const flag = String(name).match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
	if (flag)
		return Array.from(flag[0]).map((symbol) =>
			String.fromCharCode(65 + symbol.codePointAt(0) - 0x1F1E6)).join('');
	const normalized = String(name).toLowerCase();
	if (/(?:финлянд|finland|helsinki)/.test(normalized)) return 'FI';
	if (/(?:нидерланд|netherland|holland|amsterdam)/.test(normalized)) return 'NL';
	const code = String(name).match(/(?:^|[\s_|+\-])([A-Z]{2})(?:$|[\s_|+\-])/);
	return code ? code[1] : '';
}

function sortedNodes(nodes) {
	return (nodes || []).slice().sort((a, b) => {
		const ad = a.delay > 0 ? a.delay : Number.MAX_SAFE_INTEGER;
		const bd = b.delay > 0 ? b.delay : Number.MAX_SAFE_INTEGER;
		return ad - bd || a.name.localeCompare(b.name);
	});
}

function preferredNodes(nodeStatus) {
	const currentKey = nodeStatus.current_id || nodeStatus.current;
	const sorted = sortedNodes(nodeStatus.nodes).filter((node) => (node.id || node.name) !== currentKey);
	const result = [], countries = new Set();
	for (const required of [ 'FI', 'NL' ]) {
		const node = sorted.find((candidate) => countryKey(candidate.name) === required);
		if (!node) continue;
		result.push(node);
		countries.add(required);
	}
	for (const node of sorted) {
		if (result.includes(node)) continue;
		const country = countryKey(node.name);
		if (country && countries.has(country)) continue;
		result.push(node);
		if (country) countries.add(country);
		if (result.length === 6) return result;
	}
	for (const node of sorted) {
		if (!result.includes(node)) result.push(node);
		if (result.length === 6) break;
	}
	return result;
}

function policySelect(client) {
	return E('select', { 'class': 'oum-policy', 'data-mac': client.mac }, [
		E('option', { value: 'default', selected: client.policy === 'default' ? '' : null }, 'По общим правилам'),
		E('option', { value: 'direct', selected: client.policy === 'direct' ? '' : null }, 'Всегда напрямую'),
		E('option', { value: 'vpn', selected: client.policy === 'vpn' ? '' : null }, 'Полностью через VPN')
	]);
}

function validDeviceAlias(alias) {
	return Array.from(alias).length <= 32 && /^[\p{L}\p{N} _.\-]*$/u.test(alias);
}

function loadQrLibrary() {
	const load = (path) => new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = L.resource(`view/oum/${path}`);
		script.onload = resolve;
		script.onerror = () => reject(new Error('Не удалось загрузить локальный генератор QR.'));
		document.head.appendChild(script);
	});
	const main = window.qrcode ? Promise.resolve() : load('qrcode.min.js');
	return main.then(() => window.qrcode?.stringToBytesFuncs?.['UTF-8'] ? null : load('qrcode_UTF8.js'));
}

function escapeWifiQr(value) {
	return String(value || '').replace(/[\\;,":]/g, '\\$&');
}

function drawQr(canvas, text) {
	window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
	const code = window.qrcode(0, 'M');
	code.addData(text, 'Byte');
	code.make();
	const count = code.getModuleCount();
	const quiet = 4;
	const logicalSize = 200;
	const scale = Math.max(1, Math.floor(logicalSize / (count + quiet * 2)));
	const size = (count + quiet * 2) * scale;
	const ratio = window.devicePixelRatio || 1;
	canvas.width = size * ratio;
	canvas.height = size * ratio;
	canvas.style.width = `${size}px`;
	canvas.style.height = `${size}px`;
	const ctx = canvas.getContext('2d');
	ctx.scale(ratio, ratio);
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, size, size);
	ctx.fillStyle = '#000';
	for (let row = 0; row < count; row++)
		for (let col = 0; col < count; col++)
			if (code.isDark(row, col)) ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
}

function formatBytes(value) {
	let amount = Math.max(0, Number(value) || 0);
	const units = [ 'Б', 'КБ', 'МБ', 'ГБ', 'ТБ' ];
	let unit = 0;
	while (amount >= 1024 && unit < units.length - 1) {
		amount /= 1024;
		unit++;
	}
	return `${amount.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function formatUptime(seconds) {
	const days = Math.floor(Number(seconds || 0) / 86400);
	const hours = Math.floor((Number(seconds || 0) % 86400) / 3600);
	return days > 0 ? `${days}д ${hours}ч` : `${hours}ч`;
}

function trafficCell(traffic) {
	const points = (traffic?.points || []).map(Number);
	const max = Math.max(...points, 1);
	const width = 58, height = 14;
	const coords = points.length > 1 ? points.map((point, index) => `${Math.round(index * width / (points.length - 1))},${Math.round(height - point * height / max)}`).join(' ') : '';
	return E('td', { 'class': 'oum-traffic-cell' }, [
		E('span', {}, `${formatBytes(traffic?.down || 0)} ↓ · ${formatBytes(traffic?.up || 0)} ↑`),
		coords ? E('svg', { viewBox: `0 0 ${width} ${height}`, width, height, 'aria-hidden': 'true' }, E('polyline', { points: coords, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })) : ''
	]);
}

return view.extend({
	load() { return Promise.all([ callStatus(), callDashboardStatus(), callNodeStatus(), callPodkopRoutingStatus() ]); },

	render(data) {
		const status = data[0];
		const dashboard = data[1];
		const initialNodes = data[2];
		const podkopRouting = data[3] || { catalog: [], proxy: {}, direct: {} };
		if (!status.setup_complete)
			return E('div', {}, [
				E('h2', {}, 'OUM'),
				E('p', {}, 'Сначала завершите базовую настройку роутера.'),
				E('a', { class: 'btn cbi-button-action', href: L.url('oum', 'setup') }, 'Открыть мастер')
			]);

		const dashboardHost = window.location.hostname.includes(':') ? `[${window.location.hostname}]` : window.location.hostname;
		const zashboardUrl = `http://${dashboardHost}:9090/ui/zashboard/`;
		const routingSet = (values) => new Set(values || []);
		const proxyRoutes = routingSet(podkopRouting.proxy?.lists);
		const youtubeInitialMode = dashboard.podkop?.youtube_mode || (proxyRoutes.has('youtube') ? 'vpn' : 'zapret');
		const categoryDefinitions = [
			[ 'Основные правила', [ 'russia_inside', 'russia_outside', 'geoblock', 'block', 'youtube' ], true ],
			[ 'Социальные сети', [ 'discord', 'meta', 'twitter', 'telegram', 'tiktok' ], false ],
			[ 'Видео и развлечения', [ 'hdrezka', 'anime', 'roblox', 'porn' ], false ],
			[ 'Google и AI', [ 'google_ai', 'google_play' ], false ],
			[ 'Инфраструктура', [ 'cloudflare', 'cloudfront', 'digitalocean', 'hetzner', 'ovh' ], false ],
			[ 'Дополнительно', [ 'news', 'hodca' ], false ]
		];
		const catalogById = Object.fromEntries((podkopRouting.catalog || []).map((item) => [ item.id, item ]));
		const routeRow = (item) => {
			const viaVpn = item.id === 'youtube' ? youtubeInitialMode === 'vpn' : proxyRoutes.has(item.id);
			return E('div', { 'class': 'oum-route-row', 'data-route-row': item.id }, [
				E('div', { 'class': 'oum-route-service' }, [
					E('strong', {}, item.label),
					...(item.id === 'youtube' ? [ E('small', {}, viaVpn ? 'Zapret остановлен' : 'обрабатывается Zapret') ] : [])
				]),
				E('div', { 'class': 'oum-route-switch' }, [
					E('label', {}, [ E('input', { type: 'radio', name: `route_${item.id}`, value: 'vpn', 'data-community-route': item.id, checked: viaVpn ? '' : null }), E('span', {}, 'Через VPN') ]),
					E('label', {}, [ E('input', { type: 'radio', name: `route_${item.id}`, value: 'direct', 'data-community-route': item.id, checked: !viaVpn ? '' : null }), E('span', {}, item.id === 'youtube' ? 'Напрямую + Zapret' : 'Напрямую') ])
				])
			]);
		};
		const communityCatalog = () => E('div', { 'class': 'oum-route-catalog' }, categoryDefinitions.map(([ title, ids, open ]) =>
			E('details', { 'class': 'oum-route-category', open: open ? '' : null }, [
				E('summary', {}, [ E('strong', {}, title), E('span', { 'class': 'oum-muted' }, `${ids.filter((id) => catalogById[id]).length} сервисов`) ]),
				E('div', { 'class': 'oum-route-category-list' }, ids.filter((id) => catalogById[id]).map((id) => routeRow(catalogById[id])))
			])));

		const root = E('div', { 'class': 'oum-dashboard' }, [
			E('style', {}, `
				.oum-dashboard{max-width:1050px;margin:0 auto}.oum-page-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-page-head h2{margin:0}.oum-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}
				.oum-card,.oum-panel{border:1px solid #ccd3dc;border-radius:12px;padding:16px}.oum-card small{display:block;opacity:.7;margin-bottom:8px}.oum-card strong{font-size:1.1rem}.oum-vpn-card-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.oum-vpn-card-row button{padding:4px 9px}.oum-card-message{font-size:.82em;margin-top:7px;min-height:1.2em}
				.oum-clients{width:100%;border-collapse:collapse}.oum-clients th,.oum-clients td{text-align:left;padding:9px 7px;border-bottom:1px solid #e1e5ea}.oum-clients th{opacity:.7;font-size:.9em}.oum-device-cell{min-width:180px}.oum-device-name-row,.oum-device-alias-form{display:flex;align-items:center;gap:8px;min-width:0}.oum-device-name{min-width:0;overflow-wrap:anywhere}.oum-device-rename{padding:5px 8px;min-height:32px;white-space:nowrap}.oum-device-alias-form input{min-width:120px;max-width:220px;height:36px}.oum-policy{min-width:180px}.oum-policy-message{min-height:1.4em;margin-top:10px}.oum-policy-message[data-state="failed"]{color:#c0392b}.oum-client-paused{opacity:.55}.oum-device-help{margin:0 0 12px}.oum-offline{margin-top:14px}.oum-offline>summary{cursor:pointer;font-weight:600;padding:8px 0}.oum-pause-button{white-space:nowrap}.oum-health{font-size:.95rem!important;line-height:1.45}.oum-health[data-temperature="warm"]{color:#b27b19}.oum-health[data-temperature="hot"]{color:#c94b4b}.oum-traffic-cell{min-width:145px;font-variant-numeric:tabular-nums}.oum-traffic-cell span{display:block;white-space:nowrap;font-size:.86em}.oum-traffic-cell svg{display:block;margin-top:4px;color:#2673ec;opacity:.8}
				.oum-muted{opacity:.68}.oum-warning{padding:12px 14px;border:1px solid #b28a29;background:rgba(178,138,41,.16);border-radius:10px;margin-top:14px;line-height:1.45}.oum-panels{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px}
				.oum-node-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-current-node{padding:13px;border-radius:9px;background:rgba(127,127,127,.1);margin:10px 0 8px}.oum-node-list{display:grid;gap:8px}.oum-node-quick,.oum-node-all-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
				.oum-node-actions,.oum-subscription-head{display:flex;align-items:center;gap:8px}.oum-subscription{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d8dde5}.oum-subscription-head{justify-content:space-between;flex-wrap:wrap}.oum-subscription-head h3{margin:0}.oum-subscription-status{min-width:0;flex:1;font-size:.92em}.oum-qr-wrap{display:grid;justify-items:center;gap:12px}.oum-qr-wrap canvas{background:#fff;border-radius:8px}
				.oum-node{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:start;padding:10px 12px;border:1px solid #d8dde5;border-radius:9px}.oum-node>span:first-child{min-width:0;white-space:normal;overflow-wrap:anywhere;line-height:1.35}.oum-node .btn{white-space:nowrap}.oum-delay{min-width:62px;text-align:right;white-space:nowrap}
				.oum-node-title{font-weight:600;margin:14px 0 9px}.oum-node-hint{font-size:.86em;margin:2px 0 8px}.oum-node-message{min-height:1.4em;margin:6px 0}.oum-node-message[data-state="failed"]{color:#c0392b}
				.oum-node-all{margin-top:13px}.oum-node-all>summary{cursor:pointer;font-weight:600;padding:4px 0}.oum-node-all[open]>summary{margin-bottom:10px}
				.oum-passwall-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.oum-passwall-state{border:1px solid #d8dde5;border-radius:9px;padding:11px}.oum-passwall-state small{display:block;opacity:.68;margin-bottom:5px}.oum-passwall-state strong[data-ok="false"],.oum-passwall-diagnostic strong[data-ok="false"]{color:#c0392b}.oum-passwall-route{background:rgba(127,127,127,.1);border-radius:9px;padding:12px;margin-top:12px}.oum-passwall-route small{display:block;margin-bottom:4px}.oum-passwall-versions{margin-top:12px}.oum-passwall-rules{margin-top:8px}.oum-passwall-diagnostics{margin-top:12px}.oum-passwall-diagnostics>summary{cursor:pointer;font-weight:600}.oum-passwall-diagnostic-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.oum-passwall-diagnostic{border:1px solid #d8dde5;border-radius:9px;padding:10px}.oum-passwall-diagnostic small{display:block;opacity:.68;margin-bottom:4px}.oum-node-controls[data-engine="passwall"]{border-top:1px solid #d8dde5;margin-top:16px;padding-top:14px}
				.oum-tabs{display:flex;gap:6px;border-bottom:1px solid #ccd3dc;margin:16px 0 13px}.oum-tab{border:0;background:transparent;padding:9px 13px;border-bottom:3px solid transparent;cursor:pointer}.oum-tab[data-active="true"]{border-color:#2673ec;color:#2673ec;font-weight:600}.oum-route-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:13px;border-radius:10px;background:rgba(127,127,127,.1);margin-bottom:12px}.oum-route-intro strong{display:block;margin-bottom:4px}.oum-route-catalog{display:grid;gap:9px}.oum-route-category{border:1px solid #d8dde5;border-radius:10px;overflow:hidden}.oum-route-category>summary{display:flex;justify-content:space-between;cursor:pointer;padding:12px 14px}.oum-route-category[open]>summary{border-bottom:1px solid #d8dde5}.oum-route-category-list{display:grid}.oum-route-row{display:grid;grid-template-columns:minmax(180px,1fr) auto;align-items:center;gap:12px;padding:10px 13px;border-bottom:1px solid #e4e8ed}.oum-route-row:last-child{border-bottom:0}.oum-route-service small{display:block;opacity:.65;margin-top:3px}.oum-route-switch{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ccd3dc;border-radius:8px;overflow:hidden}.oum-route-switch label{cursor:pointer}.oum-route-switch input{position:absolute;opacity:0;pointer-events:none}.oum-route-switch span{display:block;padding:7px 11px;text-align:center;min-width:105px}.oum-route-switch label:has(input:checked) span{background:#2673ec;color:white}.oum-custom-rules{border:1px solid #d8dde5;border-radius:10px;margin-top:12px;padding:0 13px}.oum-custom-rules>summary{cursor:pointer;font-weight:600;padding:12px 0}.oum-custom-rules[open]>summary{border-bottom:1px solid #d8dde5}.oum-route-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:13px 0}.oum-route-box{border:1px solid #d8dde5;border-radius:10px;padding:13px}.oum-route-box h4{margin:0 0 5px}.oum-route-box textarea{width:100%;min-height:92px;box-sizing:border-box;margin-top:6px}.oum-route-label{display:block;font-weight:600;margin-top:11px}.oum-route-actions{position:sticky;bottom:0;display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:14px;padding:11px;background:rgba(127,127,127,.1);color:inherit;border:1px solid #d8dde5;border-radius:10px}.oum-route-message{margin-right:auto}.oum-route-message[data-state="failed"]{color:#c0392b}
				.oum-diagnostic-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(250px,1fr);gap:12px}.oum-diagnostic-run{width:100%;margin-bottom:10px}.oum-diagnostic-sections{display:grid;gap:10px}.oum-diagnostic-section{border:2px solid #2b9b68;border-radius:8px;padding:12px}.oum-diagnostic-section[data-state="warning"]{border-color:#b28a29}.oum-diagnostic-section[data-state="error"]{border-color:#c94b4b}.oum-diagnostic-title{display:flex;align-items:flex-start;gap:10px}.oum-diagnostic-icon{font-size:1.25rem;line-height:1}.oum-diagnostic-title strong{display:block}.oum-diagnostic-items{display:grid;gap:5px;margin:10px 0 0 32px}.oum-diagnostic-item{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:6px;align-items:start}.oum-diagnostic-item[data-state="success"] .oum-diagnostic-mark{color:#2b9b68}.oum-diagnostic-item[data-state="warning"] .oum-diagnostic-mark{color:#b28a29}.oum-diagnostic-item[data-state="error"] .oum-diagnostic-mark{color:#c94b4b}.oum-diagnostic-value{opacity:.72;text-align:right}.oum-diagnostic-side{display:grid;align-content:start;gap:10px}.oum-diagnostic-side-card{border:1px solid #d8dde5;border-radius:9px;padding:12px}.oum-diagnostic-side-card h4{margin:0 0 10px}.oum-diagnostic-actions{display:grid;gap:8px}.oum-system-info{display:grid;grid-template-columns:auto 1fr;gap:7px 9px;font-size:.9em}.oum-system-info strong{white-space:nowrap}.oum-expert-tools>summary{cursor:pointer;font-weight:600}.oum-expert-tools p{font-size:.86em}
				@media(max-width:900px){.oum-cards,.oum-passwall-grid{grid-template-columns:1fr 1fr}.oum-node-quick,.oum-node-all-grid,.oum-passwall-diagnostic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.oum-route-columns,.oum-diagnostic-layout{grid-template-columns:1fr}.oum-community-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.oum-cards,.oum-node-quick,.oum-node-all-grid,.oum-passwall-grid,.oum-passwall-route,.oum-passwall-diagnostic-grid,.oum-community-grid{grid-template-columns:1fr}.oum-clients .optional{display:none}.oum-diagnostic-item{grid-template-columns:18px 1fr}.oum-diagnostic-value{grid-column:2;text-align:left}}
			`),
			E('div', { 'class': 'oum-page-head' }, [
				E('h2', {}, 'OUM'),
				E('a', { 'class': 'btn cbi-button', href: L.url('oum', 'logout') }, 'Выйти')
			]),
			E('div', { 'class': 'oum-warning', id: 'unmanaged-tunnel-warning', hidden: '' }),
			E('div', { 'class': 'oum-warning', id: 'reboot-required-warning', hidden: '' }, 'После замены VPN-движка рекомендуется перезагрузить роутер из раздела «Настройки».'),
			E('div', { 'class': 'oum-cards' }, [
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Интернет'), E('strong', { id: 'wan-state' }, ''), E('div', { id: 'wan-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Клиенты'), E('strong', { id: 'client-count' }, '0'), E('div', { id: 'wifi-detail', 'class': 'oum-muted' }, ''), E('button', { 'class': 'btn cbi-button', id: 'show-wifi-qr' }, 'Показать QR') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Состояние'), E('strong', { id: 'health-state', 'class': 'oum-health' }, '—') ]),
				E('div', { 'class': 'oum-card' }, [
					E('small', {}, 'VPN-движок'),
					E('div', { 'class': 'oum-vpn-card-row' }, [
						E('strong', { id: 'active-source' }, sourceNames[dashboard.active_source] || dashboard.active_source),
						E('button', { 'class': 'btn cbi-button', id: 'vpn-toggle' }, '')
					]),
					E('div', { 'class': 'oum-card-message oum-muted', id: 'vpn-control-message' }, '')
				])
			]),
			E('div', { 'class': 'oum-panels' }, [
				E('section', { 'class': 'oum-panel', id: 'devices-panel' }, [
					E('h3', {}, 'Подключённые устройства'),
					E('p', { 'class': 'oum-muted oum-device-help' }, 'Не знаешь, какое это устройство? Выключи его — оно пропадёт из списка примерно через 10 секунд. После этого его можно переименовать в разделе «Недавно были». '),
					E('table', { 'class': 'oum-clients' }, [
						E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'IP-адрес'), E('th', {}, 'Подключение'), E('th', { 'class': 'optional' }, 'MAC'), E('th', {}, 'Трафик за 24 ч'), E('th', {}, 'Маршрутизация'), E('th', {}, 'Доступ') ])),
						E('tbody', { id: 'client-list' })
					]),
					E('details', { 'class': 'oum-offline', id: 'offline-section', hidden: '' }, [
						E('summary', { id: 'offline-summary' }, 'Недавно были (офлайн)'),
						E('table', { 'class': 'oum-clients' }, [
							E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'Последний IP'), E('th', { 'class': 'optional' }, 'MAC'), E('th', {}, 'Маршрутизация'), E('th', {}, 'Доступ') ])),
							E('tbody', { id: 'offline-client-list' })
						])
					]),
					E('div', { 'class': 'oum-policy-message oum-muted', id: 'policy-message' }, 'Режим применяется к выбранному устройству и сохраняется после перезагрузки.')
				]),
				E('section', { 'class': 'oum-panel', id: 'node-panel', hidden: '' }, [
					E('div', { 'class': 'oum-subscription', id: 'subscription-panel', hidden: '' }, [
						E('div', { 'class': 'oum-subscription-head' }, [
							E('h3', {}, 'Подписка'),
							E('span', { 'class': 'oum-subscription-status oum-muted', id: 'subscription-status', title: 'Данные обновляются автоматически каждые 30 минут.' }, '—'),
							E('button', { 'class': 'btn cbi-button', id: 'refresh-subscription' }, 'Обновить')
						])
					]),
					E('div', { id: 'passwall-panel', hidden: '' }, [
						E('div', { 'class': 'oum-node-head' }, [
							E('h3', {}, 'PassWall'),
							E('span', { 'class': 'oum-muted', id: 'passwall-version' }, '')
						]),
						E('div', { 'class': 'oum-passwall-grid' }, [
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Xray'), E('strong', { id: 'passwall-xray' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'DNS'), E('strong', { id: 'passwall-dns' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Маршрутизация'), E('strong', { id: 'passwall-firewall' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'GeoSite / GeoIP'), E('strong', { id: 'passwall-geo' }, '—') ])
						]),
						E('div', { 'class': 'oum-passwall-route' }, [ E('small', { 'class': 'oum-muted' }, 'Профиль маршрутизации'), E('strong', { id: 'passwall-profile' }, '—') ]),
						E('div', { 'class': 'oum-passwall-rules oum-muted', id: 'passwall-rules' }, ''),
						E('div', { 'class': 'oum-passwall-versions oum-muted', id: 'passwall-versions' }, ''),
						E('details', { 'class': 'oum-passwall-diagnostics' }, [
							E('summary', {}, 'DNS и защита'),
							E('div', { 'class': 'oum-passwall-diagnostic-grid' }, [
								E('div', { 'class': 'oum-passwall-diagnostic' }, [ E('small', {}, 'Перехват DNS'), E('strong', { id: 'passwall-diag-redirect' }, '—') ]),
								E('div', { 'class': 'oum-passwall-diagnostic' }, [ E('small', {}, 'Обработчик DNS'), E('strong', { id: 'passwall-diag-process' }, '—') ]),
								E('div', { 'class': 'oum-passwall-diagnostic' }, [ E('small', {}, 'Прямой DNS'), E('strong', { id: 'passwall-diag-direct' }, '—') ]),
								E('div', { 'class': 'oum-passwall-diagnostic' }, [ E('small', {}, 'Удалённый DNS'), E('strong', { id: 'passwall-diag-remote' }, '—') ]),
								E('div', { 'class': 'oum-passwall-diagnostic' }, [ E('small', {}, 'Защита IPv6'), E('strong', { id: 'passwall-diag-ipv6' }, '—') ]),
								E('div', { 'class': 'oum-passwall-diagnostic' }, [ E('small', {}, 'GeoSite / GeoIP'), E('strong', { id: 'passwall-diag-geo' }, '—') ])
							])
						])
					]),
					E('div', { id: 'podkop-panel', hidden: '' }, [
						E('div', { 'class': 'oum-node-head' }, [
							E('h3', { id: 'podkop-title' }, 'Podkop + Zapret'),
							E('span', { 'class': 'oum-muted', id: 'podkop-version' }, '')
						]),
						E('div', { 'class': 'oum-passwall-grid' }, [
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', { id: 'podkop-transport-label' }, 'AWG-туннель'), E('strong', { id: 'podkop-tunnel' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Podkop'), E('strong', { id: 'podkop-routing' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Zapret / YouTube'), E('strong', { id: 'podkop-zapret' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Защищённый маршрут'), E('strong', { id: 'podkop-route-kind' }, '—') ])
						]),
						E('div', { 'class': 'oum-tabs' }, [
							E('button', { 'class': 'oum-tab', 'data-podkop-tab': 'routing', 'data-active': 'true' }, 'Маршрутизация'),
							E('button', { 'class': 'oum-tab', 'data-podkop-tab': 'diagnostics', 'data-active': 'false' }, 'Диагностика')
						]),
						E('div', { id: 'podkop-routing-tab' }, [
							E('div', { 'class': 'oum-route-intro' }, [
								E('div', {}, [ E('strong', {}, 'Куда направлять сервисы'), E('span', { 'class': 'oum-muted' }, 'Podkop отправляет трафик через текущее защищённое подключение либо напрямую через провайдера.') ]),
								E('span', { id: 'podkop-route-summary', 'class': 'oum-muted' }, '')
							]),
							communityCatalog(),
							E('details', { 'class': 'oum-custom-rules' }, [
								E('summary', {}, 'Свои домены и подсети'),
								E('div', { 'class': 'oum-route-columns' }, [
									E('div', { 'class': 'oum-route-box' }, [
										E('h4', {}, 'Через VPN'), E('p', { 'class': 'oum-muted' }, 'Дополнительные назначения для защищённого подключения.'),
										E('label', { 'class': 'oum-route-label' }, 'Домены'), E('textarea', { id: 'podkop-proxy-domains', placeholder: 'example.com\n.example.org' }, (podkopRouting.proxy?.domains || []).join('\n')),
										E('label', { 'class': 'oum-route-label' }, 'Подсети'), E('textarea', { id: 'podkop-proxy-subnets', placeholder: '203.0.113.0/24\n198.51.100.10' }, (podkopRouting.proxy?.subnets || []).join('\n'))
									]),
									E('div', { 'class': 'oum-route-box' }, [
										E('h4', {}, 'Напрямую'), E('p', { 'class': 'oum-muted' }, 'Явные исключения из защищённого подключения.'),
										E('label', { 'class': 'oum-route-label' }, 'Домены'), E('textarea', { id: 'podkop-direct-domains', placeholder: 'local.example.com' }, (podkopRouting.direct?.domains || []).join('\n')),
										E('label', { 'class': 'oum-route-label' }, 'Подсети'), E('textarea', { id: 'podkop-direct-subnets', placeholder: '192.0.2.0/24' }, (podkopRouting.direct?.subnets || []).join('\n'))
									])
								])
							]),
							E('div', { 'class': 'oum-route-actions' }, [ E('button', { 'class': 'btn cbi-button-action', id: 'podkop-routing-save' }, 'Сохранить маршрутизацию'), E('span', { 'class': 'oum-route-message oum-muted', id: 'podkop-routing-message' }, '') ])
						]),
						E('div', { id: 'podkop-diagnostics-tab', hidden: '' }, [
							E('div', { 'class': 'oum-diagnostic-layout' }, [
								E('div', {}, [
									E('button', { 'class': 'btn cbi-button oum-diagnostic-run', id: 'podkop-diagnostics-refresh' }, 'Запустить диагностику'),
									E('p', { 'class': 'oum-muted', id: 'podkop-diagnostic-summary' }, 'Проверяются DNS, sing-box, nftables, AWG, FakeIP и Zapret.'),
									E('div', { 'class': 'oum-diagnostic-sections', id: 'podkop-diagnostic-grid' })
								]),
								E('aside', { 'class': 'oum-diagnostic-side' }, [
									E('div', { 'class': 'oum-diagnostic-side-card' }, [
										E('h4', {}, 'Доступные действия'),
										E('div', { 'class': 'oum-diagnostic-actions' }, [
											E('button', { 'class': 'btn cbi-button', id: 'podkop-diagnostic-restart' }, 'Перезапустить Podkop + Zapret'),
											E('button', { 'class': 'btn cbi-button', id: 'podkop-quic-toggle' }, 'Режим QUIC')
										])
									]),
									E('div', { 'class': 'oum-diagnostic-side-card' }, [ E('h4', {}, 'Системная информация'), E('div', { 'class': 'oum-system-info', id: 'podkop-system-info' }, 'После запуска диагностики') ]),
									E('details', { 'class': 'oum-diagnostic-side-card oum-expert-tools' }, [
										E('summary', {}, 'Экспертные инструменты'),
										E('p', { 'class': 'oum-muted' }, 'Полный Zapret Manager может изменять firewall, DNS, сетевые службы и пакеты. OUM проверяет закреплённую версию и запускает её только в интерактивной root SSH-сессии после резервной копии.'),
										E('p', { 'class': 'oum-muted', id: 'zapret-manager-status' }, 'Статус будет проверен при диагностике.'),
										E('div', { 'class': 'oum-diagnostic-actions' }, [
											E('button', { 'class': 'btn cbi-button', id: 'zapret-manager-prepare' }, 'Подготовить Zapret Manager'),
											E('code', {}, 'root@OpenWrt:~# oum-zapret-manager'),
											E('a', { 'class': 'btn cbi-button', href: 'https://github.com/StressOzz/Zapret-Manager', target: '_blank', rel: 'noreferrer' }, 'О проекте Zapret Manager')
										])
									])
								])
							])
						])
					]),
					E('div', { 'class': 'oum-node-controls', id: 'node-controls' }, [
						E('div', { 'class': 'oum-node-head' }, [
							E('h3', { id: 'node-panel-title' }, 'Точка подключения'),
							E('div', { 'class': 'oum-node-actions' }, [
								E('a', { 'class': 'btn cbi-button', id: 'zashboard-link', href: zashboardUrl, target: '_blank', rel: 'noreferrer' }, 'Zashboard'),
								E('button', { 'class': 'btn cbi-button-action', id: 'show-node-picker' }, 'Выбрать ноду')
							])
						]),
						E('div', { 'class': 'oum-current-node', id: 'current-node' }, 'Нет активной ноды'),
						E('div', { 'class': 'oum-node-message oum-muted', id: 'node-message' }),
						E('details', { 'class': 'oum-node-all', id: 'node-picker' }, [
							E('summary', { id: 'all-nodes-summary' }, 'Список нод'),
							E('div', { 'class': 'oum-node-actions' }, [ E('button', { 'class': 'btn cbi-button', id: 'measure-nodes' }, 'Измерить TCP'), E('span', { 'class': 'oum-node-hint oum-muted' }, 'Лёгкое TCP-соединение до сервера ноды.') ]),
							E('div', { 'class': 'oum-node-list oum-node-all-grid', id: 'all-node-list' })
						])
					])
				])
			])
		]);

		const nodePanel = root.querySelector('#node-panel');
		const nodeControls = root.querySelector('#node-controls');
		const allNodeList = root.querySelector('#all-node-list');
		const nodePicker = root.querySelector('#node-picker');
		const nodeMessage = root.querySelector('#node-message');
		const measureButton = root.querySelector('#measure-nodes');
		const nodePanelTitle = root.querySelector('#node-panel-title');
		const zashboardLink = root.querySelector('#zashboard-link');
		const subscriptionPanel = root.querySelector('#subscription-panel');
		const subscriptionRefresh = root.querySelector('#refresh-subscription');
		const subscriptionStatus = root.querySelector('#subscription-status');
		const wifiQrButton = root.querySelector('#show-wifi-qr');
		const vpnToggle = root.querySelector('#vpn-toggle');
		const vpnControlMessage = root.querySelector('#vpn-control-message');
		const policyMessage = root.querySelector('#policy-message');
		let vpnEnabled = dashboard.vpn_enabled === true;
		let vpnEngine = dashboard.vpn_engine || 'openclash';
		let vpnWatchTimer = null;
		let passwallInstalled = dashboard.passwall?.installed === true;
		let podkopInstalled = dashboard.podkop?.installed === true;
		let nodesAvailable = initialNodes.available === true;
		let dashboardState = dashboard;
		let editingAliasMac = null;
		const updateVpnPanelVisibility = () => { nodePanel.hidden = !(passwallInstalled || podkopInstalled || nodesAvailable); };
		const podkopRoutingMessage = root.querySelector('#podkop-routing-message');
		const podkopRoutingSave = root.querySelector('#podkop-routing-save');
		const podkopDiagnosticsRefresh = root.querySelector('#podkop-diagnostics-refresh');
		const podkopDiagnosticRestart = root.querySelector('#podkop-diagnostic-restart');
		const podkopQuicToggle = root.querySelector('#podkop-quic-toggle');
		const zapretManagerPrepare = root.querySelector('#zapret-manager-prepare');
		let podkopQuicDisabled = false;

		for (const tab of root.querySelectorAll('[data-podkop-tab]')) tab.addEventListener('click', (event) => {
			event.preventDefault();
			const selected = tab.dataset.podkopTab;
			for (const button of root.querySelectorAll('[data-podkop-tab]'))
				button.dataset.active = button.dataset.podkopTab === selected ? 'true' : 'false';
			root.querySelector('#podkop-routing-tab').hidden = selected !== 'routing';
			root.querySelector('#podkop-diagnostics-tab').hidden = selected !== 'diagnostics';
		});

		const selectedCommunities = (route) => Array.from(root.querySelectorAll('[data-community-route]:checked')).filter((item) => item.value === route).map((item) => item.dataset.communityRoute).join('\n');
		const selectedYoutubeMode = () => root.querySelector('[data-community-route="youtube"]:checked')?.value === 'vpn' ? 'vpn' : 'zapret';
		const updateRouteSummary = () => {
			const vpnCount = selectedCommunities('vpn').split('\n').filter(Boolean).length;
			const directCount = selectedCommunities('direct').split('\n').filter(Boolean).length;
			root.querySelector('#podkop-route-summary').textContent = `Через VPN: ${vpnCount} · напрямую: ${directCount}`;
			const youtubeHint = root.querySelector('[data-route-row="youtube"] small');
			if (youtubeHint) youtubeHint.textContent = selectedYoutubeMode() === 'vpn' ? 'Zapret будет остановлен' : 'будет обработан Zapret';
		};
		root.querySelector('#podkop-routing-tab').addEventListener('change', updateRouteSummary);
		updateRouteSummary();
		podkopRoutingSave.addEventListener('click', (event) => {
			event.preventDefault();
			podkopRoutingSave.disabled = true;
			podkopRoutingMessage.dataset.state = 'idle';
			podkopRoutingMessage.textContent = 'Проверяем и применяем правила…';
			callApplyPodkopRouting(
				selectedCommunities('vpn'), root.querySelector('#podkop-proxy-domains').value, root.querySelector('#podkop-proxy-subnets').value,
				selectedCommunities('direct'), root.querySelector('#podkop-direct-domains').value, root.querySelector('#podkop-direct-subnets').value,
				selectedYoutubeMode()
			).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось запустить применение.');
				let attempts = 0;
				const watch = () => new Promise((resolve) => window.setTimeout(resolve, 1000)).then(callSystemJobStatus).then((job) => {
					podkopRoutingMessage.textContent = job.message || 'Применяем…';
					if (job.state === 'running' && attempts++ < 90) return watch();
					if (job.state !== 'success') throw new Error(job.message || 'Маршрутизация не применена.');
					return callDashboardStatus().then(updateDashboard);
				});
				return watch();
			}).catch((error) => {
				podkopRoutingMessage.dataset.state = 'failed';
				podkopRoutingMessage.textContent = error.message;
			}).finally(() => { podkopRoutingSave.disabled = false; });
		});

		const diagnosticMark = (state) => state === 'success' ? '✓' : (state === 'error' ? '✕' : (state === 'warning' ? '⚠' : '•'));
		const renderPodkopDiagnostics = (diagnostics) => {
			const grid = root.querySelector('#podkop-diagnostic-grid');
			grid.replaceChildren(...(diagnostics.sections || []).map((section) => E('section', { 'class': 'oum-diagnostic-section', 'data-state': section.state }, [
				E('div', { 'class': 'oum-diagnostic-title' }, [
					E('span', { 'class': 'oum-diagnostic-icon' }, diagnosticMark(section.state)),
					E('div', {}, [ E('strong', {}, section.title), E('div', { 'class': 'oum-muted' }, section.description || '') ])
				]),
				E('div', { 'class': 'oum-diagnostic-items' }, (section.items || []).map((item) => E('div', { 'class': 'oum-diagnostic-item', 'data-state': item.state }, [
					E('span', { 'class': 'oum-diagnostic-mark' }, diagnosticMark(item.state)),
					E('span', {}, item.label),
					E('span', { 'class': 'oum-diagnostic-value' }, item.value || '')
				])))
			])));
			root.querySelector('#podkop-diagnostic-summary').textContent = diagnostics.state === 'success' ?
				'Все проверки пройдены.' : (diagnostics.state === 'warning' ? 'Сервисы работают, но есть предупреждения.' : 'Одна или несколько проверок требуют внимания.');
			podkopQuicDisabled = diagnostics.quic_disabled === true;
			podkopQuicToggle.textContent = podkopQuicDisabled ? 'Разрешить QUIC' : 'Отключить QUIC для видео';
			const manager = diagnostics.zapret_manager || {};
			zapretManagerPrepare.disabled = manager.installed === true;
			zapretManagerPrepare.textContent = manager.installed === true ? 'CLI подготовлен' : 'Подготовить Zapret Manager';
			root.querySelector('#zapret-manager-status').textContent = manager.installed === true ?
				`Установлена проверенная ревизия ${String(manager.revision || '').slice(0, 12)}.` :
				'Полная версия не загружена; основные стратегии OUM уже доступны без неё.';
			const info = diagnostics.system || {};
			root.querySelector('#podkop-system-info').replaceChildren(...[
				[ 'Podkop', info.podkop ], [ 'LuCI App', info.luci ], [ 'Sing-box', info.singbox ], [ 'OpenWrt', info.openwrt ], [ 'Устройство', info.device ]
			].map(([ label, value ]) => [ E('strong', {}, label), E('span', {}, value || '—') ]).flat());
		};
		const browserFakeIpCheck = async (diagnostics) => {
			const fetchJson = (url) => Promise.race([
				fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } }).then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.json();
				}),
				new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 5000))
			]);
			const section = (diagnostics.sections || []).find((item) => item.id === 'fakeip');
			if (!section) return diagnostics;
			try {
				const [ proxied, direct ] = await Promise.all([ fetchJson(diagnostics.fakeip_check_url), fetchJson(diagnostics.ip_check_url) ]);
				const browserFake = proxied?.fakeip === true;
				const routed = browserFake && proxied?.IP && direct?.IP && proxied.IP !== direct.IP;
				section.items = section.items.slice(0, 1).concat([
					{ state: browserFake ? 'success' : 'error', label: 'Браузер использует FakeIP', value: browserFake ? 'да' : 'нет' },
					{ state: routed ? 'success' : 'error', label: 'Прокси-трафик отличается от прямого', value: routed ? 'маршрут работает' : 'маршрут не подтверждён' }
				]);
				section.state = section.items.some((item) => item.state === 'error') ? 'error' : 'success';
				section.description = section.state === 'success' ? 'Проверки пройдены' : 'Обнаружены проблемы';
			}
			catch (error) {
				section.items = section.items.slice(0, 1).concat([ { state: 'warning', label: 'Проверка браузера', value: 'сервис проверки недоступен' } ]);
				section.state = section.items[0]?.state === 'error' ? 'error' : 'warning';
				section.description = section.state === 'error' ? 'Обнаружены проблемы' : 'Проверка выполнена частично';
			}
			return diagnostics;
		};
		const runPodkopDiagnostics = () => {
			podkopDiagnosticsRefresh.disabled = true;
			root.querySelector('#podkop-diagnostic-summary').textContent = 'Выполняем безопасные проверки…';
			return callPodkopDiagnostics().then(browserFakeIpCheck).then(renderPodkopDiagnostics).catch((error) => {
				root.querySelector('#podkop-diagnostic-summary').textContent = error.message;
			}).finally(() => { podkopDiagnosticsRefresh.disabled = false; });
		};
		podkopDiagnosticsRefresh.addEventListener('click', (event) => {
			event.preventDefault();
			runPodkopDiagnostics();
		});
		podkopDiagnosticRestart.addEventListener('click', (event) => {
			event.preventDefault();
			podkopDiagnosticRestart.disabled = true;
			root.querySelector('#podkop-diagnostic-summary').textContent = 'Перезапускаем Podkop + Zapret…';
			callSetVpnEnabled(true).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось перезапустить сервисы.');
				window.setTimeout(runPodkopDiagnostics, 22000);
			}).catch((error) => {
				root.querySelector('#podkop-diagnostic-summary').textContent = error.message;
			}).finally(() => { window.setTimeout(() => { podkopDiagnosticRestart.disabled = false; }, 22000); });
		});
		podkopQuicToggle.addEventListener('click', (event) => {
			event.preventDefault();
			const next = !podkopQuicDisabled;
			if (!window.confirm(next ? 'Отключить QUIC? Видео перейдёт на TCP/TLS, правила firewall кратковременно перезапустятся.' : 'Снова разрешить QUIC? Правила firewall кратковременно перезапустятся.')) return;
			podkopQuicToggle.disabled = true;
			callSetZapretQuic(next).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось изменить режим QUIC.');
				let attempts = 0;
				const watch = () => callSystemJobStatus().then((job) => {
					root.querySelector('#podkop-diagnostic-summary').textContent = job.message || 'Применяем режим QUIC…';
					if (job.state === 'running' && attempts++ < 90) return new Promise((resolve) => window.setTimeout(resolve, 1000)).then(watch);
					if (job.state !== 'success') throw new Error(job.message || 'Не удалось изменить режим QUIC.');
					return runPodkopDiagnostics();
				});
				return watch();
			}).catch((error) => {
				root.querySelector('#podkop-diagnostic-summary').textContent = error.message;
			}).finally(() => { podkopQuicToggle.disabled = false; });
		});
		zapretManagerPrepare.addEventListener('click', (event) => {
			event.preventDefault();
			zapretManagerPrepare.disabled = true;
			root.querySelector('#zapret-manager-status').textContent = 'Загружаем и проверяем закреплённую версию…';
			callPrepareZapretManager().then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось подготовить Zapret Manager.');
				let attempts = 0;
				const watch = () => callSystemJobStatus().then((job) => {
					root.querySelector('#zapret-manager-status').textContent = job.message || 'Подготавливаем CLI…';
					if (job.state === 'running' && attempts++ < 90) return new Promise((resolve) => window.setTimeout(resolve, 1000)).then(watch);
					if (job.state !== 'success') throw new Error(job.message || 'Zapret Manager не подготовлен.');
					return runPodkopDiagnostics();
				});
				return watch();
			}).catch((error) => {
				root.querySelector('#zapret-manager-status').textContent = error.message;
				zapretManagerPrepare.disabled = false;
			});
		});

		const updateSubscription = (fresh) => {
			const info = fresh.subscription || {};
			subscriptionPanel.hidden = fresh.vpn_engine !== 'openclash' || fresh.active_source !== 'subscription';
			if (subscriptionPanel.hidden) return;
			subscriptionRefresh.disabled = info.refreshing === true;
			if (!info.available) {
				subscriptionStatus.textContent = info.refreshing ? 'Получаем данные у провайдера…' : 'Провайдер не передал сведения о подписке.';
				return;
			}

			const used = Number(info.upload || 0) + Number(info.download || 0);
			const total = Number(info.total || 0);
			const traffic = total > 0 ? `${formatBytes(used)} из ${formatBytes(total)}` : `${formatBytes(used)} использовано`;

			const expires = Number(info.expire || 0);
			let expiry = 'без ограничения срока';
			if (expires > 0) {
				const days = Math.max(0, Math.ceil((expires - Date.now() / 1000) / 86400));
				const date = new Date(expires * 1000).toLocaleDateString('ru-RU');
				expiry = `до ${date} (${days} дн.)`;
			}
			subscriptionStatus.textContent = info.refreshing ? 'Обновляем данные…' : `${traffic} · ${expiry}`;
		};

		const updateDashboard = (fresh) => {
			dashboardState = fresh;
			vpnEngine = fresh.vpn_engine || 'openclash';
			const tunnelWarning = root.querySelector('#unmanaged-tunnel-warning');
			root.querySelector('#reboot-required-warning').hidden = fresh.reboot_required !== true;
			const unmanaged = fresh.unmanaged_tunnels || [];
			const activeUnmanaged = unmanaged.filter((item) => item.up === true);
			tunnelWarning.hidden = activeUnmanaged.length === 0;
			tunnelWarning.textContent = activeUnmanaged.length ?
				`Обнаружено дополнительное VPN-подключение, созданное не через OUM: ${activeUnmanaged.map((item) => item.name).join(', ')}. Если оно включено одновременно с OUM, интернет может работать неправильно.` : '';
			root.querySelector('#wan-state').textContent = fresh.wan?.up ? 'Подключён' : 'Нет соединения';
			root.querySelector('#wan-detail').textContent = fresh.wan?.via === 'wifi' ?
				`через Wi-Fi${fresh.wan.ssid ? ` · ${fresh.wan.ssid}` : ''}${fresh.wan.ipv4 ? ` · ${fresh.wan.ipv4}` : ''}` :
				(fresh.wan?.ipv4 ? `${fresh.wan.ipv4} · ${String(fresh.wan.proto || '').toUpperCase()}` : String(fresh.wan?.proto || '').toUpperCase());
			root.querySelector('#client-count').textContent = String(fresh.clients?.length || 0);
			const ssids = Array.from(new Set((fresh.wifi || []).map((item) => item.ssid)));
			root.querySelector('#wifi-detail').textContent = ssids.length ? ssids.join(' · ') : 'Wi-Fi выключен';
			wifiQrButton.hidden = !(fresh.wifi || []).length;
			const health = fresh.health || {};
			const temperatureText = health.temperature != null ? `${Math.round(health.temperature)}°C ${health.temperature_state === 'hot' ? 'проветрить' : (health.temperature_state === 'warm' ? 'теплее' : 'норм')}` : 'темп. —';
			const healthNode = root.querySelector('#health-state');
			healthNode.dataset.temperature = health.temperature_state || 'unknown';
			healthNode.textContent = `Up ${formatUptime(health.uptime)} · CPU ${Number(health.load || 0).toFixed(2)} · RAM ${health.memory_percent || 0}% · ${temperatureText}`;
			root.querySelector('#active-source').textContent = sourceNames[vpnEngine === 'passwall' ? 'passwall' : (vpnEngine === 'podkop' ? 'podkop' : fresh.active_source)] || fresh.active_source;
			vpnEnabled = fresh.vpn_enabled === true;
			vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
			// A broken or half-started VPN must always remain possible to disable.
			vpnToggle.disabled = !vpnEnabled && vpnEngine === 'openclash' && fresh.active_source === 'none';
			vpnControlMessage.textContent = !vpnEnabled ? 'VPN выключен' :
				(fresh.vpn_ready === true ? 'VPN работает' : 'VPN запускается или требует внимания');
			updateSubscription(fresh);
			const body = root.querySelector('#client-list');
			const offlineBody = root.querySelector('#offline-client-list');
			const devicePanel = root.querySelector('#devices-panel');
			const activeEditor = devicePanel.querySelector('[data-device-alias-input]');
			const nameCell = (client) => E('td', { 'class': 'oum-device-cell' }, editingAliasMac === client.mac ?
					E('div', { 'class': 'oum-device-alias-form' }, [
						E('input', { 'data-device-alias-input': client.mac, maxlength: 32, value: client.alias || client.name, 'aria-label': `Новое имя для ${client.name}` }),
						E('button', { type: 'button', 'class': 'btn cbi-button-action oum-device-rename', 'data-device-action': 'save', 'data-device-mac': client.mac }, 'Сохранить'),
						E('button', { type: 'button', 'class': 'btn cbi-button oum-device-rename', 'data-device-action': 'cancel', 'data-device-mac': client.mac }, 'Отмена')
					]) :
					E('div', { 'class': 'oum-device-name-row' }, [
						E('span', { 'class': 'oum-device-name' }, client.name),
						E('button', { type: 'button', 'class': 'btn cbi-button oum-device-rename', 'data-device-action': 'edit', 'data-device-mac': client.mac }, 'Переименовать')
					]));
			const pauseButton = (client) => E('button', {
				type: 'button',
				'class': `btn ${client.paused ? 'cbi-button-action' : 'cbi-button'} oum-pause-button`,
				'data-device-action': 'pause',
				'data-device-mac': client.mac,
				'data-device-paused': client.paused ? '1' : '0'
			}, client.paused ? 'Возобновить' : 'Пауза');
			if (!editingAliasMac || !activeEditor) {
				body.replaceChildren(...(fresh.clients || []).map((client) => E('tr', { 'class': client.paused ? 'oum-client-paused' : '' }, [
				nameCell(client), E('td', {}, client.ip),
				E('td', {}, client.medium === 'wifi' ? 'Wi-Fi' : (client.medium === 'ethernet' ? 'Кабель' : 'Не определено')),
				E('td', { 'class': 'optional' }, client.mac), trafficCell(client.traffic),
				E('td', {}, policySelect(client)),
				E('td', {}, pauseButton(client))
			])));
				offlineBody.replaceChildren(...(fresh.offline_clients || []).map((client) => {
					const select = policySelect(client);
					select.disabled = true;
					return E('tr', { 'class': client.paused ? 'oum-client-paused' : '' }, [
						nameCell(client), E('td', {}, client.ip || '—'), E('td', { 'class': 'optional' }, client.mac),
						E('td', {}, select), E('td', {}, pauseButton(client))
					]);
				}));
			}
			if (!fresh.clients?.length)
				body.appendChild(E('tr', {}, E('td', { colspan: 7, 'class': 'oum-muted' }, 'Нет активных устройств')));
			const offlineSection = root.querySelector('#offline-section');
			offlineSection.hidden = !(fresh.offline_clients || []).length;
			root.querySelector('#offline-summary').textContent = `Недавно были (офлайн) · ${(fresh.offline_clients || []).length}`;
			for (const select of body.querySelectorAll('.oum-policy'))
				select.disabled = false;
			policyMessage.textContent = vpnEngine === 'passwall' ?
				'PassWall закрепляет адрес устройства и добавляет его в соответствующее shunt-правило.' :
				(vpnEngine === 'podkop' ? 'Podkop применяет исключение либо полную маршрутизацию к IP-адресу устройства.' :
				'Режим применяется к выбранному устройству и сохраняется после перезагрузки.');
			updatePasswall(fresh.passwall || {});
			updatePodkop(fresh.podkop || {});
		};

		const updatePodkop = (state) => {
			const panel = root.querySelector('#podkop-panel');
			podkopInstalled = state.installed === true;
			panel.hidden = !podkopInstalled;
			updateVpnPanelVisibility();
			if (panel.hidden) return;
			const youtubeViaVpn = state.youtube_mode === 'vpn';
			const reality = state.transport === 'reality';
			root.querySelector('#podkop-title').textContent = youtubeViaVpn ? 'Podkop' : 'Podkop + Zapret';
			root.querySelector('#podkop-version').textContent = `Podkop ${state.version || '—'}${youtubeViaVpn ? '' : ` · Zapret ${state.zapret_version || '—'}`}`;
			root.querySelector('#podkop-transport-label').textContent = reality ? 'Reality-прокси' : 'AWG-туннель';
			root.querySelector('#podkop-tunnel').textContent = reality ? (state.ready ? (state.proxy_endpoint || 'Работает') : 'Требует внимания') : (state.tunnel_up ? `${state.interface || 'AWG'} поднят` : 'Требует внимания');
			root.querySelector('#podkop-routing').textContent = state.ready ? 'Работает' : 'Требует внимания';
			root.querySelector('#podkop-zapret').textContent = youtubeViaVpn ? 'Отключён · YouTube через VPN' : (state.zapret ? `Работает${state.zapret_strategy ? ` · ${state.zapret_strategy}` : ''}` : 'Требует внимания');
			root.querySelector('#podkop-route-kind').textContent = reality ? 'Через Reality' : 'Через AWG';
		};

		const updatePasswall = (state) => {
			const panel = root.querySelector('#passwall-panel');
			passwallInstalled = state.installed === true;
			panel.hidden = !passwallInstalled;
			updateVpnPanelVisibility();
			if (panel.hidden) return;
			const health = [ [ 'xray', state.xray ], [ 'dns', state.dns ], [ 'firewall', state.firewall ], [ 'geo', state.geo_ready ] ];
			for (const [ name, ok ] of health) {
				const element = root.querySelector(`#passwall-${name}`);
				element.textContent = ok ? 'Работает' : 'Требует внимания';
				element.dataset.ok = ok ? 'true' : 'false';
			}
			root.querySelector('#passwall-profile').textContent = state.profile || 'Не выбран';
			const rules = state.rules || [];
			root.querySelector('#passwall-rules').textContent = rules.length ?
				`Правила: ${rules.map((rule) => rule.label).join(' · ')}` : 'Shunt-правила не найдены.';
			const versions = state.versions || {};
			root.querySelector('#passwall-version').textContent = versions.passwall ? `Версия ${versions.passwall}` : '';
			root.querySelector('#passwall-versions').textContent = `Xray ${versions.xray || '—'} · HAProxy ${versions.haproxy || '—'}`;
			const diagnostics = state.diagnostics || {};
			const setDiagnostic = (id, text, ok) => {
				const element = root.querySelector(`#passwall-diag-${id}`);
				element.textContent = text;
				if (ok == null) delete element.dataset.ok;
				else element.dataset.ok = ok ? 'true' : 'false';
			};
			const redirectReady = diagnostics.dns_redirect === true && diagnostics.dns_firewall === true;
			setDiagnostic('redirect', redirectReady ? 'Включён' : 'Требует внимания', redirectReady);
			setDiagnostic('process', diagnostics.dns_process === true ? `Работает (${diagnostics.dns_mode || '—'})` : 'Не работает', diagnostics.dns_process === true);
			setDiagnostic('direct', diagnostics.direct_dns || 'Не задан', diagnostics.direct_dns && diagnostics.direct_dns !== 'Не задан');
			const remoteDnsReady = diagnostics.remote_dns && diagnostics.remote_dns !== 'Не задан';
			const remoteDnsLabel = remoteDnsReady ? `${(diagnostics.remote_dns_mode || 'DNS').toUpperCase()} · ${diagnostics.remote_dns}` : 'Не задан';
			setDiagnostic('remote', remoteDnsLabel, remoteDnsReady);
			const ipv6Protected = diagnostics.ipv6_tproxy === true || diagnostics.ipv6_filtered === true;
			const ipv6Label = diagnostics.ipv6_tproxy === true ? 'TProxy включён' : (diagnostics.ipv6_filtered === true ? 'Фильтрация включена' : 'Не защищён');
			setDiagnostic('ipv6', ipv6Label, ipv6Protected);
			const geoReady = diagnostics.geosite === true && diagnostics.geoip === true;
			setDiagnostic('geo', geoReady ? 'Оба набора готовы' : 'Неполный набор', geoReady);
		};

		const updateNodes = (fresh) => {
			nodesAvailable = fresh.available === true;
			nodeControls.hidden = !nodesAvailable;
			updateVpnPanelVisibility();
			if (!fresh.available) return;
			const isPasswall = fresh.engine === 'passwall';
			nodeControls.dataset.engine = isPasswall ? 'passwall' : 'openclash';
			nodePanelTitle.textContent = 'Точка подключения';
			zashboardLink.hidden = isPasswall;
			zashboardLink.style.display = isPasswall ? 'none' : '';
			measureButton.disabled = fresh.applying === true;
			const delayText = (node, emptyText) => node.delay > 0 ? `${node.delay} ms` :
				(node.tested || fresh.measured_at ? 'offline' : emptyText);
			const makeNode = (node, isCurrent) => E('div', { 'class': 'oum-node' }, [
				E('span', { title: node.name }, node.name),
				E('span', { 'class': 'oum-delay' }, delayText(node, '—')),
				E('button', {
					'class': 'btn cbi-button', 'data-node': isCurrent ? null : (node.id || node.name),
					disabled: isCurrent || fresh.applying === true ? '' : null
				}, isCurrent ? 'Активна' : 'Выбрать')
			]);
			const current = (fresh.nodes || []).find((node) =>
				fresh.current_id ? node.id === fresh.current_id : node.name === fresh.current);
			root.querySelector('#current-node').textContent = current ?
				`${current.name} · ${delayText(current, 'TCP не измерен')}` : (fresh.current || 'Не выбрана');
			const all = sortedNodes(fresh.nodes);
			root.querySelector('#all-nodes-summary').textContent = `Список нод (${all.length})`;
			allNodeList.replaceChildren(...all.map((node) => makeNode(node,
				fresh.current_id ? node.id === fresh.current_id : node.name === fresh.current)));
		};

		const showNodeMessage = (message, failed) => {
			nodeMessage.textContent = message || '';
			nodeMessage.dataset.state = failed ? 'failed' : 'idle';
		};

		measureButton.addEventListener('click', (ev) => {
			ev.preventDefault();
			measureButton.disabled = true;
			measureButton.textContent = 'Измеряем…';
			callMeasureNodeDelays().then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось измерить ping.');
				return callNodeStatus();
			}).then((nodes) => {
				updateNodes(nodes);
				showNodeMessage('TCP-задержка нод обновлена.', false);
			}).catch((err) => showNodeMessage(err.message, true)).finally(() => {
				measureButton.disabled = false;
				measureButton.textContent = 'Измерить TCP';
			});
		});
		root.querySelector('#show-node-picker').addEventListener('click', () => {
			nodePicker.open = !nodePicker.open;
			if (nodePicker.open) nodePicker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		});

		subscriptionRefresh.addEventListener('click', (ev) => {
			ev.preventDefault();
			subscriptionRefresh.disabled = true;
			subscriptionStatus.textContent = 'Обновляем данные подписки…';
			callRefreshSubscriptionInfo().then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось обновить данные подписки.');
				let attempts = 0;
				const watch = () => callDashboardStatus().then((fresh) => {
					updateDashboard(fresh);
					if (fresh.subscription?.refreshing === true && attempts++ < 15)
						return new Promise((resolve) => window.setTimeout(resolve, 1000)).then(watch);
				});
				return watch();
			}).catch((err) => {
				subscriptionStatus.textContent = err.message;
				subscriptionRefresh.disabled = false;
			});
		});
		wifiQrButton.addEventListener('click', () => {
			const network = (dashboardState.wifi || [])[0];
			if (!network) return;
			const password = E('input', { type: 'password', autocomplete: 'off', placeholder: 'Пароль Wi-Fi', 'aria-label': 'Пароль Wi-Fi' });
			const error = E('p', { 'class': 'oum-node-message', 'data-state': 'idle' });
			const generate = async () => {
				const key = password.value;
				if (network.password_set && !key) {
					error.dataset.state = 'failed';
					error.textContent = 'Введите действующий пароль Wi-Fi. OUM не читает и не показывает сохранённый пароль.';
					password.focus();
					return;
				}
				try {
					await loadQrLibrary();
					const payload = network.password_set ? `WIFI:T:WPA;S:${escapeWifiQr(network.ssid)};P:${escapeWifiQr(key)};;` : `WIFI:T:nopass;S:${escapeWifiQr(network.ssid)};;`;
					const canvas = E('canvas', { 'aria-label': `QR-код сети ${network.ssid}` });
					drawQr(canvas, payload);
					password.value = '';
					ui.showModal(`Wi-Fi: ${network.ssid}`, [
						E('div', { 'class': 'oum-qr-wrap' }, [ canvas, E('strong', {}, 'Наведи камерой телефона'), E('span', { 'class': 'oum-muted' }, 'Пароль не сохранён в браузере.') ]),
						E('div', { 'class': 'right' }, E('button', { 'class': 'btn cbi-button-action', click: ui.hideModal }, 'Готово'))
					]);
				}
				catch (qrError) {
					error.dataset.state = 'failed';
					error.textContent = qrError.message;
				}
			};
			ui.showModal('Подключить телефон к Wi-Fi', [
				E('p', {}, `Сеть: ${network.ssid}`),
				...(network.password_set ? [ E('p', { 'class': 'oum-muted' }, 'Введите пароль только для создания QR-кода. Он не будет сохранён.'), password ] : []),
				error,
				E('div', { 'class': 'right' }, [ E('button', { 'class': 'btn', click: ui.hideModal }, 'Отмена'), ' ', E('button', { 'class': 'btn cbi-button-action important', click: generate }, 'Создать QR') ])
			]);
			if (network.password_set) window.requestAnimationFrame(() => password.focus());
		});

		vpnToggle.addEventListener('click', (ev) => {
			ev.preventDefault();
			vpnToggle.disabled = true;
			vpnControlMessage.textContent = vpnEnabled ? 'Отключаем VPN…' : 'Запускаем VPN…';
			callSetVpnEnabled(!vpnEnabled).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось изменить состояние VPN.');
				vpnEnabled = result.enabled === true;
				vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
				vpnControlMessage.textContent = result.message || 'Состояние изменено.';
				let attempts = 0;
				const wanted = vpnEnabled;
				const watch = () => callDashboardStatus().then((fresh) => {
					updateDashboard(fresh);
					const ready = wanted ? fresh.vpn_ready === true : fresh.vpn_ready !== true;
					if (!ready)
						vpnToggle.disabled = true;
					if (!ready && attempts++ < 45)
						vpnWatchTimer = window.setTimeout(watch, 1000);
					else if (!ready) {
						vpnControlMessage.textContent = 'Сервис не подтвердил готовность.';
						vpnToggle.disabled = false;
					}
				}).catch((err) => {
					vpnControlMessage.textContent = err.message;
					vpnToggle.disabled = false;
				});
				if (vpnWatchTimer) window.clearTimeout(vpnWatchTimer);
				return watch();
			}).catch((err) => {
				vpnControlMessage.textContent = err.message;
				vpnToggle.disabled = false;
			});
		});

		root.querySelector('#client-list').addEventListener('change', (ev) => {
			const target = ev.target.closest('[data-mac]');
			if (!target) return;
			target.disabled = true;
			policyMessage.dataset.state = 'idle';
			policyMessage.textContent = 'Сохраняем режим и обновляем маршрутизацию…';
			callSetDevicePolicy(target.dataset.mac, target.value).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось изменить маршрутизацию.');
				policyMessage.textContent = vpnEngine === 'passwall' ?
					'PassWall пересобирает маршрутизацию…' : (result.message || 'Настройка сохранена.');
				let attempts = 0;
				const watch = () => new Promise((resolve) => window.setTimeout(resolve, 1000))
					.then(callDashboardStatus).then((fresh) => {
						updateDashboard(fresh);
						if ((fresh.policy_applying === true || attempts < 2) && attempts++ < 60)
							return watch();
						if (fresh.policy_applying === true)
							throw new Error('PassWall не завершил применение за 60 секунд.');
						policyMessage.textContent = 'Маршрутизация устройства применена.';
					}).catch((err) => {
						if (attempts++ < 60) return watch();
						throw err;
					});
				return watch();
			}).catch((err) => {
				policyMessage.dataset.state = 'failed';
				policyMessage.textContent = err.message;
				return callDashboardStatus().then(updateDashboard);
			}).finally(() => { target.disabled = false; });
		});

		root.querySelector('#devices-panel').addEventListener('click', (ev) => {
			const action = ev.target.closest('[data-device-action]');
			if (!action) return;
			ev.preventDefault();
			const mac = action.dataset.deviceMac;
			if (action.dataset.deviceAction === 'edit') {
				editingAliasMac = mac;
				updateDashboard(dashboardState);
				window.requestAnimationFrame(() => {
					const input = root.querySelector(`[data-device-alias-input="${mac}"]`);
					input?.focus();
					input?.select();
				});
				return;
			}
			if (action.dataset.deviceAction === 'cancel') {
				editingAliasMac = null;
				updateDashboard(dashboardState);
				return;
			}
			if (action.dataset.deviceAction === 'pause') {
				const paused = action.dataset.devicePaused !== '1';
				action.disabled = true;
				policyMessage.dataset.state = 'idle';
				policyMessage.textContent = paused ? 'Приостанавливаем доступ устройства…' : 'Восстанавливаем доступ устройства…';
				callSetDevicePaused(mac, paused).then((result) => {
					if (!result.ok) throw new Error(result.message || 'Не удалось изменить доступ устройства.');
					policyMessage.textContent = result.message;
					return new Promise((resolve) => window.setTimeout(resolve, 2300)).then(() => callDashboardStatus()).then(updateDashboard);
				}).catch((error) => {
					policyMessage.dataset.state = 'failed';
					policyMessage.textContent = error.message;
					action.disabled = false;
				});
				return;
			}
			const input = root.querySelector(`[data-device-alias-input="${mac}"]`);
			const alias = String(input?.value || '').trim();
			if (!validDeviceAlias(alias)) {
				policyMessage.dataset.state = 'failed';
				policyMessage.textContent = 'Имя: максимум 32 символа; разрешены буквы, цифры, пробел, дефис, точка и подчёркивание.';
				input?.focus();
				return;
			}
			action.disabled = true;
			policyMessage.dataset.state = 'idle';
			policyMessage.textContent = 'Сохраняем имя устройства…';
			callSetDeviceAlias(mac, alias).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось сохранить имя устройства.');
				editingAliasMac = null;
				policyMessage.textContent = result.message;
				return callDashboardStatus().then(updateDashboard);
			}).catch((error) => {
				policyMessage.dataset.state = 'failed';
				policyMessage.textContent = error.message;
				action.disabled = false;
			});
		});

		root.querySelector('#devices-panel').addEventListener('keydown', (ev) => {
			const input = ev.target.closest('[data-device-alias-input]');
			if (!input) return;
			if (ev.key === 'Enter') {
				ev.preventDefault();
				input.parentElement.querySelector('[data-device-action="save"]').click();
			}
			else if (ev.key === 'Escape') {
				ev.preventDefault();
				input.parentElement.querySelector('[data-device-action="cancel"]').click();
			}
		});

		nodePanel.addEventListener('click', (ev) => {
			const target = ev.target.closest('[data-node]');
			if (!target) return;
			for (const button of nodePanel.querySelectorAll('[data-node]')) button.disabled = true;
			showNodeMessage('Переключаем ноду…', false);
			callSelectNode(target.dataset.node).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось переключить ноду.');
				if (result.engine === 'passwall' && result.applying === true) {
					let attempts = 0;
					const watch = () => new Promise((resolve) => window.setTimeout(resolve, 1000))
						.then(callNodeStatus).then((nodes) => {
							updateNodes(nodes);
							if (nodes.applying === true && attempts++ < 90)
								return watch();
							if (nodes.applying === true)
								throw new Error('PassWall не завершил переключение за 90 секунд.');
							if (nodes.current_id !== result.target)
								throw new Error('PassWall восстановил предыдущую ноду после ошибки запуска.');
							return nodes;
						});
					return watch();
				}
				return callNodeStatus();
			}).then((nodes) => {
				updateNodes(nodes);
				showNodeMessage(nodes.engine === 'passwall' ? 'Нода PassWall переключена.' : 'Нода переключена.', false);
			}).catch((err) => showNodeMessage(err.message, true)).finally(() => {
				for (const button of nodePanel.querySelectorAll('[data-node]')) button.disabled = false;
			});
		});

		updateDashboard(dashboard);
		updateNodes(initialNodes);
		poll.add(() => Promise.all([ callDashboardStatus(), callNodeStatus() ]).then(([fresh, nodes]) => {
			updateDashboard(fresh);
			updateNodes(nodes);
		}), 10);
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
