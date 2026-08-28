'use strict';
'require view';
'require rpc';
'require ui';

const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });

return view.extend({
	load() { return callDashboardStatus(); },
	render(status) {
		const checks = [
			[ '1', 'Проверьте интернет', status.wan?.up ? `Подключение есть${status.wan.ipv4 ? ` · ${status.wan.ipv4}` : ''}.` : 'Подключения нет. Проверьте WAN-кабель или данные PPPoE в Настройках.', status.wan?.up ],
			[ '2', 'Проверьте DNS', 'Если открываются IP-адреса, но не сайты, смените основной и Bootstrap DNS активного VPN-движка в Настройках.', null ],
			[ '3', 'Проверьте VPN', status.vpn_enabled ? (status.vpn_ready ? 'VPN работает. При проблеме попробуйте другую ноду или временно отключите VPN.' : 'VPN включён, но требует внимания. Откройте диагностику движка на Главной.') : 'VPN выключен. Проверьте доступ напрямую, затем включите его снова.', status.vpn_ready ],
			[ '4', 'Не помогло?', 'Сохраните резервную копию OUM, перезагрузите роутер и повторите проверку. Сброс VPN не меняет WAN и Wi-Fi.', null ]
		];
		return E('div', { 'class': 'oum-help-page' }, [
			E('style', {}, `.oum-help-page{max-width:900px;margin:0 auto}.oum-help-page>p{opacity:.72}.oum-help-grid{display:grid;gap:12px;margin:18px 0}.oum-help-step{display:grid;grid-template-columns:42px 1fr;gap:12px;border:1px solid #ccd3dc;border-radius:8px;padding:15px}.oum-help-number{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:rgba(38,115,236,.14);font-weight:700}.oum-help-step h3{margin:0 0 5px}.oum-help-step p{margin:0;line-height:1.5;opacity:.78}.oum-help-result{font-weight:600}.oum-help-result[data-ok="true"]{color:#2b9b68}.oum-help-result[data-ok="false"]{color:#c94b4b}.oum-help-extra{border:1px solid #ccd3dc;border-radius:8px;padding:15px;margin-top:14px}.oum-help-extra summary{cursor:pointer;font-weight:600}.oum-help-code{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}.oum-help-code code{padding:8px 10px;background:rgba(127,127,127,.12);border-radius:6px;overflow-wrap:anywhere}`),
			E('h2', {}, 'Если интернет не работает'),
			E('p', {}, 'Идите сверху вниз: сначала обычное подключение, затем DNS и только после этого VPN.'),
			E('div', { 'class': 'oum-help-grid' }, checks.map(([ number, title, text, ok ]) => E('section', { 'class': 'oum-help-step' }, [ E('span', { 'class': 'oum-help-number' }, number), E('div', {}, [ E('h3', {}, title), E('p', { 'class': ok == null ? '' : 'oum-help-result', 'data-ok': ok == null ? null : String(ok) }, text) ]) ]))),
			E('div', { 'class': 'oum-setting-actions' }, [ E('a', { 'class': 'btn cbi-button-action', href: L.url('oum', 'dashboard') }, 'Открыть главную'), ' ', E('a', { 'class': 'btn', href: L.url('oum', 'settings') }, 'Открыть настройки') ]),
			E('details', { 'class': 'oum-help-extra' }, [
				E('summary', {}, 'Дополнительно: YouTube на Windows'),
				E('p', {}, 'Если YouTube через Zapret всё равно подвисает, можно попробовать включить TCP timestamps. Это необязательная настройка ПК, а не требование OUM.'),
				E('div', { 'class': 'oum-help-code' }, [ E('code', {}, 'netsh int tcp set global timestamps=enabled'), E('button', { 'class': 'btn', click: () => navigator.clipboard.writeText('netsh int tcp set global timestamps=enabled').then(() => ui.addNotification(null, E('p', {}, 'Команда скопирована.'), 'info')) }, 'Копировать') ])
			]),
			E('p', { 'class': 'oum-help-extra' }, [ E('strong', {}, 'Безопасность: '), 'вход admin без пароля используйте только в доверенной локальной сети. Не публикуйте LuCI или OUM в интернет.' ])
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
