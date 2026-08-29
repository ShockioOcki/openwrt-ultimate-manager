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

function appSidebar(active) {
	const item = (key, label, path) => E('a', {
		'class': `oum-nav-item${active === key ? ' is-active' : ''}`,
		href: L.url('oum', path)
	}, label);
	return E('aside', { 'class': 'oum-sidebar', 'aria-label': 'Навигация OUM' }, [
		E('div', { 'class': 'oum-brand' }, [ E('span', { 'class': 'oum-brand-mark', 'aria-hidden': 'true' }, 'O'), E('span', {}, [ E('strong', {}, 'OUM'), E('small', {}, 'Домашний щит') ]) ]),
		E('div', { 'class': 'oum-nav-caption' }, 'Меню'),
		E('nav', { 'class': 'oum-nav' }, [
			item('dashboard', 'Панель', 'dashboard'),
			item('parental', 'Родительский контроль', 'parental'),
			item('settings', 'Настройки', 'settings'),
			item('help', 'Помощь', 'help')
		])
	]);
}

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

		const page = E('main', { 'class': 'oum-main' }, [
			E('link', { rel: 'stylesheet', href: L.resource('oum/oum.css') }),
			E('div', { 'class': 'oum-page-head' }, [
				E('div', {}, [ E('h2', {}, 'Панель OUM'), E('p', { 'class': 'oum-muted' }, 'Домашняя сеть и защищённое подключение') ]),
				E('div', { 'class': 'oum-head-actions' }, [
					E('span', { 'class': 'oum-status-badge', id: 'header-vpn-state' }, 'Проверяем VPN'),
					E('a', { 'class': 'btn cbi-button', href: L.url('oum', 'logout') }, 'Выйти'),
					E('button', { 'class': 'btn cbi-button', id: 'oum-theme-toggle', type: 'button' }, 'Тёмная')
				])
			]),
			E('div', { 'class': 'oum-warning', id: 'unmanaged-tunnel-warning', hidden: '' }),
			E('div', { 'class': 'oum-warning', id: 'reboot-required-warning', hidden: '' }, 'После замены VPN-движка рекомендуется перезагрузить роутер из раздела «Настройки».'),
			E('div', { 'class': 'oum-cards' }, [
				E('div', { 'class': 'oum-card' }, [ E('img', { 'class': 'oum-metric-icon', src: L.resource('oum/icons/ui-globe.svg'), alt: '' }), E('small', {}, 'Интернет'), E('strong', { id: 'wan-state' }, ''), E('div', { id: 'wan-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card oum-client-metric' }, [ E('div', {}, [ E('img', { 'class': 'oum-metric-icon', src: L.resource('oum/icons/ui-wifi.svg'), alt: '' }), E('small', {}, 'Клиенты'), E('strong', { id: 'client-count' }, '0'), E('div', { id: 'wifi-detail', 'class': 'oum-muted' }, '') ]), E('button', { 'class': 'oum-qr-tile', id: 'show-wifi-qr', type: 'button' }, [ E('span', { 'aria-hidden': 'true' }, '▦'), E('small', {}, 'Wi‑Fi QR') ]) ]),
				E('div', { 'class': 'oum-card' }, [ E('span', { 'class': 'oum-metric-icon oum-temperature-icon', 'aria-hidden': 'true' }, '°'), E('small', {}, 'Температура'), E('strong', { id: 'health-state', 'class': 'oum-health' }, '—'), E('div', { id: 'health-detail', 'class': 'oum-muted' }, 'Максимум по датчикам') ]),
				E('div', { 'class': 'oum-card oum-vpn-metric' }, [
					E('img', { 'class': 'oum-metric-icon', src: L.resource('oum/icons/ui-vpn.svg'), alt: '' }),
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
			]),
			E('section', { 'class': 'oum-panel oum-system-panel' }, [
				E('div', { 'class': 'oum-section-head' }, [ E('h3', {}, 'Система'), E('span', { 'class': 'oum-muted', id: 'system-uptime' }, '—') ]),
				E('div', { 'class': 'oum-system-meters' }, [
					E('div', {}, [ E('strong', {}, 'Оперативная память'), E('div', { 'class': 'oum-meter' }, E('span', { id: 'memory-meter' })), E('small', { 'class': 'oum-muted', id: 'memory-detail' }, '—') ]),
					E('div', {}, [ E('strong', {}, 'Нагрузка'), E('div', { 'class': 'oum-meter' }, E('span', { id: 'load-meter' })), E('small', { 'class': 'oum-muted', id: 'load-detail' }, '—') ])
				])
			])
		]);
		const root = E('div', { 'class': 'oum-dashboard oum-app', 'data-theme': 'light' }, [ appSidebar('dashboard'), page ]);

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
		const themeToggle = root.querySelector('#oum-theme-toggle');
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
		const setTheme = (theme) => {
			root.dataset.theme = theme;
			themeToggle.textContent = theme === 'dark' ? 'Светлая' : 'Тёмная';
			try { window.localStorage.setItem('oum-theme', theme); } catch (_) {}
		};
		try { setTheme(window.localStorage.getItem('oum-theme') === 'dark' ? 'dark' : 'light'); } catch (_) { setTheme('light'); }
		themeToggle.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
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
		for (const row of root.querySelectorAll('.oum-route-row')) {
			row.tabIndex = 0;
			row.setAttribute('role', 'switch');
			const toggle = () => {
				const checked = row.querySelector('input:checked');
				const next = row.querySelector(`input[value="${checked?.value === 'vpn' ? 'direct' : 'vpn'}"]`);
				if (!next) return;
				next.checked = true;
				row.setAttribute('aria-checked', String(next.value === 'vpn'));
				updateRouteSummary();
			};
			row.setAttribute('aria-checked', String(row.querySelector('input[value="vpn"]')?.checked === true));
			row.addEventListener('click', (event) => { event.preventDefault(); toggle(); });
			row.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				toggle();
			});
		}
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
			const temperatureText = health.temperature != null ? `${Math.round(health.temperature)} °C` : '—';
			const healthNode = root.querySelector('#health-state');
			healthNode.dataset.temperature = health.temperature_state || 'unknown';
			healthNode.textContent = temperatureText;
			root.querySelector('#health-detail').textContent = health.temperature_state === 'hot' ? 'Нужно проветрить' : (health.temperature_state === 'warm' ? 'Выше обычного' : 'Максимум по датчикам');
			root.querySelector('#system-uptime').textContent = `Время работы ${formatUptime(health.uptime)}`;
			root.querySelector('#memory-meter').style.width = `${Math.min(100, Number(health.memory_percent || 0))}%`;
			root.querySelector('#memory-detail').textContent = `${formatBytes(health.memory_used || 0)} / ${formatBytes(health.memory_total || 0)} (${health.memory_percent || 0}%)`;
			const loadPercent = Math.min(100, Math.max(0, Number(health.load || 0) * 25));
			root.querySelector('#load-meter').style.width = `${loadPercent}%`;
			root.querySelector('#load-detail').textContent = `Load average: ${Number(health.load || 0).toFixed(2)}`;
			root.querySelector('#active-source').textContent = sourceNames[vpnEngine === 'passwall' ? 'passwall' : (vpnEngine === 'podkop' ? 'podkop' : fresh.active_source)] || fresh.active_source;
			vpnEnabled = fresh.vpn_enabled === true;
			vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
			// A broken or half-started VPN must always remain possible to disable.
			vpnToggle.disabled = !vpnEnabled && vpnEngine === 'openclash' && fresh.active_source === 'none';
			vpnControlMessage.textContent = !vpnEnabled ? 'VPN выключен' :
				(fresh.vpn_ready === true ? 'VPN работает' : 'VPN запускается или требует внимания');
			const headerVpn = root.querySelector('#header-vpn-state');
			headerVpn.textContent = fresh.vpn_ready === true ? 'VPN работает' : (vpnEnabled ? 'VPN требует внимания' : 'VPN выключен');
			headerVpn.dataset.state = fresh.vpn_ready === true ? 'good' : (vpnEnabled ? 'warn' : 'off');
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
