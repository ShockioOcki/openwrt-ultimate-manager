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
const callRefreshSubscriptionInfo = rpc.declare({ object: 'oum', method: 'refreshSubscriptionInfo', expect: { '': {} } });
const callSpeedTestStatus = rpc.declare({ object: 'oum', method: 'speedTestStatus', expect: { '': {} } });
const callStartSpeedTest = rpc.declare({ object: 'oum', method: 'startSpeedTest', params: [ 'mode' ], expect: { '': {} } });
const sourceNames = { none: 'Не настроено', subscription: 'Subscription', awg: 'AWG Tunnel', proxy: 'Proxy', passwall: 'PassWall' };

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

return view.extend({
	load() { return Promise.all([ callStatus(), callDashboardStatus(), callNodeStatus(), callSpeedTestStatus() ]); },

	render(data) {
		const status = data[0];
		const dashboard = data[1];
		const initialNodes = data[2];
		const initialSpeed = data[3];
		if (!status.setup_complete)
			return E('div', {}, [
				E('h2', {}, 'OUM'),
				E('p', {}, 'Сначала завершите базовую настройку роутера.'),
				E('a', { class: 'btn cbi-button-action', href: L.url('oum', 'setup') }, 'Открыть мастер')
			]);

		const dashboardHost = window.location.hostname.includes(':') ? `[${window.location.hostname}]` : window.location.hostname;
		const zashboardUrl = `http://${dashboardHost}:9090/ui/zashboard/`;

		const root = E('div', { 'class': 'oum-dashboard' }, [
			E('style', {}, `
				.oum-dashboard{max-width:1050px;margin:0 auto}.oum-page-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-page-head h2{margin:0}.oum-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}
				.oum-card,.oum-panel{border:1px solid #ccd3dc;border-radius:12px;padding:16px}.oum-card small{display:block;opacity:.7;margin-bottom:8px}.oum-card strong{font-size:1.1rem}.oum-vpn-card-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.oum-vpn-card-row button{padding:4px 9px}.oum-card-message{font-size:.82em;margin-top:7px;min-height:1.2em}
				.oum-clients{width:100%;border-collapse:collapse}.oum-clients th,.oum-clients td{text-align:left;padding:9px 7px;border-bottom:1px solid #e1e5ea}.oum-clients th{opacity:.7;font-size:.9em}.oum-policy{min-width:180px}.oum-policy-message{min-height:1.4em;margin-top:10px}.oum-policy-message[data-state="failed"]{color:#c0392b}
				.oum-muted{opacity:.68}.oum-panels{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px}
				.oum-node-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-current-node{padding:13px;border-radius:9px;background:#eef4fa;margin:10px 0 8px}.oum-node-list{display:grid;gap:8px}.oum-node-quick,.oum-node-all-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
				.oum-node-actions,.oum-subscription-head{display:flex;align-items:center;gap:8px}.oum-subscription{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #d8dde5}.oum-subscription-head{justify-content:space-between}.oum-subscription-head h3{margin:0}.oum-subscription-progress{height:9px;border-radius:999px;background:#dce3ea;overflow:hidden;margin:13px 0 8px}.oum-subscription-progress>span{display:block;height:100%;background:#32b67a;transition:width .3s}.oum-subscription-data{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}.oum-subscription-status{margin-top:7px;font-size:.85em}
				.oum-speed-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oum-speed-card{border:1px solid #d8dde5;border-radius:10px;padding:14px}.oum-speed-card h4{margin:0 0 12px}.oum-speed-values{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.oum-speed-values small{display:block;opacity:.68;margin-bottom:4px}.oum-speed-values strong{font-size:1.05rem}.oum-speed-card button{width:100%}.oum-speed-status{min-height:1.4em;margin-top:10px}.oum-speed-status[data-state="failed"]{color:#c0392b}
				.oum-node{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #d8dde5;border-radius:9px}.oum-node>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.oum-delay{min-width:70px;text-align:right}
				.oum-node-title{font-weight:600;margin:14px 0 9px}.oum-node-hint{font-size:.86em;margin:2px 0 8px}.oum-node-message{min-height:1.4em;margin:6px 0}.oum-node-message[data-state="failed"]{color:#c0392b}
				.oum-node-all{margin-top:13px}.oum-node-all>summary{cursor:pointer;font-weight:600;padding:4px 0}.oum-node-all[open]>summary{margin-bottom:10px}
				.oum-passwall-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.oum-passwall-state{border:1px solid #d8dde5;border-radius:9px;padding:11px}.oum-passwall-state small{display:block;opacity:.68;margin-bottom:5px}.oum-passwall-state strong[data-ok="false"],.oum-passwall-diagnostic strong[data-ok="false"]{color:#c0392b}.oum-passwall-route{background:#eef4fa;border-radius:9px;padding:12px;margin-top:12px}.oum-passwall-route small{display:block;margin-bottom:4px}.oum-passwall-versions{margin-top:12px}.oum-passwall-rules{margin-top:8px}.oum-passwall-diagnostics{margin-top:12px}.oum-passwall-diagnostics>summary{cursor:pointer;font-weight:600}.oum-passwall-diagnostic-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.oum-passwall-diagnostic{border:1px solid #d8dde5;border-radius:9px;padding:10px}.oum-passwall-diagnostic small{display:block;opacity:.68;margin-bottom:4px}.oum-node-controls[data-engine="passwall"]{border-top:1px solid #d8dde5;margin-top:16px;padding-top:14px}
				@media(max-width:900px){.oum-cards,.oum-passwall-grid{grid-template-columns:1fr 1fr}.oum-node-quick,.oum-node-all-grid,.oum-passwall-diagnostic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.oum-cards,.oum-speed-grid,.oum-node-quick,.oum-node-all-grid,.oum-passwall-grid,.oum-passwall-route,.oum-passwall-diagnostic-grid{grid-template-columns:1fr}.oum-clients .optional{display:none}}
			`),
			E('div', { 'class': 'oum-page-head' }, [
				E('h2', {}, 'OUM'),
				E('a', { 'class': 'btn cbi-button', href: L.url('oum', 'logout') }, 'Выйти')
			]),
			E('div', { 'class': 'oum-cards' }, [
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Интернет'), E('strong', { id: 'wan-state' }, ''), E('div', { id: 'wan-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Клиенты'), E('strong', { id: 'client-count' }, '0'), E('div', { id: 'wifi-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Температура'), E('strong', { id: 'thermal-state' }, '—'), E('div', { 'class': 'oum-muted' }, 'Максимум по датчикам') ]),
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
				E('section', { 'class': 'oum-panel' }, [
					E('h3', {}, 'Подключённые устройства'),
					E('table', { 'class': 'oum-clients' }, [
						E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'IP-адрес'), E('th', {}, 'Подключение'), E('th', { 'class': 'optional' }, 'MAC'), E('th', {}, 'Маршрутизация') ])),
						E('tbody', { id: 'client-list' })
					]),
					E('div', { 'class': 'oum-policy-message oum-muted', id: 'policy-message' }, 'Режим применяется к выбранному устройству и сохраняется после перезагрузки.')
				]),
				E('section', { 'class': 'oum-panel' }, [
					E('h3', {}, 'Скорость соединения'),
					E('p', { 'class': 'oum-muted' }, 'Сравнение через одну тестовую точку Cloudflare. Один запуск использует около 35 МБ. Задержка — полный HTTPS-отклик, а не ping ноды.'),
					E('div', { 'class': 'oum-speed-grid' }, [
						E('div', { 'class': 'oum-speed-card', 'data-speed-card': 'direct' }, [
							E('h4', {}, 'Напрямую'),
							E('div', { 'class': 'oum-speed-values' }, [
								E('div', {}, [ E('small', {}, 'Получение'), E('strong', { 'data-speed-value': 'download' }, '—') ]),
								E('div', {}, [ E('small', {}, 'Отдача'), E('strong', { 'data-speed-value': 'upload' }, '—') ]),
								E('div', {}, [ E('small', {}, 'Задержка'), E('strong', { 'data-speed-value': 'latency' }, '—') ])
							]),
							E('button', { 'class': 'btn cbi-button', 'data-speed-mode': 'direct' }, 'Проверить напрямую')
						]),
						E('div', { 'class': 'oum-speed-card', 'data-speed-card': 'vpn' }, [
							E('h4', {}, 'Через VPN'),
							E('div', { 'class': 'oum-speed-values' }, [
								E('div', {}, [ E('small', {}, 'Получение'), E('strong', { 'data-speed-value': 'download' }, '—') ]),
								E('div', {}, [ E('small', {}, 'Отдача'), E('strong', { 'data-speed-value': 'upload' }, '—') ]),
								E('div', {}, [ E('small', {}, 'Задержка'), E('strong', { 'data-speed-value': 'latency' }, '—') ])
							]),
							E('button', { 'class': 'btn cbi-button', 'data-speed-mode': 'vpn' }, 'Проверить через VPN')
						])
					]),
					E('div', { 'class': 'oum-speed-status oum-muted', id: 'speed-status' }, '')
				]),
				E('section', { 'class': 'oum-panel', id: 'node-panel', hidden: '' }, [
					E('div', { 'class': 'oum-subscription', id: 'subscription-panel', hidden: '' }, [
						E('div', { 'class': 'oum-subscription-head' }, [
							E('h3', {}, 'Подписка'),
							E('button', { 'class': 'btn cbi-button', id: 'refresh-subscription' }, 'Обновить')
						]),
						E('div', { 'class': 'oum-subscription-progress', id: 'subscription-progress' }, E('span', {})),
						E('div', { 'class': 'oum-subscription-data' }, [
							E('strong', { id: 'subscription-traffic' }, '—'),
							E('strong', { id: 'subscription-expire' }, '—')
						]),
						E('div', { 'class': 'oum-subscription-status oum-muted', id: 'subscription-status' }, '')
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
					E('div', { 'class': 'oum-node-controls', id: 'node-controls' }, [
						E('div', { 'class': 'oum-node-head' }, [
							E('h3', { id: 'node-panel-title' }, 'VPN-нода'),
							E('div', { 'class': 'oum-node-actions' }, [
								E('a', { 'class': 'btn cbi-button', id: 'zashboard-link', href: zashboardUrl, target: '_blank', rel: 'noreferrer' }, 'Zashboard'),
								E('button', { 'class': 'btn cbi-button', id: 'measure-nodes' }, 'Измерить TCP')
							])
						]),
						E('div', { 'class': 'oum-current-node', id: 'current-node' }, 'Нет активной ноды'),
						E('div', { 'class': 'oum-node-hint oum-muted' }, 'Задержка нод — лёгкое TCP-соединение до их серверов; это не полный HTTPS-отклик.'),
						E('div', { 'class': 'oum-node-message oum-muted', id: 'node-message' }),
						E('div', { 'class': 'oum-node-title' }, 'Быстрый доступ'),
						E('div', { 'class': 'oum-node-list oum-node-quick', id: 'node-list' }),
						E('details', { 'class': 'oum-node-all' }, [
							E('summary', { id: 'all-nodes-summary' }, 'Все ноды'),
							E('div', { 'class': 'oum-node-list oum-node-all-grid', id: 'all-node-list' })
						])
					])
				])
			])
		]);

		const nodePanel = root.querySelector('#node-panel');
		const nodeControls = root.querySelector('#node-controls');
		const nodeList = root.querySelector('#node-list');
		const allNodeList = root.querySelector('#all-node-list');
		const nodeMessage = root.querySelector('#node-message');
		const measureButton = root.querySelector('#measure-nodes');
		const nodePanelTitle = root.querySelector('#node-panel-title');
		const zashboardLink = root.querySelector('#zashboard-link');
		const subscriptionPanel = root.querySelector('#subscription-panel');
		const subscriptionRefresh = root.querySelector('#refresh-subscription');
		const subscriptionStatus = root.querySelector('#subscription-status');
		const vpnToggle = root.querySelector('#vpn-toggle');
		const vpnControlMessage = root.querySelector('#vpn-control-message');
		const policyMessage = root.querySelector('#policy-message');
		const speedStatus = root.querySelector('#speed-status');
		const speedButtons = Array.from(root.querySelectorAll('[data-speed-mode]'));
		let vpnEnabled = dashboard.vpn_enabled === true;
		let vpnEngine = dashboard.vpn_engine || 'openclash';
		let vpnWatchTimer = null;
		let speedWatchTimer = null;
		let passwallInstalled = dashboard.passwall?.installed === true;
		let nodesAvailable = initialNodes.available === true;
		const updateVpnPanelVisibility = () => { nodePanel.hidden = !(passwallInstalled || nodesAvailable); };

		const updateSpeed = (fresh) => {
			for (const mode of [ 'direct', 'vpn' ]) {
				const card = root.querySelector(`[data-speed-card="${mode}"]`);
				const result = fresh[mode];
				card.querySelector('[data-speed-value="download"]').textContent = result ? `${result.download_mbps.toFixed(1)} Мбит/с` : '—';
				card.querySelector('[data-speed-value="upload"]').textContent = result ? `${result.upload_mbps.toFixed(1)} Мбит/с` : '—';
				card.querySelector('[data-speed-value="latency"]').textContent = result ? `${Math.round(result.latency_ms)} мс` : '—';
			}
			const running = fresh.state === 'running';
			for (const button of speedButtons) {
				button.disabled = running;
				button.textContent = running && button.dataset.speedMode === fresh.mode ? 'Измеряем…' :
					(button.dataset.speedMode === 'direct' ? 'Проверить напрямую' : 'Проверить через VPN');
			}
			const routeFailed = fresh.paths_separated === false;
			speedStatus.dataset.state = fresh.state === 'failed' || routeFailed ? 'failed' : 'idle';
			speedStatus.textContent = routeFailed ? 'Маршруты совпали: результаты нельзя считать сравнением DIRECT и VPN.' :
				(fresh.paths_separated === true ? 'Маршруты DIRECT и VPN подтверждены и различаются.' :
					(fresh.message || (fresh.state === 'idle' ? 'Запускайте тесты по очереди для честного сравнения.' : '')));
		};

		const updateSubscription = (fresh) => {
			const info = fresh.subscription || {};
			subscriptionPanel.hidden = fresh.vpn_engine === 'passwall' || fresh.active_source !== 'subscription';
			if (subscriptionPanel.hidden) return;
			subscriptionRefresh.disabled = info.refreshing === true;
			if (!info.available) {
				root.querySelector('#subscription-progress').hidden = true;
				root.querySelector('#subscription-traffic').textContent = 'Данные о трафике недоступны';
				root.querySelector('#subscription-expire').textContent = '';
				subscriptionStatus.textContent = info.refreshing ? 'Получаем данные у провайдера…' : 'Провайдер не передал сведения о подписке.';
				return;
			}

			const used = Number(info.upload || 0) + Number(info.download || 0);
			const total = Number(info.total || 0);
			const percent = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0;
			const progress = root.querySelector('#subscription-progress');
			progress.hidden = total <= 0;
			progress.firstElementChild.style.width = `${percent}%`;
			root.querySelector('#subscription-traffic').textContent = total > 0 ?
				`${formatBytes(used)} из ${formatBytes(total)}` : `${formatBytes(used)} использовано`;

			const expires = Number(info.expire || 0);
			if (expires > 0) {
				const days = Math.max(0, Math.ceil((expires - Date.now() / 1000) / 86400));
				const date = new Date(expires * 1000).toLocaleDateString('ru-RU');
				root.querySelector('#subscription-expire').textContent = `Осталось ${days} дн. · до ${date}`;
			} else {
				root.querySelector('#subscription-expire').textContent = 'Без ограничения срока';
			}
			subscriptionStatus.textContent = info.refreshing ? 'Обновляем данные…' : 'Данные подписки обновляются автоматически каждые 30 минут.';
		};

		const updateDashboard = (fresh) => {
			vpnEngine = fresh.vpn_engine || 'openclash';
			root.querySelector('#wan-state').textContent = fresh.wan?.up ? 'Подключён' : 'Нет соединения';
			root.querySelector('#wan-detail').textContent = fresh.wan?.ipv4 ? `${fresh.wan.ipv4} · ${String(fresh.wan.proto || '').toUpperCase()}` : String(fresh.wan?.proto || '').toUpperCase();
			root.querySelector('#client-count').textContent = String(fresh.clients?.length || 0);
			const ssids = Array.from(new Set((fresh.wifi || []).map((item) => item.ssid)));
			root.querySelector('#wifi-detail').textContent = ssids.length ? ssids.join(' · ') : 'Wi-Fi выключен';
			root.querySelector('#thermal-state').textContent = fresh.thermal?.maximum != null ? `${Math.round(fresh.thermal.maximum)} °C` : 'Нет данных';
			root.querySelector('#active-source').textContent = sourceNames[vpnEngine === 'passwall' ? 'passwall' : fresh.active_source] || fresh.active_source;
			vpnEnabled = fresh.vpn_enabled === true;
			vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
			vpnToggle.disabled = (vpnEngine !== 'passwall' && fresh.active_source === 'none') || (vpnEnabled && fresh.vpn_ready !== true);
			vpnControlMessage.textContent = !vpnEnabled ? 'VPN выключен' :
				(fresh.vpn_ready === true ? 'VPN работает' : 'VPN запускается…');
			updateSubscription(fresh);
			const body = root.querySelector('#client-list');
			body.replaceChildren(...(fresh.clients || []).map((client) => E('tr', {}, [
				E('td', {}, client.name), E('td', {}, client.ip),
				E('td', {}, client.medium === 'wifi' ? 'Wi-Fi' : 'Кабель'),
				E('td', { 'class': 'optional' }, client.mac),
				E('td', {}, policySelect(client))
			])));
			if (!fresh.clients?.length)
				body.appendChild(E('tr', {}, E('td', { colspan: 5, 'class': 'oum-muted' }, 'Нет активных DHCP-клиентов')));
			for (const select of body.querySelectorAll('.oum-policy'))
				select.disabled = false;
			policyMessage.textContent = vpnEngine === 'passwall' ?
				'PassWall закрепляет адрес устройства и добавляет его в соответствующее shunt-правило.' :
				'Режим применяется к выбранному устройству и сохраняется после перезагрузки.';
			updatePasswall(fresh.passwall || {});
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
			setDiagnostic('remote', diagnostics.remote_dns_mode ? diagnostics.remote_dns_mode.toUpperCase() : 'Не задан', diagnostics.remote_dns_mode && diagnostics.remote_dns_mode !== 'Не задан');
			setDiagnostic('ipv6', diagnostics.ipv6_tproxy === true ? 'TProxy включён' : 'Требует внимания', diagnostics.ipv6_tproxy === true);
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
			nodePanelTitle.textContent = isPasswall ? 'Выбор ноды' : 'VPN-нода';
			zashboardLink.hidden = isPasswall;
			zashboardLink.style.display = isPasswall ? 'none' : '';
			measureButton.disabled = fresh.applying === true;
			const delayText = (node, emptyText) => node.delay > 0 ? `${node.delay} ms` :
				(node.tested || fresh.measured_at ? 'offline' : emptyText);
			const makeNode = (node, isCurrent) => E('div', { 'class': 'oum-node' }, [
				E('span', {}, node.name),
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
			nodeList.replaceChildren(...preferredNodes(fresh).map((node) => makeNode(node, false)));
			if (!nodeList.children.length)
				nodeList.appendChild(E('div', { 'class': 'oum-muted' }, 'Других нод в профиле нет.'));
			const all = sortedNodes(fresh.nodes);
			root.querySelector('#all-nodes-summary').textContent = `Все ноды (${all.length})`;
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

		root.querySelector('.oum-speed-grid').addEventListener('click', (ev) => {
			const target = ev.target.closest('[data-speed-mode]');
			if (!target) return;
			target.disabled = true;
			speedStatus.dataset.state = 'idle';
			speedStatus.textContent = 'Запускаем тест скорости…';
			callStartSpeedTest(target.dataset.speedMode).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось запустить тест скорости.');
				const watch = () => callSpeedTestStatus().then((fresh) => {
					updateSpeed(fresh);
					if (fresh.state === 'running')
						speedWatchTimer = window.setTimeout(watch, 1000);
				});
				if (speedWatchTimer) window.clearTimeout(speedWatchTimer);
				return watch();
			}).catch((err) => {
				speedStatus.dataset.state = 'failed';
				speedStatus.textContent = err.message;
				for (const button of speedButtons) button.disabled = false;
			});
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
		updateSpeed(initialSpeed);
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
