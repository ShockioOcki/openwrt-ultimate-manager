'use strict';
'require view';
'require rpc';
'require ui';

const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });
const callSupportStatus = rpc.declare({ object: 'oum', method: 'supportStatus', expect: { '': {} } });
const callStartSupport = rpc.declare({ object: 'oum', method: 'startSupportSession', params: [ 'mode', 'duration', 'consent' ], expect: { '': {} } });
const callStopSupport = rpc.declare({ object: 'oum', method: 'stopSupportSession', expect: { '': {} } });
const callRestoreSupportBackup = rpc.declare({ object: 'oum', method: 'restoreSupportBackup', expect: { '': {} } });

function supportModeLabel(mode) {
	return mode === 'repair' ? 'Диагностика и исправление' : 'Только диагностика';
}

function supportRecovery(support) {
	const items = [];
	if (support.backup_available) {
		items.push(E('button', { 'class': 'btn', click: () => ui.showModal('Восстановить настройки?', [
			E('p', {}, 'Будет восстановлена страховочная копия, созданная перед последним сеансом исправления. Роутер перезагрузится.'),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', click: ui.hideModal }, 'Отмена'),
				E('button', { 'class': 'btn cbi-button-negative', click: async ev => {
					ev.currentTarget.disabled = true;
					const result = await callRestoreSupportBackup();
					if (!result.ok) { ev.currentTarget.disabled = false; ui.addNotification(null, E('p', {}, result.message || 'Не удалось восстановить настройки.'), 'error'); return; }
					ui.showModal('Восстановление запущено', [ E('p', {}, result.message) ]);
				} }, 'Восстановить и перезагрузить')
			])
		]) }, 'Откатить изменения поддержки'));
	}
	if (support.audit) {
		items.push(E('details', { 'class': 'oum-support-audit' }, [
			E('summary', {}, 'Журнал удалённой поддержки'),
			E('pre', {}, support.audit.trim().split('\n').slice(-10).join('\n'))
		]));
	}
	return items.length ? E('div', { 'class': 'oum-support-recovery' }, items) : null;
}

function supportPanel(support) {
	const active = support.state === 'active';
	if (active) {
		const expires = support.expires_at ? new Date(support.expires_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
		const accessBlock = (title, description, command, copiedMessage, footer) => E('section', { 'class': 'oum-support-access-item' }, [
			E('div', { 'class': 'oum-support-access-head' }, [ E('strong', {}, title), E('p', {}, description) ]),
			E('div', { 'class': 'oum-support-command-row' }, [
				E('code', { 'class': 'oum-support-command' }, command || 'Команда недоступна'),
				E('button', { 'class': 'btn', disabled: command ? null : '', click: () => navigator.clipboard.writeText(command).then(() => ui.addNotification(null, E('p', {}, copiedMessage), 'info')) }, 'Скопировать')
			]),
			footer || ''
		]);
		const sshAccess = accessBlock('SSH-консоль', support.mode === 'repair' ? 'Полный временный доступ к командной строке роутера.' : 'Безопасный доступ только к разрешённой диагностике.', support.connect_command, 'Команда SSH скопирована.');
		const webAccess = support.mode === 'repair' && support.web_command ? accessBlock('Веб-интерфейс', 'Запустите SSH-туннель на компьютере специалиста.', support.web_command, 'Команда веб-доступа скопирована.', E('p', { 'class': 'oum-support-access-foot' }, [ E('span', {}, 'Затем откройте: '), E('code', {}, support.web_url) ])) : null;
		return E('section', { 'class': 'oum-support-panel is-active' }, [
			E('div', { 'class': 'oum-support-head' }, [ E('div', {}, [ E('h2', {}, 'Удалённая поддержка'), E('p', {}, support.message || 'Сеанс активен.') ]), E('span', { 'class': 'oum-support-state' }, 'Доступ открыт') ]),
			E('div', { 'class': 'oum-support-session-meta' }, [
				E('div', {}, [ E('small', {}, 'Режим'), E('strong', {}, supportModeLabel(support.mode)) ]),
				E('div', {}, [ E('small', {}, 'Доступ закроется'), E('strong', {}, expires) ])
			]),
			E('div', { 'class': 'oum-support-access' }, [ sshAccess, webAccess ].filter(Boolean)),
			E('p', { 'class': 'oum-support-privacy' }, support.mode === 'repair' ? 'Команды работают только до указанного времени. LuCI доступен исключительно внутри SSH-туннеля.' : 'Пароль роутера не передаётся. Диагностический доступ не позволяет менять настройки.'),
			E('div', { 'class': 'oum-support-active-actions' }, [
				E('button', { 'class': 'btn cbi-button-negative', click: async ev => {
					ev.currentTarget.disabled = true;
					const result = await callStopSupport();
					if (!result.ok) { ev.currentTarget.disabled = false; ui.addNotification(null, E('p', {}, result.message || 'Не удалось завершить сеанс.'), 'error'); return; }
					location.reload();
				} }, 'Завершить удалённый доступ')
			]),
			supportRecovery(support)
		]);
	}

	const duration = E('select', { 'class': 'cbi-input-select' }, [ E('option', { value: '15' }, '15 минут'), E('option', { value: '30', selected: '' }, '30 минут'), E('option', { value: '60' }, '60 минут') ]);
	const consent = E('input', { type: 'checkbox' });
	const modeDiagnostic = E('input', { type: 'radio', name: 'support_mode', value: 'diagnostic', checked: '' });
	const modeRepair = E('input', { type: 'radio', name: 'support_mode', value: 'repair' });
	const notices = [
		(support.state === 'expired' || support.state === 'disconnected' || support.state === 'failed') ? E('div', { 'class': 'oum-support-notice', 'data-state': support.state }, support.message) : null,
		!support.client_ready ? E('div', { 'class': 'oum-support-notice' }, [ E('strong', {}, 'OpenSSH-клиент не установлен.'), E('span', {}, ' Установите полный комплект OUM с зависимостью openssh-client.') ]) : null
	].filter(Boolean);
	return E('section', { 'class': 'oum-support-panel' }, [
		E('div', { 'class': 'oum-support-head' }, [ E('div', {}, [ E('h2', {}, 'Удалённая поддержка'), E('p', {}, 'OUM сам создаст временный Pinggy-туннель и покажет готовую команду для специалиста.') ]), E('span', { 'class': 'oum-support-state is-off' }, 'Выключена') ]),
		...notices,
		E('div', { 'class': 'oum-support-modes' }, [
			E('label', { 'class': 'oum-support-mode' }, [ modeDiagnostic, E('span', {}, [ E('strong', {}, 'Только диагностика'), E('small', {}, 'Специалист видит состояние, службы и очищенный журнал. Настройки менять нельзя.') ]) ]),
			E('label', { 'class': 'oum-support-mode' }, [ modeRepair, E('span', {}, [ E('strong', {}, 'Диагностика и исправление'), E('small', {}, 'Перед подключением создаётся страховочная копия; специалист получает временный полный доступ.') ]) ])
		]),
		E('div', { 'class': 'oum-support-fields' }, [
			E('label', { 'class': 'oum-support-duration' }, [ E('span', {}, 'Срок сеанса'), duration ])
		]),
		E('p', { 'class': 'oum-support-privacy' }, 'Бесплатный адрес Pinggy случайный и действует не более 60 минут. OUM принимает только заранее подготовленный временный ключ; пароль отключён.'),
		E('label', { 'class': 'oum-support-consent' }, [ consent, E('span', {}, 'Я понимаю, что на выбранное время открываю удалённый доступ к этому роутеру.') ]),
		E('div', { 'class': 'oum-setting-actions' }, [ E('button', { 'class': 'btn cbi-button-action', disabled: support.client_ready ? null : '', click: async ev => {
			const selected = modeRepair.checked ? 'repair' : 'diagnostic';
			ev.currentTarget.disabled = true;
			const result = await callStartSupport(selected, +duration.value, consent.checked);
			if (!result.ok) { ev.currentTarget.disabled = false; ui.addNotification(null, E('p', {}, result.message || 'Не удалось запустить поддержку.'), 'error'); return; }
			location.reload();
		} }, 'Открыть временный доступ') ]),
		supportRecovery(support)
	]);
}

function appSidebar(active) {
	const item = (key, label, path) => E('a', { 'class': `oum-nav-item${active === key ? ' is-active' : ''}`, href: L.url('oum', path) }, label);
	return E('aside', { 'class': 'oum-sidebar', 'aria-label': 'Навигация OUM' }, [ E('div', { 'class': 'oum-brand' }, [ E('span', { 'class': 'oum-brand-mark' }, 'O'), E('span', {}, [ E('strong', {}, 'OUM'), E('small', {}, 'Домашний щит') ]) ]), E('div', { 'class': 'oum-nav-caption' }, 'Меню'), E('nav', { 'class': 'oum-nav' }, [ item('dashboard', 'Панель', 'dashboard'), item('parental', 'Родительский контроль', 'parental'), item('settings', 'Настройки', 'settings'), item('help', 'Помощь', 'help') ]) ]);
}

return view.extend({
	load() { return Promise.all([ callDashboardStatus(), callSupportStatus() ]); },
	render(data) {
		const status = data[0] || {};
		const support = data[1] || { available: false, state: 'unavailable', client_ready: false };
		const checks = [
			[ '1', 'Проверьте интернет', status.wan?.up ? `Подключение есть${status.wan.ipv4 ? ` · ${status.wan.ipv4}` : ''}.` : 'Подключения нет. Проверьте WAN-кабель или данные PPPoE в Настройках.', status.wan?.up ],
			[ '2', 'Проверьте DNS', 'Если открываются IP-адреса, но не сайты, смените основной и Bootstrap DNS активного VPN-движка в Настройках.', null ],
			[ '3', 'Проверьте VPN', status.vpn_enabled ? (status.vpn_ready ? 'VPN работает. При проблеме попробуйте другую ноду или временно отключите VPN.' : 'VPN включён, но требует внимания. Откройте диагностику движка на Главной.') : 'VPN выключен. Проверьте доступ напрямую, затем включите его снова.', status.vpn_ready ],
			[ '4', 'Не помогло?', 'Сохраните резервную копию OUM, перезагрузите роутер и повторите проверку. Сброс VPN не меняет WAN и Wi-Fi.', null ]
		];
		const page = E('main', { 'class': 'oum-main' }, [
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260916-routeicons1` }),
			E('h2', {}, 'Если интернет не работает'),
			E('p', {}, 'Идите сверху вниз: сначала обычное подключение, затем DNS и только после этого VPN.'),
			E('div', { 'class': 'oum-help-grid' }, checks.map(([ number, title, text, ok ]) => E('section', { 'class': 'oum-help-step' }, [ E('span', { 'class': 'oum-help-number' }, number), E('div', {}, [ E('h3', {}, title), E('p', { 'class': ok == null ? '' : 'oum-help-result', 'data-ok': ok == null ? null : String(ok) }, text) ]) ]))),
			E('div', { 'class': 'oum-setting-actions' }, [ E('a', { 'class': 'btn cbi-button-action', href: L.url('oum', 'dashboard') }, 'Открыть главную'), ' ', E('a', { 'class': 'btn', href: L.url('oum', 'settings') }, 'Открыть настройки') ]),
			supportPanel(support),
			E('details', { 'class': 'oum-help-extra' }, [
				E('summary', {}, 'Дополнительно: YouTube на Windows'),
				E('p', {}, 'Если YouTube через Zapret всё равно подвисает, можно попробовать включить TCP timestamps. Это необязательная настройка ПК, а не требование OUM.'),
				E('div', { 'class': 'oum-help-code' }, [ E('code', {}, 'netsh int tcp set global timestamps=enabled'), E('button', { 'class': 'btn', click: () => navigator.clipboard.writeText('netsh int tcp set global timestamps=enabled').then(() => ui.addNotification(null, E('p', {}, 'Команда скопирована.'), 'info')) }, 'Копировать') ])
			]),
			E('p', { 'class': 'oum-help-extra' }, [ E('strong', {}, 'Безопасность: '), 'вход admin без пароля используйте только в доверенной локальной сети. Не публикуйте LuCI или OUM в интернет.' ]),
			E('section', { id: 'vpn-guide', 'class': 'oum-help-guide' }, [
				E('h2', {}, 'Инструкция OUM'),
				E('p', {}, 'Доступна на роутере даже без интернета.'),
				...[["Первый запуск", "Подключите кабель интернета к WAN-порту. Выберите DHCP либо PPPoE по данным провайдера. Задайте имя и пароль Wi-Fi, затем пароль доступа к роутеру. После применения подключитесь к новой сети. VPN на этом этапе не настраивается."], ["Выбор движка", "Откройте Настройки → VPN-движок. PassWall подходит для подписок и прокси-ссылок, OpenClash — для подписок, прокси и поддерживаемых конфигураций AWG, Podkop + Zapret — для AWG или Reality и обхода через Zapret. Доступные способы зависят от установленного движка. При замене движка его прежние настройки удаляются: сначала сохраните резервную копию."], ["Добавление подключения", "В Настройках откройте защищённое подключение. Выберите доступный тип: подписка, прокси-ссылка или AWG. Вставьте данные от провайдера и запустите импорт. Дождитесь результата операции. Новый источник заменяет предыдущий; ключи и ссылки подписки не публикуйте."], ["Проверка VPN", "На главной выберите ноду и дождитесь подтверждения переключения. Откройте нужный сервис. Если он не работает даже при полном VPN на устройстве, попробуйте другую ноду: сервис может ограничивать страну или IP сервера. Загрузка главной страницы ещё не подтверждает работу приложения."], ["Маршрутизация устройств", "На главной откройте настройки подключённого устройства. «По общим правилам» использует общую схему. «Всегда напрямую» обходит VPN. «Полностью через VPN» направляет интернет-трафик устройства через выбранную ноду. «Игры напрямую» доступно в PassWall: игровые порты обходят VPN, остальной трафик следует общим правилам. В мобильной форме выберите режим и нажмите «Готово», затем дождитесь результата."], ["DNS и неполадки", "Настройки → DNS для VPN: выберите основной и Bootstrap DNS, нажмите «Применить DNS» и подтвердите. Дождитесь завершения. Если не работает весь интернет, сначала проверьте WAN и доступ напрямую. Если проблема только у одного сервиса, проверьте другую ноду. Собственный VPN или защищённый DNS на телефоне может влиять на результат."], ["Резервная копия", "Настройки → Обслуживание OUM → Резервная копия. Сохраните файл перед заменой движка или крупными изменениями. Файл содержит настройки и секреты; храните его приватно. Восстановление принимает копию OUM для совместимой модели и проверяет её перед применением."]].map(([title, text]) => E('details', { 'class': 'oum-help-extra' }, [E('summary', {}, title), E('p', {}, text)]))
			])
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
