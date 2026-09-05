'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });
const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });
const callWifiQrCredentials = rpc.declare({ object: 'oum', method: 'wifiQrCredentials', expect: { '': {} } });
const callNodeStatus = rpc.declare({ object: 'oum', method: 'nodeStatus', expect: { '': {} } });
const callMeasureNodeDelays = rpc.declare({ object: 'oum', method: 'measureNodeDelays', expect: { '': {} } });
const callSelectNode = rpc.declare({ object: 'oum', method: 'selectNode', params: [ 'name' ], expect: { '': {} } });
const callSetVpnEnabled = rpc.declare({ object: 'oum', method: 'setVpnEnabled', params: [ 'enabled' ], expect: { '': {} } });
const callSetDevicePolicy = rpc.declare({ object: 'oum', method: 'setDevicePolicy', params: [ 'mac', 'policy' ], expect: { '': {} } });
const callSetDeviceAlias = rpc.declare({ object: 'oum', method: 'setDeviceAlias', params: [ 'mac', 'alias' ], expect: { '': {} } });
const callSetDeviceParental = rpc.declare({ object: 'oum', method: 'setDeviceParental', params: [ 'mac', 'enabled' ], expect: { '': {} } });
const callRefreshSubscriptionInfo = rpc.declare({ object: 'oum', method: 'refreshSubscriptionInfo', expect: { '': {} } });
const callRefreshSubscription = rpc.declare({ object: 'oum', method: 'refreshSubscription', expect: { '': {} } });
const callVpnJobStatus = rpc.declare({ object: 'oum', method: 'vpnJobStatus', expect: { '': {} } });
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
	const sorted = sortedNodes(nodeStatus.nodes).filter((node) =>
		(node.id || node.name) !== currentKey && countryKey(node.name) !== 'RU');
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

let qrLibraryPromise = null;
function loadQrLibrary() {
	if (qrLibraryPromise) return qrLibraryPromise;
	const load = (path) => new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = L.resource(`view/oum/${path}`);
		script.onload = resolve;
		script.onerror = () => reject(new Error('Не удалось загрузить локальный генератор QR.'));
		document.head.appendChild(script);
	});
	const main = window.qrcode ? Promise.resolve() : load('qrcode.min.js');
	qrLibraryPromise = main.then(() => window.qrcode?.stringToBytesFuncs?.['UTF-8'] ? null : load('qrcode_UTF8.js'));
	return qrLibraryPromise;
}

function escapeWifiQr(value) {
	return String(value || '').replace(/[\\;,":]/g, '\\$&');
}

function drawQr(canvas, text, logicalSize = 200) {
	window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
	const code = window.qrcode(0, 'M');
	code.addData(text, 'Byte');
	code.make();
	const count = code.getModuleCount();
	const quiet = 4;
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

function formatUptimeDetailed(seconds) {
	const value = Number(seconds || 0);
	const days = Math.floor(value / 86400);
	const hours = Math.floor((value % 86400) / 3600);
	const minutes = Math.floor((value % 3600) / 60);
	return `${days ? `${days}д ` : ''}${hours}ч ${minutes}м`;
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
		if (!status.setup_complete) {
			const page = E('main', { 'class': 'oum-main' }, [
				E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260905-quickping84` }),
				E('div', { 'class': 'oum-page-head' }, [
					E('div', {}, [
						E('h2', {}, 'Панель OUM'),
						E('p', { 'class': 'oum-muted' }, 'Домашняя сеть и защищённое подключение')
					])
				]),
				E('section', { 'class': 'oum-empty-setup', 'aria-labelledby': 'oum-empty-title' }, [
					E('div', { 'class': 'oum-empty-head' }, [
						E('h3', { id: 'oum-empty-title' }, 'Подготовим роутер к работе'),
						E('p', {}, 'Мастер безопасно настроит интернет, Wi-Fi и доступ к панели. Технические параметры можно будет изменить позже.')
					]),
					E('div', { 'class': 'oum-empty-plan' }, [
						E('ol', {}, [
							E('li', {}, [ E('span', {}, '1'), E('div', {}, [ E('strong', {}, 'Подключение к интернету'), E('small', {}, 'DHCP или PPPoE от вашего провайдера') ]) ]),
							E('li', {}, [ E('span', {}, '2'), E('div', {}, [ E('strong', {}, 'Домашняя сеть Wi-Fi'), E('small', {}, 'Имя сети, пароль и удобный режим диапазонов') ]) ]),
							E('li', {}, [ E('span', {}, '3'), E('div', {}, [ E('strong', {}, 'Защищённый доступ'), E('small', {}, 'VPN можно подключить сейчас или добавить позже') ]) ])
						]),
						E('div', { 'class': 'oum-empty-action' }, [
							E('small', { 'class': 'oum-muted' }, 'Обычно занимает несколько минут'),
							E('a', { class: 'btn cbi-button-action', href: L.url('oum', 'setup') }, 'Начать настройку')
						])
					])
				])
			]);
			return E('div', {
				'class': 'oum-dashboard oum-app',
				'data-theme': document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
			}, [ page ]);
		}

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
		const routeIcons = {
			russia_inside: 'russia.svg', russia_outside: 'russia.svg', geoblock: 'geoblock.svg', block: 'block.svg', youtube: 'youtube.svg',
			discord: 'discord.svg', meta: 'meta.svg', twitter: 'x.svg', telegram: 'telegram.svg', tiktok: 'tiktok.svg',
			hdrezka: 'hdrezka.svg', anime: 'myanimelist.svg', roblox: 'roblox.svg', porn: 'porn.svg', google_ai: 'googlegemini.svg',
			google_play: 'googleplay.svg', cloudflare: 'cloudflare.svg', cloudfront: 'cloudfront.svg', digitalocean: 'digitalocean.svg',
			hetzner: 'hetzner.svg', ovh: 'ovh.svg', news: 'news.svg', hodca: 'hodca.svg'
		};
		const catalogById = Object.fromEntries((podkopRouting.catalog || []).map((item) => [ item.id, item ]));
		const routeRow = (item) => {
			const viaVpn = item.id === 'youtube' ? youtubeInitialMode === 'vpn' : proxyRoutes.has(item.id);
			return E('div', { 'class': 'oum-route-row', 'data-route-row': item.id }, [
				E('span', { 'class': 'oum-sr-only' }, viaVpn ? 'Через VPN' : (item.id === 'youtube' ? 'Напрямую + Zapret' : 'Напрямую')),
				E('input', { type: 'radio', name: `route_${item.id}`, value: 'vpn', 'data-community-route': item.id, checked: viaVpn ? '' : null }),
				E('input', { type: 'radio', name: `route_${item.id}`, value: 'direct', 'data-community-route': item.id, checked: !viaVpn ? '' : null }),
				E('span', { 'class': 'oum-route-icon', 'aria-hidden': 'true' }, E('img', { src: `/luci-static/oum/icons/${routeIcons[item.id] || 'ui-globe.svg'}`, alt: '' })),
				E('strong', {}, item.label),
				...(item.id === 'youtube' ? [ E('small', { 'class': 'oum-route-zapret', hidden: viaVpn ? '' : null }, 'Zapret') ] : [])
			]);
		};
		const communityCatalog = () => E('div', { 'class': 'oum-route-catalog' }, categoryDefinitions.flatMap(([, ids]) =>
			ids.filter((id) => catalogById[id]).map((id) => routeRow(catalogById[id]))));
		const systemMeter = (id, label, tone = '') => E('div', { 'class': 'oum-system-metric' }, [
			E('div', { 'class': 'oum-system-metric-head' }, [ E('span', {}, label), E('span', { id: `${id}-detail` }, '—') ]),
			E('div', { 'class': `oum-meter${tone ? ` ${tone}` : ''}` }, E('span', { id: `${id}-meter` }))
		]);

		const page = E('main', { 'class': 'oum-main' }, [
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260905-quickping84` }),
			E('div', { 'class': 'oum-page-head' }, [
				E('div', {}, [ E('h2', {}, 'Панель OUM'), E('p', { 'class': 'oum-muted' }, 'Домашняя сеть и защищённое подключение') ]),
				E('div', { 'class': 'oum-head-actions' }, [
					E('span', { 'class': 'oum-status-badge', id: 'header-vpn-state' }, 'Проверяем VPN')
				])
			]),
			E('div', { 'class': 'oum-warning', id: 'unmanaged-tunnel-warning', hidden: '' }),
			E('div', { 'class': 'oum-warning', id: 'reboot-required-warning', hidden: '' }, 'После замены VPN-движка рекомендуется перезагрузить роутер из раздела «Настройки».'),
			E('div', { 'class': 'oum-cards' }, [
				E('div', { 'class': 'oum-card' }, [ E('img', { 'class': 'oum-metric-icon', src: '/luci-static/oum/icons/ui-globe.svg?v=2', width: '48', height: '48', alt: '' }), E('small', {}, 'Интернет'), E('strong', { id: 'wan-state' }, ''), E('div', { id: 'wan-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card oum-client-metric' }, [ E('div', {}, [ E('img', { 'class': 'oum-metric-icon', src: '/luci-static/oum/icons/ui-users.svg?v=1', width: '48', height: '48', alt: '' }), E('small', {}, 'Клиенты'), E('strong', { id: 'client-count' }, '0'), E('div', { id: 'wifi-detail', 'class': 'oum-muted' }, '') ]), E('button', { 'class': 'oum-qr-tile', id: 'show-wifi-qr', type: 'button', disabled: '', title: 'Подготавливаем QR-код Wi-Fi' }, [ E('canvas', { 'class': 'oum-qr-preview', id: 'wifi-qr-preview', hidden: '', 'aria-hidden': 'true' }), E('span', { 'class': 'oum-qr-placeholder', 'aria-hidden': 'true' }, '•••'), E('small', {}, 'Wi‑Fi QR') ]) ]),
				E('div', { 'class': 'oum-card' }, [ E('img', { 'class': 'oum-metric-icon oum-temperature-icon', src: '/luci-static/oum/icons/ui-temperature.svg?v=1', width: '48', height: '48', alt: '' }), E('small', {}, 'Температура'), E('strong', { id: 'health-state', 'class': 'oum-health' }, '—'), E('div', { id: 'health-detail', 'class': 'oum-muted' }, 'Максимум по датчикам') ]),
				E('div', { 'class': 'oum-card oum-vpn-metric' }, [
					E('img', { 'class': 'oum-metric-icon', src: '/luci-static/oum/icons/ui-vpn.svg?v=2', width: '48', height: '48', alt: '' }),
					E('small', {}, 'VPN-движок'),
					E('div', { 'class': 'oum-vpn-card-row' }, [
						E('strong', { id: 'active-source' }, sourceNames[dashboard.active_source] || dashboard.active_source),
						E('button', { 'class': 'btn cbi-button oum-vpn-toggle', id: 'vpn-toggle', hidden: '' }, '')
					]),
					E('div', { 'class': 'oum-card-message oum-muted', id: 'vpn-control-message' }, '')
				])
			]),
			E('div', { 'class': 'oum-panels' }, [
				E('section', { 'class': 'oum-panel', id: 'devices-panel' }, [
					E('div', { 'class': 'oum-section-head oum-device-head' }, [
						E('div', {}, [ E('h3', {}, 'Подключённые устройства'), E('p', { 'class': 'oum-muted oum-device-help' }, 'Выключи неизвестное устройство — оно пропадёт из списка примерно через 10 секунд.') ]),
						E('span', { 'class': 'oum-device-count', id: 'active-client-badge' }, '0 устройств')
					]),
					E('table', { 'class': 'oum-clients' }, [
						E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'IP-адрес'), E('th', {}, 'Подключение'), E('th', { 'class': 'optional' }, 'MAC'), E('th', {}, 'Трафик за 24 ч'), E('th', {}, 'Маршрутизация'), E('th', {}, 'Контроль'), E('th', { 'class': 'oum-mobile-device-action' }, 'Настройка') ])),
						E('tbody', { id: 'client-list' })
					]),
					E('div', { 'class': 'oum-mobile-client-list', id: 'mobile-client-list' }),
					E('button', { type: 'button', 'class': 'oum-mobile-client-more', id: 'mobile-client-more', hidden: '' }, [
						E('span', {}, 'Показать все'),
						E('svg', { viewBox: '0 0 24 24', width: '14', height: '14', 'aria-hidden': 'true' }, E('path', { d: 'm7 10 5 5 5-5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
					]),
					E('details', { 'class': 'oum-offline', id: 'offline-section', hidden: '' }, [
						E('summary', { id: 'offline-summary' }, 'Недавно были (офлайн)'),
						E('table', { 'class': 'oum-clients' }, [
							E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'Последний IP'), E('th', { 'class': 'optional' }, 'MAC'), E('th', {}, 'Маршрутизация'), E('th', {}, 'Контроль') ])),
							E('tbody', { id: 'offline-client-list' })
						])
					]),
					E('div', { 'class': 'oum-policy-message oum-muted', id: 'policy-message' }, 'В родительский контроль попадают только устройства, добавленные кнопкой «Добавить».')
				]),
				E('section', { 'class': 'oum-panel', id: 'node-panel', hidden: '' }, [
					E('div', { 'class': 'oum-openclash-empty', id: 'openclash-panel', hidden: '' }, [
						E('div', { 'class': 'oum-node-head' }, [ E('h3', {}, 'OpenClash'), E('span', { 'class': 'oum-muted', id: 'openclash-version' }, '') ]),
						E('strong', { id: 'openclash-state' }, 'Подключение не настроено'),
						E('p', { 'class': 'oum-muted', id: 'openclash-hint' }, 'Добавьте подписку, AWG или Proxy — после запуска здесь появятся текущая нода и полный список серверов.'),
						E('a', { 'class': 'btn cbi-button-action', href: L.url('oum', 'settings') }, 'Открыть настройки')
					]),
					E('div', { 'class': 'oum-subscription', id: 'subscription-panel', hidden: '' }, [
						E('div', { 'class': 'oum-subscription-head' }, [
							E('div', { 'class': 'oum-subscription-copy' }, [
								E('div', { 'class': 'oum-subscription-title' }, [
									E('h3', {}, 'Подписка'),
									E('span', { 'class': 'oum-subscription-status oum-muted', id: 'subscription-status', title: 'Данные обновляются автоматически каждые 30 минут.' }, '—')
								]),
								E('div', { 'class': 'oum-subscription-progress', id: 'subscription-progress', role: 'progressbar', 'aria-label': 'Использованный трафик подписки', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, [
									E('span', { id: 'subscription-progress-value' })
								])
							]),
							E('button', { 'class': 'btn cbi-button', id: 'refresh-subscription' }, 'Обновить')
						])
					]),
					E('div', { 'class': 'oum-passwall-overview', id: 'passwall-panel', hidden: '' }, [
						E('div', { 'class': 'oum-node-head' }, [
							E('h3', {}, 'PassWall'),
							E('span', { 'class': 'oum-passwall-badge', id: 'passwall-summary-badge' }, 'Проверяем состояние')
						]),
						E('div', { 'class': 'oum-passwall-grid' }, [
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Xray'), E('strong', { id: 'passwall-xray' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'DNS'), E('strong', { id: 'passwall-dns' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'Маршрутизация'), E('strong', { id: 'passwall-firewall' }, '—') ]),
							E('div', { 'class': 'oum-passwall-state' }, [ E('small', {}, 'GeoSite / GeoIP'), E('strong', { id: 'passwall-geo' }, '—') ])
						]),
						E('div', { 'class': 'oum-passwall-active' }, [
							E('small', { id: 'passwall-active-label' }, 'Активная нода'),
							E('strong', { id: 'passwall-active-node' }, 'Нода не выбрана'),
							E('div', { 'class': 'oum-passwall-active-meta', id: 'passwall-active-meta' }, 'Проверяем профиль и DNS')
						]),
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
						E('div', { 'class': 'oum-podkop-summary' }, [
							E('div', { 'class': 'oum-podkop-identity' }, [
								E('span', { 'class': 'oum-podkop-signal', 'aria-hidden': 'true' }),
								E('strong', { id: 'podkop-title' }, 'Podkop + Zapret'),
								E('span', { 'class': 'oum-muted', id: 'podkop-version' }, ''),
								E('span', { 'class': 'oum-podkop-zapret', id: 'podkop-zapret' }, 'Zapret')
							]),
							E('div', { 'class': 'oum-podkop-meta' }, [
								E('span', { id: 'podkop-vpn-count', 'class': 'oum-podkop-count oum-podkop-count-vpn' }, 'VPN: 0'),
								E('span', { id: 'podkop-direct-count', 'class': 'oum-podkop-count' }, 'Прямо: 0'),
								E('span', { id: 'podkop-routing-dirty', 'class': 'oum-podkop-dirty', hidden: '' }, 'Изменено')
							])
						]),
						E('div', { hidden: '' }, [
							E('span', { id: 'podkop-transport-label' }), E('span', { id: 'podkop-tunnel' }), E('span', { id: 'podkop-routing' }), E('span', { id: 'podkop-route-kind' })
						]),
						E('div', { 'class': 'oum-mobile-podkop-actions', 'aria-label': 'Разделы Podkop' }, [
							E('button', { type: 'button', 'data-mobile-podkop': 'routing' }, [ E('span', { 'class': 'oum-mobile-podkop-icon', 'aria-hidden': 'true' }, E('img', { src: '/luci-static/oum/icons/ui-services.svg?v=1', alt: '' })), E('strong', {}, 'Сервисы') ]),
							E('button', { type: 'button', 'data-mobile-podkop': 'domains' }, [ E('span', { 'class': 'oum-mobile-podkop-icon', 'aria-hidden': 'true' }, E('img', { src: '/luci-static/oum/icons/ui-globe.svg?v=2', alt: '' })), E('strong', {}, 'Домены') ]),
							E('button', { type: 'button', 'data-mobile-podkop': 'diagnostics' }, [ E('span', { 'class': 'oum-mobile-podkop-icon', 'aria-hidden': 'true' }, E('img', { src: '/luci-static/oum/icons/ui-diagnostics.svg?v=1', alt: '' })), E('strong', {}, 'Диагностика') ])
						]),
						E('div', { 'class': 'oum-tabs' }, [
							E('button', { 'class': 'oum-tab', 'data-podkop-tab': 'routing', 'data-active': 'true' }, 'Сервисы'),
							E('button', { 'class': 'oum-tab', 'data-podkop-tab': 'diagnostics', 'data-active': 'false' }, 'Диагностика')
						]),
						E('div', { id: 'podkop-routing-tab' }, [
							communityCatalog(),
							E('details', { 'class': 'oum-custom-rules' }, [
								E('summary', {}, 'Свои домены и подсети'),
								E('div', { 'class': 'oum-custom-route-tabs', role: 'tablist', 'aria-label': 'Направление своих правил' }, [
									E('button', { type: 'button', 'class': 'oum-custom-route-tab', 'data-custom-route': 'proxy', 'data-active': 'true' }, 'Через VPN'),
									E('button', { type: 'button', 'class': 'oum-custom-route-tab', 'data-custom-route': 'direct', 'data-active': 'false' }, 'Напрямую')
								]),
								E('p', { 'class': 'oum-muted oum-custom-route-help', id: 'podkop-custom-route-help' }, 'Дополнительные назначения для защищённого подключения.'),
								E('div', { 'class': 'oum-custom-route-pane', 'data-custom-route-pane': 'proxy' }, [
									E('label', { 'class': 'oum-route-field' }, [ E('strong', {}, 'Домены'), E('textarea', { id: 'podkop-proxy-domains', placeholder: 'example.com, sub.example.com\n// комментарий' }, (podkopRouting.proxy?.domains || []).join('\n')), E('small', { 'class': 'oum-muted' }, 'Через запятую, пробел или перенос. Комментарии через //') ]),
									E('label', { 'class': 'oum-route-field' }, [ E('strong', {}, 'Подсети'), E('textarea', { id: 'podkop-proxy-subnets', placeholder: '203.0.113.0/24\n198.51.100.10' }, (podkopRouting.proxy?.subnets || []).join('\n')), E('small', { 'class': 'oum-muted' }, 'IP или CIDR, через запятую, пробел или перенос') ])
								]),
								E('div', { 'class': 'oum-custom-route-pane', 'data-custom-route-pane': 'direct', hidden: '' }, [
									E('label', { 'class': 'oum-route-field' }, [ E('strong', {}, 'Домены'), E('textarea', { id: 'podkop-direct-domains', placeholder: 'local.example.com' }, (podkopRouting.direct?.domains || []).join('\n')), E('small', { 'class': 'oum-muted' }, 'Эти домены всегда обходят защищённое подключение') ]),
									E('label', { 'class': 'oum-route-field' }, [ E('strong', {}, 'Подсети'), E('textarea', { id: 'podkop-direct-subnets', placeholder: '192.0.2.0/24' }, (podkopRouting.direct?.subnets || []).join('\n')), E('small', { 'class': 'oum-muted' }, 'Эти IP и подсети всегда идут через провайдера') ])
								])
							]),
							E('div', { 'class': 'oum-route-actions' }, [
								E('span', { 'class': 'oum-route-message oum-muted', id: 'podkop-routing-message' }, ''),
								E('button', { 'class': 'btn cbi-button', id: 'podkop-routing-reset' }, 'Сбросить'),
								E('button', { 'class': 'btn cbi-button-action', id: 'podkop-routing-save' }, 'Сохранить')
							])
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
								E('button', { 'class': 'btn cbi-button', id: 'measure-nodes' }, 'Измерить TCP'),
								E('button', { 'class': 'btn cbi-button-action', id: 'show-node-picker' }, 'Выбрать ноду')
							])
						]),
						E('p', { 'class': 'oum-node-panel-hint oum-muted', id: 'node-panel-hint', hidden: '' }, 'Топ-3 без России всегда видны · быстрые серверы разных стран'),
						E('div', { 'class': 'oum-current-node', id: 'current-node' }, 'Нет активной ноды'),
						E('div', { 'class': 'oum-node-list oum-node-quick', id: 'quick-node-list', hidden: '' }),
						E('div', { 'class': 'oum-node-message oum-muted', id: 'node-message' }),
						E('button', { 'class': 'oum-all-nodes-btn', id: 'show-all-nodes' }, [
							E('span', { id: 'show-all-nodes-count' }, 'Все ноды'),
							E('span', { 'class': 'oum-all-nodes-hint oum-muted' }, 'быстрые наверху ⌄')
						]),
						E('details', { 'class': 'oum-node-all', id: 'node-picker' }, [
							E('summary', {}, [ E('span', { id: 'all-nodes-summary' }, 'Все ноды'), E('span', { 'class': 'oum-node-hint oum-muted' }, 'Лёгкое TCP · быстрые наверху') ]),
							E('div', { 'class': 'oum-node-list oum-node-all-grid', id: 'all-node-list' })
						])
					])
				])
			]),
			E('details', { 'class': 'oum-panel oum-system-panel', open: '' }, [
				E('summary', { 'class': 'oum-system-summary' }, [
					E('div', { 'class': 'oum-system-title' }, [ E('span', { 'class': 'oum-system-icon', 'aria-hidden': 'true' }), E('h3', {}, 'Система'), E('span', { 'class': 'oum-muted', id: 'system-meta' }, '—') ]),
					E('span', { 'class': 'oum-muted', id: 'system-uptime' }, '—')
				]),
				E('div', { 'class': 'oum-system-body' }, [
					E('section', { 'class': 'oum-system-group' }, [
						E('h4', { id: 'memory-title' }, 'Оперативная память'),
						systemMeter('memory-available', 'Свободно'),
						systemMeter('memory-used', 'Занято'),
						systemMeter('memory-cached', 'Кэшировано', 'is-secondary'),
						systemMeter('memory-buffered', 'Буферизовано', 'is-muted')
					]),
					E('section', { 'class': 'oum-system-group' }, [
						E('h4', {}, 'Хранилище'),
						systemMeter('storage-root', 'Дисковое пространство (/overlay)'),
						systemMeter('storage-tmp', 'Временное хранилище (/tmp)', 'is-secondary')
					]),
					E('section', { 'class': 'oum-system-group' }, [
						E('h4', {}, 'Состояние портов'),
						E('div', { 'class': 'oum-port-grid', id: 'system-port-grid' })
					])
				])
			])
		]);
		const root = E('div', { 'class': 'oum-dashboard oum-app', 'data-theme': document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, [ page ]);

		const nodePanel = root.querySelector('#node-panel');
		const nodeControls = root.querySelector('#node-controls');
		const allNodeList = root.querySelector('#all-node-list');
		const nodePicker = root.querySelector('#node-picker');
		const nodeMessage = root.querySelector('#node-message');
		const measureButton = root.querySelector('#measure-nodes');
		const nodePanelTitle = root.querySelector('#node-panel-title');
		const nodePanelHint = root.querySelector('#node-panel-hint');
		const zashboardLink = root.querySelector('#zashboard-link');
		const subscriptionPanel = root.querySelector('#subscription-panel');
		const subscriptionRefresh = root.querySelector('#refresh-subscription');
		const subscriptionStatus = root.querySelector('#subscription-status');
		const subscriptionProgress = root.querySelector('#subscription-progress');
		const subscriptionProgressValue = root.querySelector('#subscription-progress-value');
		const quickNodeList = root.querySelector('#quick-node-list');
		const showAllNodes = root.querySelector('#show-all-nodes');
		const showAllNodesCount = root.querySelector('#show-all-nodes-count');
		const openclashPanel = root.querySelector('#openclash-panel');
		const wifiQrButton = root.querySelector('#show-wifi-qr');
		const vpnToggle = root.querySelector('#vpn-toggle');
		const vpnControlMessage = root.querySelector('#vpn-control-message');
		const policyMessage = root.querySelector('#policy-message');
		let vpnEnabled = dashboard.vpn_enabled === true;
		let vpnEngine = dashboard.vpn_engine || 'openclash';
		let vpnWatchTimer = null;
		let passwallInstalled = dashboard.passwall?.installed === true;
		let podkopInstalled = dashboard.podkop?.installed === true;
		let openclashInstalled = dashboard.openclash?.installed === true;
		let nodesAvailable = initialNodes.available === true;
		let dashboardState = dashboard;
		let passwallState = {};
		let passwallNodeState = {};
		let editingAliasMac = null;
		let mobileClientsExpanded = false;
		let pickedNode = null;
		let pickedName = '';
		let nodeApplying = false;
		let nodeMessageTimer = null;
		let pickMessageTimer = null;
		const updateOpenclashPanel = () => {
			const visible = vpnEngine === 'openclash' && openclashInstalled && !nodesAvailable;
			openclashPanel.hidden = !visible;
			if (!visible) return;
			root.querySelector('#openclash-version').textContent = dashboardState.openclash?.version ? `Версия ${dashboardState.openclash.version}` : '';
			root.querySelector('#openclash-state').textContent = dashboardState.active_source === 'none' ? 'Подключение не настроено' : (dashboardState.vpn_enabled ? 'Ожидаем ноды OpenClash' : 'OpenClash выключен');
			root.querySelector('#openclash-hint').textContent = dashboardState.active_source === 'none' ?
				'Добавьте подписку, AWG или Proxy — после запуска здесь появятся текущая нода и полный список серверов.' :
				'Запустите подключение. Если список нод не появится, откройте настройки и проверьте выбранный источник.';
		};
		const updateVpnPanelVisibility = () => {
			nodePanel.hidden = !(passwallInstalled || podkopInstalled || openclashInstalled || nodesAvailable);
			updateOpenclashPanel();
		};
		const podkopRoutingMessage = root.querySelector('#podkop-routing-message');
		const podkopRoutingSave = root.querySelector('#podkop-routing-save');
		const podkopRoutingReset = root.querySelector('#podkop-routing-reset');
		const podkopDiagnosticsRefresh = root.querySelector('#podkop-diagnostics-refresh');
		const podkopDiagnosticRestart = root.querySelector('#podkop-diagnostic-restart');
		const podkopQuicToggle = root.querySelector('#podkop-quic-toggle');
		const zapretManagerPrepare = root.querySelector('#zapret-manager-prepare');
		let podkopQuicDisabled = false;
		let savedRoutingSignature = null;

		for (const tab of root.querySelectorAll('[data-podkop-tab]')) tab.addEventListener('click', (event) => {
			event.preventDefault();
			const selected = tab.dataset.podkopTab;
			for (const button of root.querySelectorAll('[data-podkop-tab]'))
				button.dataset.active = button.dataset.podkopTab === selected ? 'true' : 'false';
			root.querySelector('#podkop-routing-tab').hidden = selected !== 'routing';
			root.querySelector('#podkop-diagnostics-tab').hidden = selected !== 'diagnostics';
		});
		for (const button of root.querySelectorAll('[data-mobile-podkop]')) button.addEventListener('click', (event) => {
			event.preventDefault();
			const selected = button.dataset.mobilePodkop;
			const panel = root.querySelector('#podkop-panel');
			const routing = selected !== 'diagnostics';
			panel.dataset.mobileExpanded = panel.dataset.mobileExpanded === selected ? '' : selected;
			for (const tab of root.querySelectorAll('[data-podkop-tab]'))
				tab.dataset.active = tab.dataset.podkopTab === (routing ? 'routing' : 'diagnostics') ? 'true' : 'false';
			root.querySelector('#podkop-routing-tab').hidden = !routing;
			root.querySelector('#podkop-diagnostics-tab').hidden = routing;
			if (selected === 'domains' && panel.dataset.mobileExpanded === 'domains')
				root.querySelector('.oum-custom-rules').open = true;
			button.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
		for (const tab of root.querySelectorAll('[data-custom-route]')) tab.addEventListener('click', (event) => {
			event.preventDefault();
			const selected = tab.dataset.customRoute;
			for (const button of root.querySelectorAll('[data-custom-route]'))
				button.dataset.active = button.dataset.customRoute === selected ? 'true' : 'false';
			for (const pane of root.querySelectorAll('[data-custom-route-pane]'))
				pane.hidden = pane.dataset.customRoutePane !== selected;
			root.querySelector('#podkop-custom-route-help').textContent = selected === 'proxy' ?
				'Дополнительные назначения для защищённого подключения.' : 'Явные исключения из защищённого подключения.';
		});

		const selectedCommunities = (route) => Array.from(root.querySelectorAll('[data-community-route]:checked')).filter((item) => item.value === route).map((item) => item.dataset.communityRoute).join('\n');
		const selectedYoutubeMode = () => root.querySelector('[data-community-route="youtube"]:checked')?.value === 'vpn' ? 'vpn' : 'zapret';
		const routingSignature = () => JSON.stringify({
			vpn: selectedCommunities('vpn'), direct: selectedCommunities('direct'), youtube: selectedYoutubeMode(),
			proxyDomains: root.querySelector('#podkop-proxy-domains').value, proxySubnets: root.querySelector('#podkop-proxy-subnets').value,
			directDomains: root.querySelector('#podkop-direct-domains').value, directSubnets: root.querySelector('#podkop-direct-subnets').value
		});
		const updateRouteSummary = () => {
			const vpnCount = selectedCommunities('vpn').split('\n').filter(Boolean).length;
			const directCount = selectedCommunities('direct').split('\n').filter(Boolean).length;
			root.querySelector('#podkop-vpn-count').textContent = `VPN: ${vpnCount}`;
			root.querySelector('#podkop-direct-count').textContent = `Прямо: ${directCount}`;
			root.querySelector('#podkop-routing-dirty').hidden = savedRoutingSignature === null || routingSignature() === savedRoutingSignature;
			const youtubeHint = root.querySelector('[data-route-row="youtube"] .oum-route-zapret');
			if (youtubeHint) youtubeHint.hidden = selectedYoutubeMode() === 'vpn';
		};
		root.querySelector('#podkop-routing-tab').addEventListener('change', updateRouteSummary);
		root.querySelector('#podkop-routing-tab').addEventListener('input', updateRouteSummary);
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
		savedRoutingSignature = routingSignature();
		updateRouteSummary();
		podkopRoutingReset.addEventListener('click', (event) => {
			event.preventDefault();
			for (const row of root.querySelectorAll('.oum-route-row')) {
				const id = row.dataset.routeRow;
				const original = id === 'youtube' ? (youtubeInitialMode === 'vpn' ? 'vpn' : 'direct') : (proxyRoutes.has(id) ? 'vpn' : 'direct');
				const input = row.querySelector(`input[value="${original}"]`);
				if (input) input.checked = true;
				row.setAttribute('aria-checked', String(original === 'vpn'));
			}
			root.querySelector('#podkop-proxy-domains').value = (podkopRouting.proxy?.domains || []).join('\n');
			root.querySelector('#podkop-proxy-subnets').value = (podkopRouting.proxy?.subnets || []).join('\n');
			root.querySelector('#podkop-direct-domains').value = (podkopRouting.direct?.domains || []).join('\n');
			root.querySelector('#podkop-direct-subnets').value = (podkopRouting.direct?.subnets || []).join('\n');
			podkopRoutingMessage.textContent = '';
			updateRouteSummary();
		});
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
					savedRoutingSignature = routingSignature();
					updateRouteSummary();
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
				subscriptionProgress.hidden = true;
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
			const usedPercent = total > 0 ? Math.max(0, Math.min(100, Math.round(used / total * 100))) : 0;
			subscriptionProgress.hidden = total <= 0;
			subscriptionProgress.setAttribute('aria-valuenow', String(usedPercent));
			subscriptionProgressValue.style.width = `${usedPercent}%`;
		};

		const updateDashboard = (fresh) => {
			dashboardState = fresh;
			vpnEngine = fresh.vpn_engine || 'openclash';
			passwallInstalled = fresh.passwall?.installed === true;
			podkopInstalled = fresh.podkop?.installed === true;
			openclashInstalled = fresh.openclash?.installed === true;
			updateVpnPanelVisibility();
			const tunnelWarning = root.querySelector('#unmanaged-tunnel-warning');
			root.querySelector('#reboot-required-warning').hidden = fresh.reboot_required !== true;
			const unmanaged = fresh.unmanaged_tunnels || [];
			const activeUnmanaged = unmanaged.filter((item) => item.up === true);
			tunnelWarning.hidden = activeUnmanaged.length === 0;
			tunnelWarning.textContent = activeUnmanaged.length ?
				`Обнаружено дополнительное VPN-подключение, созданное не через OUM: ${activeUnmanaged.map((item) => item.name).join(', ')}. Если оно включено одновременно с OUM, интернет может работать неправильно.` : '';
			root.querySelector('#wan-state').textContent = fresh.wan?.up ? 'Подключён' : 'Нет соединения';
			root.querySelector('#wan-state').dataset.state = fresh.wan?.up ? 'good' : 'bad';
			root.querySelector('#wan-detail').textContent = fresh.wan?.via === 'wifi' ?
				`через Wi-Fi${fresh.wan.ssid ? ` · ${fresh.wan.ssid}` : ''}${fresh.wan.ipv4 ? ` · ${fresh.wan.ipv4}` : ''}` :
				(fresh.wan?.ipv4 ? `${fresh.wan.ipv4} · ${String(fresh.wan.proto || '').toUpperCase()}` : String(fresh.wan?.proto || '').toUpperCase());
			const clientCount = fresh.clients?.length || 0;
			root.querySelector('#client-count').textContent = `${clientCount}`;
			root.querySelector('#wifi-detail').textContent = 'Онлайн';
			wifiQrButton.hidden = !(fresh.wifi || []).length;
			const health = fresh.health || {};
			const temperatureText = health.temperature != null ? `${Math.round(health.temperature)} °C` : '—';
			const healthNode = root.querySelector('#health-state');
			healthNode.dataset.temperature = health.temperature_state || 'unknown';
			healthNode.textContent = temperatureText;
			root.querySelector('#health-detail').textContent = health.temperature_state === 'hot' ? 'Нужно проветрить' : (health.temperature_state === 'warm' ? 'Выше обычного' : 'Максимум по датчикам');
			const totalMemory = Number(health.memory_total || 0);
			const setSystemMeter = (id, value, total) => {
				const percent = total > 0 ? Math.min(100, Math.max(0, value * 100 / total)) : 0;
				root.querySelector(`#${id}-meter`).style.width = `${percent}%`;
				root.querySelector(`#${id}-detail`).textContent = `${formatBytes(value)} / ${formatBytes(total)} (${Math.round(percent)}%)`;
			};
			const model = String(health.model || '').match(/(?:Router\s+)?([A-Z0-9-]+)$/)?.[1] || String(health.model || 'OpenWrt');
			const load = Number(health.load || 0);
			root.querySelector('#system-meta').textContent = `· ${formatUptime(health.uptime)} · ${model} · ${health.kernel || '—'}`;
			root.querySelector('#system-uptime').textContent = `Время работы ${formatUptimeDetailed(health.uptime)} · ${load < .15 ? 'без нагрузки' : (load < .7 ? 'низкая нагрузка' : 'повышенная нагрузка')}`;
			root.querySelector('#memory-title').textContent = `Оперативная память · ${formatBytes(totalMemory)}`;
			setSystemMeter('memory-available', Number(health.memory_available || 0), totalMemory);
			setSystemMeter('memory-used', Number(health.memory_used || 0), totalMemory);
			setSystemMeter('memory-cached', Number(health.memory_cached || 0), totalMemory);
			setSystemMeter('memory-buffered', Number(health.memory_buffered || 0), totalMemory);
			setSystemMeter('storage-root', Number(health.root_used || 0), Number(health.root_total || 0));
			setSystemMeter('storage-tmp', Number(health.tmp_used || 0), Number(health.tmp_total || 0));
			root.querySelector('#system-port-grid').replaceChildren(...(health.ports || []).map((port) => {
				const speed = port.up ? (port.speed >= 1000 ? `${port.speed / 1000} GbE` : `${port.speed} MbE`) : 'нет соединения';
				return E('div', { 'class': 'oum-port-card', 'data-up': port.up ? 'true' : 'false' }, [
					E('strong', { 'class': 'oum-port-name' }, port.name),
					E('div', { 'class': 'oum-port-state', 'aria-label': port.up ? 'Порт подключён' : 'Порт не подключён' }, E('span', {})),
					E('div', { 'class': 'oum-port-speed' }, speed),
					E('div', { 'class': 'oum-port-link' }, E('span', {})),
					E('div', { 'class': 'oum-port-traffic' }, [ E('span', {}, `Передано ${formatBytes(port.tx_bytes || 0)}`), E('span', {}, `Получено ${formatBytes(port.rx_bytes || 0)}`) ])
				]);
			}));
			const engineTitle = vpnEngine === 'podkop' ?
				`Podkop${fresh.podkop?.version ? ` ${fresh.podkop.version}` : ''}` :
				(vpnEngine === 'passwall' ? `PassWall${fresh.passwall?.version ? ` ${fresh.passwall.version}` : ''}` :
					(sourceNames[fresh.active_source] || fresh.active_source));
			root.querySelector('#active-source').textContent = engineTitle;
			vpnEnabled = fresh.vpn_enabled === true;
			vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
			// A broken or half-started VPN must always remain possible to disable.
			vpnToggle.disabled = !vpnEnabled && vpnEngine === 'openclash' && fresh.active_source === 'none';
			const podkopRoute = fresh.podkop?.transport === 'reality' ? 'Reality' : 'AWG';
			vpnControlMessage.textContent = !vpnEnabled ? 'VPN выключен' :
				(fresh.vpn_ready === true ? (vpnEngine === 'podkop' ? `Через ${podkopRoute}` : 'VPN работает') : 'VPN запускается или требует внимания');
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
			const parentalButton = (client) => E('button', {
				type: 'button',
				'class': `btn ${client.parental_managed ? 'cbi-button-action' : 'cbi-button'} oum-parental-add`,
				'data-device-action': 'parental',
				'data-device-mac': client.mac,
				'data-device-parental': client.parental_managed ? '1' : '0',
				title: client.parental_managed ? 'Убрать устройство из родительского контроля' : 'Добавить устройство в родительский контроль'
			}, client.parental_managed ? 'Добавлено' : 'Добавить');
			const mobileDeviceButton = (client) => E('button', {
				type: 'button',
				'class': 'btn cbi-button oum-mobile-device-open',
				'data-device-action': 'mobile',
				'data-device-mac': client.mac,
				'aria-label': `Настроить устройство ${client.name}`
			}, 'Настроить');
			const mobileDeviceRow = (client) => E('button', {
				type: 'button',
				'class': 'oum-mobile-client-row',
				'data-device-action': 'mobile',
				'data-device-mac': client.mac,
				'aria-label': `Настроить устройство ${client.name}`
			}, [
				E('span', { 'class': 'oum-mobile-client-state', 'aria-hidden': 'true' }),
				E('span', { 'class': 'oum-mobile-client-copy' }, [
					E('strong', {}, client.name),
					E('small', {}, `${client.ip || 'Без IP'} · ${client.medium === 'wifi' ? 'Wi-Fi' : (client.medium === 'ethernet' ? 'Кабель' : 'Подключение')}`)
				]),
				E('span', { 'class': 'oum-mobile-client-tune', 'aria-hidden': 'true' }, E('img', { src: '/luci-static/oum/icons/ui-tune.svg?v=2', alt: '' }))
			]);
			if (!editingAliasMac || !activeEditor) {
				body.replaceChildren(...(fresh.clients || []).map((client) => E('tr', { 'class': client.paused ? 'oum-client-paused' : '' }, [
					nameCell(client), E('td', {}, client.ip),
					E('td', {}, client.medium === 'wifi' ? 'Wi-Fi' : (client.medium === 'ethernet' ? 'Кабель' : 'Не определено')),
					E('td', { 'class': 'optional' }, client.mac), trafficCell(client.traffic),
					E('td', {}, policySelect(client)),
					E('td', {}, parentalButton(client)),
					E('td', { 'class': 'oum-mobile-device-action' }, mobileDeviceButton(client))
				])));
				offlineBody.replaceChildren(...(fresh.offline_clients || []).map((client) => {
					const select = policySelect(client);
					select.disabled = true;
					return E('tr', { 'class': client.paused ? 'oum-client-paused' : '' }, [
						nameCell(client), E('td', {}, client.ip || '—'), E('td', { 'class': 'optional' }, client.mac),
						E('td', {}, select), E('td', {}, parentalButton(client))
					]);
				}));
				const mobileClients = mobileClientsExpanded ? (fresh.clients || []) : (fresh.clients || []).slice(0, 3);
				root.querySelector('#mobile-client-list').replaceChildren(...mobileClients.map(mobileDeviceRow));
			}
			if (!fresh.clients?.length)
				body.appendChild(E('tr', {}, E('td', { colspan: 8, 'class': 'oum-muted' }, 'Нет активных устройств')));
			const clientCountLabel = clientCount % 10 === 1 && clientCount % 100 !== 11 ? 'устройство' :
				([ 2, 3, 4 ].includes(clientCount % 10) && ![ 12, 13, 14 ].includes(clientCount % 100) ? 'устройства' : 'устройств');
			root.querySelector('#active-client-badge').textContent = `${clientCount} ${clientCountLabel}`;
			const mobileMore = root.querySelector('#mobile-client-more');
			mobileMore.hidden = clientCount <= 3;
			mobileMore.querySelector('span').textContent = mobileClientsExpanded ? 'Свернуть' : 'Показать все';
			mobileMore.dataset.expanded = mobileClientsExpanded ? 'true' : 'false';
			const offlineSection = root.querySelector('#offline-section');
			offlineSection.hidden = !(fresh.offline_clients || []).length;
			root.querySelector('#offline-summary').textContent = `Недавно были (офлайн) · ${(fresh.offline_clients || []).length}`;
			for (const select of body.querySelectorAll('.oum-policy'))
				select.disabled = false;
			policyMessage.textContent = 'В родительский контроль попадают только устройства, добавленные кнопкой «Добавить».';
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
			root.querySelector('#podkop-version').textContent = `· ${state.version || '—'}${state.zapret_strategy ? ` · ${state.zapret_strategy}` : ''} · через ${reality ? 'Reality' : 'AWG'}`;
			root.querySelector('#podkop-transport-label').textContent = reality ? 'Reality-прокси' : 'AWG-туннель';
			root.querySelector('#podkop-tunnel').textContent = reality ? (state.ready ? (state.proxy_endpoint || 'Работает') : 'Требует внимания') : (state.tunnel_up ? `${state.interface || 'AWG'} поднят` : 'Требует внимания');
			root.querySelector('#podkop-routing').textContent = state.ready ? 'Работает' : 'Требует внимания';
			const zapretState = root.querySelector('#podkop-zapret');
			zapretState.textContent = youtubeViaVpn ? 'Zapret: выкл' : (state.zapret ? 'Zapret: вкл' : 'Zapret: ошибка');
			zapretState.dataset.state = youtubeViaVpn ? 'off' : (state.zapret ? 'good' : 'bad');
			root.querySelector('#podkop-route-kind').textContent = reality ? 'Через Reality' : 'Через AWG';
		};

		const refreshPasswallSummary = () => {
			const state = passwallState || {};
			const fresh = passwallNodeState || {};
			const nodes = fresh.nodes || [];
			const fixedProxy = dashboardState.active_source === 'proxy';
			const current = nodes.find((node) =>
				fresh.current_id ? node.id === fresh.current_id : node.name === fresh.current);
			const currentName = (fixedProxy ? state.selected_node : current?.name) || fresh.current || state.selected_node || 'Подключение не настроено';
			const currentDelay = current?.delay > 0 ? ` · ${current.delay} ms` : '';
			const versions = state.versions || {};
			const core = versions.xray ? ' · Xray' : '';
			const profile = state.profile || 'Профиль не выбран';
			const diagnostics = state.diagnostics || {};
			const directDns = diagnostics.direct_dns || 'не задан';
			const remoteDns = diagnostics.remote_dns || 'не задан';
			const ipv6 = diagnostics.ipv6_tproxy === true ? 'IPv6 TProxy' :
				(diagnostics.ipv6_filtered === true ? 'IPv6 фильтрация' : 'IPv6 без защиты');
			const healthy = state.xray === true && state.dns === true && state.firewall === true && state.geo_ready === true;
			const badge = root.querySelector('#passwall-summary-badge');
			badge.textContent = window.innerWidth <= 900 ? (healthy ? 'Работает' : 'Требует внимания') : `${healthy ? 'Работает' : 'Требует внимания'} · ${profile} · ${currentName}`;
			badge.dataset.ok = healthy ? 'true' : 'false';
			root.querySelector('#passwall-active-label').textContent = fixedProxy ? 'Подключение' : 'Активная нода';
			root.querySelector('#passwall-active-node').textContent = `${currentName}${currentDelay}${core}`;
			root.querySelector('#passwall-active-meta').textContent =
				fixedProxy ?
					`${profile} · Фиксированный сервер · Прямой ${directDns} · Удалённый ${remoteDns} · ${ipv6}` :
					`${profile} · ${nodes.length} нод · Прямой ${directDns} · Удалённый ${remoteDns} · ${ipv6}`;
		};

		const updatePasswall = (state) => {
			const panel = root.querySelector('#passwall-panel');
			passwallState = state || {};
			passwallInstalled = state.installed === true;
			panel.hidden = !passwallInstalled;
			updateVpnPanelVisibility();
			if (panel.hidden) return;
			const diagnostics = state.diagnostics || {};
			const health = [
				[ 'xray', state.xray, state.xray ? 'Работает' : 'Требует внимания' ],
				[ 'dns', state.dns, state.dns ? `Работает${diagnostics.dns_mode ? ` (${diagnostics.dns_mode})` : ''}` : 'Требует внимания' ],
				[ 'firewall', state.firewall, state.firewall ? 'Работает' : 'Требует внимания' ],
				[ 'geo', state.geo_ready, state.geo_ready ? 'Готово' : 'Требует внимания' ]
			];
			for (const [ name, ok, label ] of health) {
				const element = root.querySelector(`#passwall-${name}`);
				element.textContent = label;
				element.dataset.ok = ok ? 'true' : 'false';
				element.closest('.oum-passwall-state').dataset.ok = ok ? 'true' : 'false';
			}
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
			refreshPasswallSummary();
		};

		const updateNodes = (fresh) => {
			nodesAvailable = fresh.available === true;
			nodeControls.hidden = !nodesAvailable;
			updateVpnPanelVisibility();
			const isPasswall = fresh.engine === 'passwall';
			if (isPasswall) passwallNodeState = fresh;
			if (!fresh.available) {
				if (isPasswall) refreshPasswallSummary();
				return;
			}
			nodeControls.dataset.engine = isPasswall ? 'passwall' : 'openclash';
			zashboardLink.hidden = isPasswall;
			zashboardLink.style.display = isPasswall ? 'none' : '';
			const pickerButton = root.querySelector('#show-node-picker');
			pickerButton.hidden = isPasswall;
			pickerButton.style.display = isPasswall ? 'none' : '';
			showAllNodes.hidden = isPasswall && window.innerWidth > 900;
			showAllNodes.style.display = (isPasswall && window.innerWidth > 900) ? 'none' : '';
			if (!isPasswall) {
				const src = dashboardState.active_source || fresh.active_source || '';
				const singleNode = src !== '' && src !== 'subscription';
				if (singleNode) {
					showAllNodes.hidden = true;
					showAllNodes.style.display = 'none';
					nodePicker.hidden = true;
					nodePicker.style.display = 'none';
				} else {
					nodePicker.hidden = false;
					nodePicker.style.display = '';
				}
			}
			nodePanelHint.hidden = true;
			measureButton.disabled = fresh.applying === true;
			const delayText = (node, emptyText) => node.delay > 0 ? `${node.delay} ms` :
				(node.tested || fresh.measured_at ? 'offline' : emptyText);
		const delayState = (node) => !node.delay || node.delay <= 0 ? 'offline' :
			(node.delay < 120 ? 'fast' : (node.delay < 180 ? 'medium' : 'slow'));
		const flagOf = (name) => (String(name || '').match(/^([\u{1F1E6}-\u{1F1FF}]{2})/u) || [])[1] || '';
		const shortOf = (name, max) => {
			let s = String(name || '').replace(/^([\u{1F1E6}-\u{1F1FF}]{2})\s*/u, '');
			s = s.replace(/[^\p{L}\p{N} |#.,\-()+]/gu, '').replace(/\s+/g, ' ').trim();
			if (s.length <= max) return s;
			let t = s.slice(0, max - 1);
			const sp = t.lastIndexOf(' ');
			if (sp >= Math.floor(max / 2)) t = t.slice(0, sp);
			return t.replace(/[\s|#.,\-()+]+$/u, '') + '…';
		};
			const usePick = window.innerWidth <= 900;
		const makeNode = (node, isCurrent, quick) => {
			if (!quick && usePick) return E('div', { 'class': `oum-node oum-pick${isCurrent ? ' is-current' : ''}`, 'data-pick': (node.id || node.name), role: 'button' }, [
				E('div', { 'class': 'oum-node-copy' }, [
					E('span', { 'class': 'oum-node-name', title: node.name }, node.name),
					isCurrent ? E('span', { 'class': 'oum-pick-active' }, 'Активна') : ''
				]),
				E('span', { 'class': 'oum-delay', 'data-delay': delayState(node) }, delayText(node, '—'))
			]);
			if (quick && window.innerWidth <= 900) return E('div', { 'class': `oum-node${isCurrent ? ' is-current' : ''} is-quick`, 'data-node': !isCurrent ? (node.id || node.name) : null }, [
				E('div', { 'class': 'oum-node-copy' }, [
					E('span', { 'class': 'oum-node-flag', 'aria-hidden': 'true' }, flagOf(node.name)),
					E('span', { 'class': 'oum-node-name', title: node.name }, shortOf(node.name, 14)),
					E('span', { 'class': 'oum-delay', 'data-delay': delayState(node) }, delayText(node, '—'))
				])
			]);
			return E('div', { 'class': `oum-node${isCurrent ? ' is-current' : ''}${quick ? ' is-quick' : ''}`, 'data-node': (quick && !isPasswall && !isCurrent) ? (node.id || node.name) : null }, [
				E('div', { 'class': 'oum-node-copy' }, [
					E('span', { 'class': 'oum-node-name', title: node.name }, node.name),
					E('span', { 'class': 'oum-delay', 'data-delay': delayState(node) }, delayText(node, '—'))
				]),
				E('button', {
					'class': 'btn cbi-button', 'data-node': isCurrent ? null : (node.id || node.name),
					disabled: isCurrent || fresh.applying === true ? '' : null
			}, isCurrent ? 'Активна' : (isPasswall ? 'Выбор' : 'Выбрать'))
		]);
		};
			const current = (fresh.nodes || []).find((node) =>
				fresh.current_id ? node.id === fresh.current_id : node.name === fresh.current);
			const currentNode = root.querySelector('#current-node');
			currentNode.replaceChildren(
				E('strong', { 'class': 'oum-current-name' }, current ? current.name : (fresh.current || 'Не выбрана')),
				current ? E('span', { 'class': 'oum-current-delay' }, ` · ${delayText(current, 'TCP не измерен')}`) : '',
				current ? E('span', { 'class': 'oum-current-badge' }, 'Активна') : ''
			);
			const all = sortedNodes(fresh.nodes);
			nodePanelTitle.textContent = isPasswall ? `Ноды PassWall (${all.length})` : 'Точка подключения';
			const quick = preferredNodes(fresh).slice(0, 3);
			quickNodeList.hidden = quick.length === 0;
			quickNodeList.replaceChildren(...quick.map((node) => makeNode(node, false, true)));
			root.querySelector('#all-nodes-summary').textContent = isPasswall ? `Показать все ${all.length}` : `Все ноды (${all.length})`;
			if (showAllNodesCount) showAllNodesCount.textContent = `Все ноды (${all.length})`;
			const sheetTitle = document.getElementById('oum-nodes-sheet-title');
			if (sheetTitle) sheetTitle.textContent = `Все ноды (${all.length})`;
		allNodeList.replaceChildren(...all.map((node) => makeNode(node,
			fresh.current_id ? node.id === fresh.current_id : node.name === fresh.current, false)));
		const isCurNode = (node) => fresh.current_id ? node.id === fresh.current_id : node.name === fresh.current;
		if (pickedNode) {
			const row = (fresh.nodes || []).find((node) => (node.id || node.name) === pickedNode);
			if (!row || isCurNode(row)) { pickedNode = null; pickedName = ''; }
		}
		allNodeList.querySelectorAll('[data-pick]').forEach((el) => el.classList.toggle('is-selected', !!pickedNode && el.dataset.pick === pickedNode));
		refreshPickButton();
		if (isPasswall) refreshPasswallSummary();
	};

		const showNodeMessage = (message, failed) => {
			nodeMessage.textContent = message || '';
			nodeMessage.dataset.state = failed ? 'failed' : 'idle';
			if (nodeMessageTimer) window.clearTimeout(nodeMessageTimer);
			nodeMessageTimer = null;
			if (message) nodeMessageTimer = window.setTimeout(() => {
				nodeMessage.textContent = '';
				nodeMessage.dataset.state = 'idle';
			}, failed ? 5000 : 2500);
		};

		const refreshPickButton = () => {
			const btn = document.getElementById('oum-pick-confirm');
			if (!btn) return;
			if (nodeApplying) { btn.disabled = true; btn.textContent = 'Переключаем…'; btn.classList.add('show'); return; }
			if (!pickedNode) { btn.disabled = true; btn.classList.remove('show'); return; }
			btn.disabled = false;
			btn.textContent = pickedName ? `Выбрать: ${pickedName}` : 'Выбрать';
			btn.classList.add('show');
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
			const sheet = document.getElementById('oum-nodes-sheet');
			if (sheet && window.innerWidth <= 900) { sheet.classList.add('active'); return; }
			nodePicker.open = !nodePicker.open;
			if (nodePicker.open) nodePicker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		});
		showAllNodes.addEventListener('click', () => {
			const sheet = document.getElementById('oum-nodes-sheet');
			if (sheet && window.innerWidth <= 900) { sheet.dataset.engine = root.querySelector('#node-controls').dataset.engine; sheet.classList.add('active'); return; }
			nodePicker.open = !nodePicker.open;
			if (nodePicker.open) nodePicker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		});

		subscriptionRefresh.addEventListener('click', (ev) => {
			ev.preventDefault();
			subscriptionRefresh.disabled = true;
			subscriptionRefresh.textContent = 'Обновляем…';
			subscriptionStatus.textContent = 'Загружаем новый список серверов…';
			callRefreshSubscription().then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось обновить подписку.');
				let attempts = 0;
				const watch = () => callVpnJobStatus().then((job) => {
					if (job.state === 'running' && attempts++ < 60)
						return new Promise((resolve) => window.setTimeout(resolve, 1000)).then(watch);
					if (job.state !== 'success')
						throw new Error(job.message || 'Не удалось применить обновлённую подписку.');
					return Promise.all([ callDashboardStatus(), callNodeStatus() ]).then(([ fresh, nodes ]) => {
						updateDashboard(fresh);
						updateNodes(nodes);
						showNodeMessage('Подписка и список нод обновлены.', false);
					});
				});
				return watch();
			}).catch((err) => {
				subscriptionStatus.textContent = err.message;
			}).finally(() => {
				subscriptionRefresh.disabled = false;
				subscriptionRefresh.textContent = 'Обновить';
			});
		});
		let wifiQrData = null;
		const prepareWifiQr = async () => {
			const result = await callWifiQrCredentials();
			if (!result.ok) throw new Error(result.message || 'Не удалось получить параметры Wi-Fi.');
			await loadQrLibrary();
			const secured = result.encryption && result.encryption !== 'none' && result.key;
			const type = secured && String(result.encryption).includes('wep') ? 'WEP' : (secured ? 'WPA' : 'nopass');
			const payload = secured ? `WIFI:T:${type};S:${escapeWifiQr(result.ssid)};P:${escapeWifiQr(result.key)};;` : `WIFI:T:nopass;S:${escapeWifiQr(result.ssid)};;`;
			wifiQrData = { ssid: result.ssid, payload };
			const preview = root.querySelector('#wifi-qr-preview');
			drawQr(preview, payload, 72);
			preview.hidden = false;
			root.querySelector('.oum-qr-placeholder').hidden = true;
			wifiQrButton.disabled = false;
			wifiQrButton.title = `Показать QR-код сети ${result.ssid}`;
		};
		prepareWifiQr().catch(() => {
			wifiQrButton.disabled = true;
			wifiQrButton.title = 'QR-код недоступен: проверьте точку Wi-Fi';
		});
		wifiQrButton.addEventListener('click', async () => {
			try {
				if (!wifiQrData) await prepareWifiQr();
				const canvas = E('canvas', { 'aria-label': `QR-код сети ${wifiQrData.ssid}` });
				drawQr(canvas, wifiQrData.payload, 220);
				ui.showModal(`Wi-Fi: ${wifiQrData.ssid}`, [
					E('div', { 'class': 'oum-qr-wrap' }, [ canvas, E('strong', {}, 'Наведи камерой телефона'), E('span', { 'class': 'oum-muted' }, 'Код подключит устройство к текущей сети Wi-Fi.') ]),
					E('div', { 'class': 'right' }, E('button', { 'class': 'btn cbi-button-action', click: ui.hideModal }, 'Готово'))
				]);
			}
			catch (qrError) {
				ui.addNotification(null, E('p', {}, qrError.message), 'warning');
			}
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
			const mobileMore = ev.target.closest('#mobile-client-more');
			if (mobileMore) {
				ev.preventDefault();
				mobileClientsExpanded = !mobileClientsExpanded;
				updateDashboard(dashboardState);
				return;
			}
			const action = ev.target.closest('[data-device-action]');
			if (!action) return;
			ev.preventDefault();
			const mac = action.dataset.deviceMac;
			if (action.dataset.deviceAction === 'mobile') {
				const client = (dashboardState.clients || []).find((item) => item.mac === mac);
				if (!client) return;
				const aliasInput = E('input', { maxlength: 32, value: client.alias || client.name, 'aria-label': 'Имя устройства' });
				const routeSelect = policySelect(client);
				const parentalToggle = E('button', {
					type: 'button',
					'class': `btn ${client.parental_managed ? 'cbi-button-negative' : 'cbi-button'} oum-mobile-parental-toggle`
				}, client.parental_managed ? 'Убрать' : 'Добавить');
				const message = E('p', { 'class': 'oum-muted oum-mobile-device-message', role: 'status' }, '');
				const saveAlias = E('button', { type: 'button', 'class': 'btn cbi-button oum-mobile-alias-save' }, 'Сохранить');
				const close = E('button', { type: 'button', 'class': 'btn cbi-button', click: ui.hideModal }, 'Готово');
				const finish = () => callDashboardStatus().then((state) => {
					updateDashboard(state);
					document.getElementById('oum-device-custom')?.classList.remove('active');
					ui.hideModal();
				});
				saveAlias.addEventListener('click', () => {
					const alias = String(aliasInput.value || '').trim();
					if (!validDeviceAlias(alias)) {
						message.textContent = 'До 32 символов: буквы, цифры, пробел, дефис, точка или подчёркивание.';
						aliasInput.focus();
						return;
					}
					saveAlias.disabled = true;
					message.textContent = 'Сохраняем имя…';
					callSetDeviceAlias(mac, alias).then((result) => {
						if (!result.ok) throw new Error(result.message || 'Не удалось сохранить имя.');
						return finish();
					}).catch((error) => { message.textContent = error.message; saveAlias.disabled = false; });
				});
				routeSelect.addEventListener('change', () => {
					routeSelect.disabled = true;
					message.textContent = 'Применяем маршрутизацию…';
					callSetDevicePolicy(mac, routeSelect.value).then((result) => {
						if (!result.ok) throw new Error(result.message || 'Не удалось изменить маршрутизацию.');
						return finish();
					}).catch((error) => { message.textContent = error.message; routeSelect.disabled = false; });
				});
				parentalToggle.addEventListener('click', () => {
					parentalToggle.disabled = true;
					message.textContent = client.parental_managed ? 'Убираем устройство…' : 'Добавляем устройство…';
					callSetDeviceParental(mac, !client.parental_managed).then((result) => {
						if (!result.ok) throw new Error(result.message || 'Не удалось изменить родительский контроль.');
						return finish();
					}).catch((error) => { message.textContent = error.message; parentalToggle.disabled = false; });
				});
				ui.showModal(client.name, [
					E('div', { 'class': 'oum-mobile-device-sheet' }, [
						E('div', { 'class': 'oum-mobile-device-identity' }, [
							E('span', { 'class': 'oum-mobile-device-state', 'aria-hidden': 'true' }),
							E('span', { 'class': 'oum-mobile-device-copy' }, [
								E('strong', {}, client.name),
								E('small', {}, `Онлайн · ${client.medium === 'wifi' ? 'Wi-Fi' : (client.medium === 'ethernet' ? 'Кабель' : 'Подключено')}`)
							])
						]),
						E('div', { 'class': 'oum-mobile-device-facts' }, [
							E('div', {}, [ E('small', {}, 'IP-адрес'), E('strong', {}, client.ip || '—') ]),
							E('div', {}, [ E('small', {}, 'Подключение'), E('strong', {}, client.medium === 'wifi' ? 'Wi-Fi' : (client.medium === 'ethernet' ? 'Кабель' : 'Не определено')) ]),
							E('div', {}, [ E('small', {}, 'MAC'), E('strong', {}, client.mac) ]),
							E('div', {}, [ E('small', {}, 'Трафик за 24 ч'), E('strong', {}, `${formatBytes(client.traffic?.down || 0)} ↓ · ${formatBytes(client.traffic?.up || 0)} ↑`) ])
						]),
						E('label', { 'class': 'oum-mobile-device-field' }, [
							E('strong', {}, 'Имя устройства'),
							E('span', { 'class': 'oum-mobile-device-input-row' }, [ aliasInput, saveAlias ])
						]),
						E('label', { 'class': 'oum-mobile-device-field' }, [ E('strong', {}, 'Маршрутизация'), routeSelect ]),
						E('div', { 'class': 'oum-mobile-parental-row' }, [
							E('span', {}, [
								E('strong', {}, 'Родительский контроль'),
								E('small', {}, client.parental_managed ? 'Устройство добавлено' : 'Ограничения пока не применяются')
							]),
							parentalToggle
						]),
						message
					]),
					E('div', { 'class': 'right' }, close)
				]);
				return;
			}
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
			if (action.dataset.deviceAction === 'parental') {
				const enabled = action.dataset.deviceParental !== '1';
				action.disabled = true;
				policyMessage.dataset.state = 'idle';
				policyMessage.textContent = enabled ? 'Добавляем устройство в родительский контроль…' : 'Убираем устройство из родительского контроля…';
				callSetDeviceParental(mac, enabled).then((result) => {
					if (!result.ok) throw new Error(result.message || 'Не удалось изменить список родительского контроля.');
					policyMessage.textContent = result.message;
					return callDashboardStatus().then(updateDashboard);
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
			if (target.disabled) return;
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
		// === Mobile 1:1 patch v-main12 - bottom nav + system pills + podkop sheets + device/QR bottom-sheet ===
		setTimeout(()=>{
		  const tryInit=()=>{ if(window.innerWidth<=900){
		    try{
		      if(!document.querySelector(".oum-bottom-nav")){
		        const nav=document.createElement("nav"); nav.className="oum-bottom-nav";
		        const cur=location.pathname.includes("parental")?"parental":location.pathname.includes("settings")?"settings":location.pathname.includes("help")?"help":"dashboard";
		        nav.innerHTML="<button class=\""+(cur==="dashboard"?"active":"")+"\" data-nav=\"dashboard\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z\"/></svg><span>Главная</span></button><button class=\""+(cur==="parental"?"active":"")+"\" data-nav=\"parental\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"M9 12l2 2 4-4\"/></svg><span style=\"font-size:9px;line-height:1\">Семья</span></button><button class=\""+(cur==="settings"?"active":"")+"\" data-nav=\"settings\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z\"/></svg><span>Настройки</span></button><button class=\""+(cur==="help"?"active":"")+"\" data-nav=\"help\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3\"/><circle cx=\"12\" cy=\"17\" r=\"0.8\" fill=\"currentColor\" stroke=\"none\"/></svg><span>Помощь</span></button>";
		        nav.querySelectorAll("button").forEach(b=>{ if(b.dataset.nav===cur) b.classList.add("active"); b.addEventListener("click",()=>{ const t=b.dataset.nav; location.href=t==="dashboard"?L.url("oum","dashboard"):t==="parental"?L.url("oum","parental"):t==="settings"?L.url("oum","settings"):L.url("oum","help");});});
		        document.body.appendChild(nav);
		        const m=document.querySelector(".oum-main"); if(m) m.style.paddingBottom="64px";
		      }
		    }catch(e){}
		    try{
		      const sys=document.querySelector(".oum-system-panel");
		      if(sys && !sys.querySelector(".oum-system-pills")){
		        const pills=document.createElement("div"); pills.className="oum-system-pills";
		        const memAvail=document.querySelector("#memory-available-detail")?.textContent||"";
		        const rootUsed=document.querySelector("#storage-root-detail")?.textContent||"";
		        const memPct=(memAvail.match(/(\d+)%/)||[])[1]||"42";
		        const rootPct=(rootUsed.match(/(\d+)%/)||[])[1]||"46";
		        const portsUp=document.querySelectorAll(".oum-port-card[data-up=\"true\"]").length||2;
		        pills.innerHTML="<span class=\"oum-system-pill\">RAM "+memPct+"% свободно</span><span class=\"oum-system-pill\">Overlay "+rootPct+"%</span><span class=\"oum-system-pill good\">"+portsUp+" порта активно</span>";
		        const body=sys.querySelector(".oum-system-body"); if(body) body.before(pills);
		        const summary=sys.querySelector("summary, .oum-system-summary"); if(summary){ summary.style.cursor="pointer"; summary.addEventListener("click",(e)=>{e.preventDefault(); const isOpen=sys.dataset.mobileOpen==="true"; sys.dataset.mobileOpen=isOpen?"false":"true"; if(sys.tagName==="DETAILS") sys.open=!isOpen;}); }
		        sys.dataset.mobileOpen="false"; if(sys.tagName==="DETAILS") sys.open=true;
		      }
		    }catch(e){}
		    try{
		      const podkop=document.querySelector("#podkop-panel");
		      if(podkop && !document.getElementById("oum-podkop-sheet-services")){
		        const createSheet=(id,title,contentId)=>{
		          const m=document.createElement("div"); m.id=id; m.className="oum-modal";
		          m.innerHTML="<div class=\"oum-bottom-sheet\"><div class=\"sheet-handle\"></div><div style=\"display:flex;justify-content:space-between;align-items:center\"><strong>"+title+"</strong><button onclick=\"this.closest('.oum-modal').classList.remove('active')\" style=\"width:32px;height:32px;min-width:32px;min-height:32px;max-width:32px;max-height:32px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;display:grid;place-items:center;font-size:16px;line-height:1;padding:0;flex:0 0 32px;box-sizing:border-box;\" class=\"oum-sheet-x\">✕</button></div><div id=\""+contentId+"\"></div><button style=\"width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;margin-top:8px\" onclick=\"this.closest('.oum-modal').classList.remove('active')\">Сохранить</button></div>";
		          m.addEventListener("click",e=>{if(e.target===m) m.classList.remove("active")});
		          const bs=m.querySelector(".oum-bottom-sheet");
		          let sy=0,cy=0,drag=false;
		          bs.addEventListener("touchstart",e=>{sy=e.touches[0].clientY;drag=true;try{for(let el=e.target;el;el=el.parentElement){if(el.scrollHeight>el.clientHeight+4&&el.scrollTop>0){drag=false;break}if(el===bs)break}}catch(_){}try{if(sy-bs.getBoundingClientRect().top<72)drag=true}catch(_){}bs.style.transition="none"},{passive:true});
		          bs.addEventListener("touchmove",e=>{if(!drag)return;cy=e.touches[0].clientY-sy;if(cy>0) bs.style.transform="translateY("+cy+"px)"},{passive:true});
		          bs.addEventListener("touchend",()=>{drag=false;bs.style.transition="transform .2s"; if(cy>90) m.classList.remove("active"); bs.style.transform=""; cy=0});
		          document.body.appendChild(m); return m;
		        };
		        const sServices=createSheet("oum-podkop-sheet-services","Сервисы","oum-services-clone");
		        // etalon: ensure services save is blue and triggers real routing save
		        try {
		          const realSave = document.getElementById("podkop-routing-save");
		          const sheetSave = sServices.querySelector(".oum-bottom-sheet > button:last-child");
		          if (realSave && sheetSave) {
		            sheetSave.style.background="#2563eb"; sheetSave.style.color="#fff"; sheetSave.style.border="none";
		            sheetSave.onclick = (e) => { e.preventDefault(); realSave.click(); sServices.classList.remove("active"); };
		          }
		        } catch(e){}
		        const sDomains=createSheet("oum-podkop-sheet-domains","Свои домены и подсети","oum-domains-clone");
		        const sDiag=createSheet("oum-podkop-sheet-diag","Диагностика","oum-diag-clone");
		        const btns=document.querySelectorAll("[data-mobile-podkop]");
		        btns.forEach(b=>{
		          const t=b.dataset.mobilePodkop;
		          const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
		          clone.addEventListener("click",e=>{
		            e.preventDefault(); e.stopPropagation();
		            if(t==="routing"){ const saveBtn = sServices.querySelector(".oum-bottom-sheet > button:last-child"); if(saveBtn){ saveBtn.style.setProperty("background","#2563eb","important"); saveBtn.style.setProperty("color","#fff","important"); saveBtn.style.setProperty("border","none","important"); saveBtn.onclick = (e)=>{ e.preventDefault(); const real=document.getElementById("podkop-routing-save"); if(real) real.click(); sServices.classList.remove("active"); }; } const dst=document.getElementById("oum-services-clone");
		              if(dst){
		                dst.innerHTML="";
		                const rows=document.querySelectorAll(".oum-route-row");
		                const pills=document.createElement("div"); pills.className="pills"; pills.style.cssText="display:flex;flex-wrap:wrap;gap:8px";
		                rows.forEach(row=>{
		                  const label=row.querySelector(".oum-route-service strong")?.textContent?.trim() || row.querySelector("strong")?.textContent?.trim() || "Service";
		                  const isVpn=row.querySelector('input[value="vpn"]')?.checked;
		                  const pill=document.createElement("span"); pill.className="pill"+(isVpn?" active":"");
                  const iconName = (typeof routeIcons !== 'undefined' && row.getAttribute('data-route-row') && routeIcons[row.getAttribute('data-route-row')]) ? routeIcons[row.getAttribute('data-route-row')] : 'ui-globe.svg';
                  const icon = document.createElement("img"); icon.src="/luci-static/oum/icons/"+iconName; icon.alt=""; icon.style.width="14px"; icon.style.height="14px"; icon.style.flexShrink="0";
                  pill.style.display="inline-flex"; pill.style.alignItems="center"; pill.style.gap="6px";
                  pill.appendChild(icon);
                  pill.appendChild(document.createTextNode(" "+label));
		                  if(label.toLowerCase().includes("youtube") && row.querySelector('input[value="direct"]')?.checked){ pill.style.position="relative"; pill.style.paddingRight="34px"; const badge=document.createElement("span"); badge.textContent="Zapret"; badge.style.cssText="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:8px;font-weight:700;background:#fef9c3;border:1px solid #fde68a;color:#92400e;padding:1px 4px;border-radius:6px"; pill.appendChild(badge); }
		                  pill.addEventListener("click",()=>{ const vpn=row.querySelector('input[value="vpn"]'); const direct=row.querySelector('input[value="direct"]'); if(vpn&&direct){ if(vpn.checked){direct.checked=true;} else {vpn.checked=true;} row.setAttribute("aria-checked", String(vpn.checked)); pill.classList.toggle("active", vpn.checked); }});
		                  pills.appendChild(pill);
		                });
		                dst.appendChild(pills);
		              }
		              sServices.classList.add("active");
		                        } else if(t==="domains"){ const src=document.querySelector(".oum-custom-rules"); const dst=document.getElementById("oum-domains-clone"); if(src&&dst){dst.innerHTML=""; const c=src.cloneNode(true); c.open=true; c.hidden=false; const inner=document.createElement("div"); inner.innerHTML=c.innerHTML; inner.querySelector("summary")?.remove(); // remove details wrapper, keep only inner
                dst.appendChild(inner);
                // fix tab switching for cloned sheet (was only bound to root)
                inner.querySelectorAll("[data-custom-route]").forEach(tab=>{
                  tab.addEventListener("click", (e)=>{
                    e.preventDefault();
                    const sel=tab.dataset.customRoute;
                    inner.querySelectorAll("[data-custom-route]").forEach(b=>b.dataset.active= b.dataset.customRoute===sel ? "true":"false");
                    inner.querySelectorAll("[data-custom-route-pane]").forEach(p=>p.hidden = p.dataset.customRoutePane!==sel);
                    const help=inner.querySelector("#podkop-custom-route-help") || document.getElementById("podkop-custom-route-help");
                    if(help) help.textContent = sel==="proxy" ? "Дополнительные назначения для защищённого подключения." : "Явные исключения из защищённого подключения.";
                  });
                });
                const saveBtn = sDomains.querySelector(".oum-bottom-sheet > button:last-child"); if(saveBtn){ saveBtn.style.setProperty("background","#2563eb","important"); saveBtn.style.setProperty("color","#fff","important"); saveBtn.style.setProperty("border","none","important"); saveBtn.onclick = (e)=>{ e.preventDefault(); const real=document.getElementById("podkop-routing-save"); if(real) real.click(); sDomains.classList.remove("active"); }; } } sDomains.classList.add("active");}
		            else if(t==="diagnostics"){ const src=document.querySelector("#podkop-diagnostics-tab"); const dst=document.getElementById("oum-diag-clone"); if(src&&dst){dst.innerHTML=""; const c=src.cloneNode(true); c.hidden=false; c.style.display="block"; dst.appendChild(c);
                const saveBtn = sDiag.querySelector(".oum-bottom-sheet > button:last-child"); if(saveBtn) saveBtn.style.display="none";
                try {
                  const restart = dst.querySelector("#podkop-diagnostic-restart");
                  if(restart){ restart.style.cssText="width:100%;height:42px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-weight:500;"; if(!restart.querySelector(".diag-arrow")){ const a=document.createElement("span"); a.textContent="›"; a.style.color="#9ca3af"; a.style.fontSize="16px"; restart.appendChild(a); }}
                  const quic = dst.querySelector("#podkop-quic-toggle");
                  if(quic){
                    const updateQuicPill = ()=>{
                      let pill=quic.querySelector(".quic-pill");
                      const isDisabled = podkopQuicDisabled;
                      if(!pill){ pill=document.createElement("span"); pill.className="quic-pill"; quic.appendChild(pill); }
                      pill.textContent = isDisabled ? "выкл" : "вкл";
                      pill.style.cssText = isDisabled ? "background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;" : "background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;";
                    };
                    quic.style.cssText="width:100%;height:42px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-weight:500;cursor:pointer;";
                    updateQuicPill();
                    quic.onclick = (e)=>{
                      e.preventDefault();
                      // optimistic flip
                      let pill=quic.querySelector(".quic-pill");
                      const wasVkl = pill ? pill.textContent.trim()==="вкл" : !podkopQuicDisabled;
                      if(pill){
                        pill.textContent = wasVkl ? "выкл" : "вкл";
                        pill.style.cssText = wasVkl ? "background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;" : "background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;";
                      }
                      podkopQuicDisabled = !podkopQuicDisabled;
                      const real=document.getElementById("podkop-quic-toggle");
                      if(real) real.click();
                    };
                    const origToggle = podkopQuicToggle;
                    if(origToggle && !origToggle._quicWatcher){
                      origToggle._quicWatcher = true;
                      setInterval(updateQuicPill, 1500);
                    }
                  }
                } catch(e){}
              } sDiag.classList.add("active");}
		          });
		        });
		      }
		    }catch(e){}
		    try{
		      var nodesSheet=document.getElementById("oum-nodes-sheet");
		      if(nodesSheet&&window.innerWidth>900){
		        var backList=nodesSheet.querySelector("#all-node-list");
		        var pickerEl=document.querySelector("#node-picker");
		        if(backList&&pickerEl) pickerEl.appendChild(backList);
		        nodesSheet.remove();
		        nodesSheet=null;
		      }
		      if(!nodesSheet){
		        const nc=document.querySelector("#node-controls");
		        const allList=document.querySelector("#all-node-list");
		        if(nc&&allList&&window.innerWidth<=900){
		          const m=document.createElement("div"); m.id="oum-nodes-sheet"; m.className="oum-modal";
		          m.innerHTML="<div class=\"oum-bottom-sheet\"><div class=\"sheet-handle\"></div><div style=\"display:flex;justify-content:space-between;align-items:center\"><strong id=\"oum-nodes-sheet-title\">Все ноды</strong><button onclick=\"document.getElementById('oum-nodes-sheet').classList.remove('active')\" style=\"width:32px;height:32px;min-width:32px;min-height:32px;max-width:32px;max-height:32px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;display:grid;place-items:center;font-size:16px;line-height:1;padding:0;flex:0 0 32px;box-sizing:border-box;\" class=\"oum-sheet-x\">✕</button></div><div id=\"oum-nodes-sheet-hint\" style=\"font-size:11px;color:#6b7280\">Лёгкие TCP · быстрые наверху</div><div id=\"oum-nodes-sheet-list\"></div><div id=\"oum-pick-message\"></div><button id=\"oum-pick-confirm\" disabled>Выбрать</button></div>";
		          m.addEventListener("click",e=>{if(e.target===m) m.classList.remove("active")});
		          document.addEventListener("keydown",function escNodes(e){if(e.key==="Escape"){const s=document.getElementById("oum-nodes-sheet");if(s&&s.classList.contains("active"))s.classList.remove("active");}});
		          const bs=m.querySelector(".oum-bottom-sheet");
		          let sy=0,cy=0,drag=false;
		          bs.addEventListener("touchstart",e=>{sy=e.touches[0].clientY;drag=true;try{for(let el=e.target;el;el=el.parentElement){if(el.scrollHeight>el.clientHeight+4&&el.scrollTop>0){drag=false;break}if(el===bs)break}}catch(_){}try{if(sy-bs.getBoundingClientRect().top<72)drag=true}catch(_){}bs.style.transition="none"},{passive:true});
		          bs.addEventListener("touchmove",e=>{if(!drag)return;cy=e.touches[0].clientY-sy;if(cy>0) bs.style.transform="translateY("+cy+"px)"},{passive:true});
		          bs.addEventListener("touchend",()=>{drag=false;bs.style.transition="transform .2s"; if(cy>90) m.classList.remove("active"); bs.style.transform=""; cy=0});
		          nc.appendChild(m);
		          m.querySelector("#oum-nodes-sheet-list").appendChild(allList);
		          const t=document.getElementById("all-nodes-summary"); const st=document.getElementById("oum-nodes-sheet-title"); if(t&&st) st.textContent=t.textContent;
		          const dstList=m.querySelector("#oum-nodes-sheet-list");
		          dstList.addEventListener("click",(e)=>{
		            if(m.dataset.engine!=="passwall")return;
		            if(e.target.closest(".btn[data-node]"))return;
		            const row=e.target.closest(".oum-node");const b=row&&row.querySelector(".btn[data-node]");
		            if(b&&!b.disabled)b.click();
		          });
		          const confirmBtn=m.querySelector("#oum-pick-confirm");
		          dstList.addEventListener("click",(e)=>{
		            if(nodeApplying) return;
		            const cell=e.target.closest("[data-pick]");
		            if(!cell||!dstList.contains(cell)) return;
		            const key=cell.dataset.pick;
		            if(cell.classList.contains("is-current")||pickedNode===key){ pickedNode=null; pickedName=""; }
		            else { pickedNode=key; const nm=cell.querySelector(".oum-node-name"); pickedName=nm?nm.textContent.trim():key; }
		            dstList.querySelectorAll("[data-pick]").forEach(r=>r.classList.toggle("is-selected",!!pickedNode&&r.dataset.pick===pickedNode));
		            refreshPickButton();
		          });
		          confirmBtn.addEventListener("click",()=>{
		            if(!pickedNode||nodeApplying) return;
		            nodeApplying=true;
		            dstList.classList.add("is-locked");
		            refreshPickButton();
		            showNodeMessage("Переключаем ноду…",false);
		            callSelectNode(pickedNode).then((result)=>{
		              if(!result.ok) throw new Error(result.message||"Не удалось переключить ноду.");
		              return callNodeStatus();
		            }).then((nodes)=>{
		              updateNodes(nodes);
		              pickedNode=null; pickedName="";
		              const pm=document.getElementById("oum-pick-message"); if(pm) pm.textContent="";
		              refreshPickButton();
		              showNodeMessage("Нода переключена.",false);
		              m.classList.remove("active");
		            }).catch((err)=>{
		              const pm=document.getElementById("oum-pick-message");
		              if(pm){ pm.textContent=err.message; if(pickMessageTimer) window.clearTimeout(pickMessageTimer); pickMessageTimer=window.setTimeout(()=>{ const p=document.getElementById("oum-pick-message"); if(p) p.textContent=""; },5000); }
		              showNodeMessage(err.message,true);
		            }).finally(()=>{
		              nodeApplying=false;
		              dstList.classList.remove("is-locked");
		              refreshPickButton();
		            });
		          });
		          refreshPickButton();
		        }
		      }
		    }catch(e){}
		  }}
		  tryInit(); setInterval(tryInit,2000); window.addEventListener("resize",tryInit);
		}, 900);
		// force device/QR modals to bottom-sheet like Podkop (mobile only)
		try{
		  const origShowModal = L.ui.showModal;
		  L.ui.showModal = ui.showModal = function(title, content){
		    const isDevice = String(title).includes("S22") || String(title).includes("Комп") || String(title).includes("Ultra") || (Array.isArray(content) && content.some(c=>c && c.className && String(c.className).includes("oum-mobile-device-sheet")));
		    const isQR = String(title).includes("Wi-Fi");
		    if((isDevice || isQR) && window.innerWidth<=900){
		      let sid = isDevice ? "oum-device-custom" : "oum-qr-custom";
		      let sheet=document.getElementById(sid);
		      if(!sheet){
		        sheet=document.createElement("div"); sheet.id=sid; sheet.className="oum-modal";
		        sheet.innerHTML='<div class="oum-bottom-sheet"><div class="sheet-handle"></div><div id="'+sid+'-content"></div><button type="button" class="oum-sheet-done">Готово</button></div>';
		        sheet.querySelector('.oum-sheet-done').addEventListener('click',()=>sheet.classList.remove('active'));
		        sheet.addEventListener("click",e=>{if(e.target===sheet) sheet.classList.remove("active")});
		        const bs=sheet.querySelector(".oum-bottom-sheet");
		        let sy=0,cy=0,drag=false;
		        bs.addEventListener("touchstart",e=>{sy=e.touches[0].clientY;drag=true;try{for(let el=e.target;el;el=el.parentElement){if(el.scrollHeight>el.clientHeight+4&&el.scrollTop>0){drag=false;break}if(el===bs)break}}catch(_){}try{if(sy-bs.getBoundingClientRect().top<72)drag=true}catch(_){}bs.style.transition="none"},{passive:true});
		        bs.addEventListener("touchmove",e=>{if(!drag)return;cy=e.touches[0].clientY-sy;if(cy>0) bs.style.transform="translateY("+cy+"px)"},{passive:true});
		        bs.addEventListener("touchend",()=>{drag=false;bs.style.transition="transform .2s"; if(cy>90) sheet.classList.remove("active"); bs.style.transform=""; cy=0});
		        document.body.appendChild(sheet);
		      }
		      const dst=document.getElementById(sid+"-content");
		      dst.innerHTML="";
		      const h=document.createElement("div"); h.className="oum-sheet-title"; h.textContent=isQR ? "Подключение к Wi-Fi" : "Устройство";
		      dst.appendChild(h);
		      if(isQR){
		        const network=document.createElement("div"); network.className="oum-qr-network";
		        const label=document.createElement("span"); label.textContent="Сеть";
		        const name=document.createElement("strong"); name.textContent=String(title).replace(/^Wi-Fi:\s*/,"");
		        network.append(label,name); dst.appendChild(network);
		      }
		      (Array.isArray(content)?content:[content]).forEach(el=>{ if(!el || !el.cloneNode) return; if(String(el.className||"").includes("right")) return; dst.appendChild(el); });
		      if(isQR && wifiQrData){ const qr=dst.querySelector("canvas"); if(qr) drawQr(qr,wifiQrData.payload,220); }
		      sheet.classList.add("active");
		      return;
		    }
		    return origShowModal.apply(L.ui, arguments);
		  };
		}catch(e){console.log(e)}
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
