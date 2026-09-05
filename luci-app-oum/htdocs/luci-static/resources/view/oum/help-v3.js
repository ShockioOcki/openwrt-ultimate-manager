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
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260905-quickping84` }),
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
		setTimeout(()=>{
		  const tryInit=()=>{ if(window.innerWidth<=900){
		    if(!document.querySelector(".oum-bottom-nav")){
		      const nav=document.createElement("nav"); nav.className="oum-bottom-nav";
		      const cur=location.pathname.includes("parental")?"parental":location.pathname.includes("settings")?"settings":location.pathname.includes("help")?"help":"dashboard";
		      nav.innerHTML='<button class="'+(cur==="dashboard"?"active":"")+'" data-nav="dashboard"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Главная</span></button><button class="'+(cur==="parental"?"active":"")+'" data-nav="parental"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg><span style="font-size:9px;line-height:1">Семья</span></button><button class="'+(cur==="settings"?"active":"")+'" data-nav="settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Настройки</span></button><button class="'+(cur==="help"?"active":"")+'" data-nav="help"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/></svg><span>Помощь</span></button>';
		      nav.querySelectorAll("button").forEach(b=>{ if(b.dataset.nav===cur) b.classList.add("active"); b.addEventListener("click",()=>{ const t=b.dataset.nav; location.href=t==="dashboard"?L.url("oum","dashboard"):t==="parental"?L.url("oum","parental"):t==="settings"?L.url("oum","settings"):L.url("oum","help");});});
		      document.body.appendChild(nav);
		      const m=document.querySelector(".oum-main"); if(m) m.style.paddingBottom="64px";
		    }
		  }}
		  tryInit(); setInterval(tryInit,2000); window.addEventListener("resize",tryInit);
		}, 900);
		return E('div', { 'class': 'oum-help-page oum-app', 'data-theme': document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, [ page ]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
