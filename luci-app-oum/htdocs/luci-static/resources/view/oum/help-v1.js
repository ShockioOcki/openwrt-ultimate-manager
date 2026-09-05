'use strict';
'require view';
'require rpc';
'require ui';

const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });

function appSidebar(active) {
	const item = (key, label, path) => E('a', { 'class': `oum-nav-item${active === key ? ' is-active' : ''}`, href: L.url('oum', path) }, label);
	return E('aside', { 'class': 'oum-sidebar', 'aria-label': 'Навигация OUM' }, [ E('div', { 'class': 'oum-brand' }, [ E('span', { 'class': 'oum-brand-mark' }, 'O'), E('span', {}, [ E('strong', {}, 'OUM'), E('small', {}, 'Домашний щит') ]) ]), E('div', { 'class': 'oum-nav-caption' }, 'Меню'), E('nav', { 'class': 'oum-nav' }, [ item('dashboard', 'Панель', 'dashboard'), item('parental', 'Родительский контроль', 'parental'), item('settings', 'Настройки', 'settings'), item('help', 'Помощь', 'help') ]) ]);
}

return view.extend({
	load() { return callDashboardStatus(); },
	render(status) {
		const checks = [
			[ '1', 'Проверьте интернет', status.wan?.up ? `Подключение есть${status.wan.ipv4 ? ` · ${status.wan.ipv4}` : ''}.` : 'Подключения нет. Проверьте WAN-кабель или данные PPPoE в Настройках.', status.wan?.up ],
			[ '2', 'Проверьте DNS', 'Если открываются IP-адреса, но не сайты, смените основной и Bootstrap DNS активного VPN-движка в Настройках.', null ],
			[ '3', 'Проверьте VPN', status.vpn_enabled ? (status.vpn_ready ? 'VPN работает. При проблеме попробуйте другую ноду или временно отключите VPN.' : 'VPN включён, но требует внимания. Откройте диагностику движка на Главной.') : 'VPN выключен. Проверьте доступ напрямую, затем включите его снова.', status.vpn_ready ],
			[ '4', 'Не помогло?', 'Сохраните резервную копию OUM, перезагрузите роутер и повторите проверку. Сброс VPN не меняет WAN и Wi-Fi.', null ]
		];
		const page = E('main', { 'class': 'oum-main' }, [
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260902-mobile9` }),
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
		return E('div', { 'class': 'oum-help-page oum-app', 'data-theme': document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, [ page ]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
