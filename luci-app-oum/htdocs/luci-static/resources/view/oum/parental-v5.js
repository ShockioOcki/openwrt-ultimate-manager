'use strict';
'require view';
'require rpc';
'require ui';

const callParentalStatus = rpc.declare({ object: 'oum', method: 'parentalStatus', expect: { '': {} } });
const callSetPaused = rpc.declare({ object: 'oum', method: 'setDevicePaused', params: [ 'mac', 'paused' ], expect: { '': {} } });
const callSetSchedule = rpc.declare({ object: 'oum', method: 'setParentalSchedule', params: [ 'mac', 'enabled', 'days', 'start', 'stop' ], expect: { '': {} } });
const callSetAdGuard = rpc.declare({ object: 'oum', method: 'setAdGuard', params: [ 'mode' ], expect: { '': {} } });
const callSetDeviceAdGuard = rpc.declare({ object: 'oum', method: 'setDeviceAdGuard', params: [ 'mac', 'mode' ], expect: { '': {} } });
const callSystemJobStatus = rpc.declare({ object: 'oum', method: 'systemJobStatus', expect: { '': {} } });

function appSidebar(active) {
	const item = (key, label, path) => E('a', { 'class': `oum-nav-item${active === key ? ' is-active' : ''}`, href: L.url('oum', path) }, label);
	return E('aside', { 'class': 'oum-sidebar', 'aria-label': 'Навигация OUM' }, [ E('div', { 'class': 'oum-brand' }, [ E('span', { 'class': 'oum-brand-mark' }, 'O'), E('span', {}, [ E('strong', {}, 'OUM'), E('small', {}, 'Домашний щит') ]) ]), E('div', { 'class': 'oum-nav-caption' }, 'Меню'), E('nav', { 'class': 'oum-nav' }, [ item('dashboard', 'Панель', 'dashboard'), item('parental', 'Родительский контроль', 'parental'), item('settings', 'Настройки', 'settings'), item('help', 'Помощь', 'help') ]) ]);
}

function resultError(result, fallback) {
	if (!result || result.ok !== true) throw new Error(result?.message || fallback);
	return result;
}

function modeSelect(value, id) {
	return E('label', { 'class': 'oum-parental-filter' }, [
		E('span', {}, 'DNS-фильтр'),
		E('select', { id, 'data-adguard-mode': '' }, [
			E('option', { value: 'inherit', selected: value === 'inherit' ? '' : null }, 'Как для всей сети'),
			E('option', { value: 'off', selected: value === 'off' ? '' : null }, 'Без AdGuard DNS'),
			E('option', { value: 'standard', selected: value === 'standard' ? '' : null }, 'Реклама и трекеры'),
			E('option', { value: 'family', selected: value === 'family' ? '' : null }, 'Семейный фильтр')
		])
	]);
}

return view.extend({
	load() { return callParentalStatus(); },

	render(status) {
		const days = [ [ '1', 'Пн' ], [ '2', 'Вт' ], [ '3', 'Ср' ], [ '4', 'Чт' ], [ '5', 'Пт' ], [ '6', 'Сб' ], [ '7', 'Вс' ] ];
		const page = E('main', { 'class': 'oum-main' }, [
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260907-quick14` }),
			E('div', { 'class': 'oum-parental-head' }, [ E('div', {}, [ E('h2', {}, 'Родительский контроль'), E('p', { 'class': 'oum-parental-help' }, 'Ограничивайте доступ в интернет по времени и выбирайте DNS-фильтр для всей сети или отдельного устройства.') ]), E('a', { 'class': 'btn', href: L.url('oum', 'settings') }, 'Настройки') ]),
			E('details', { 'class': 'oum-parental-guide' }, [
				E('summary', {}, 'Как работает родительский контроль'),
				E('ul', {}, [
					E('li', {}, [ E('strong', {}, 'Пауза сейчас'), ' отключает интернет у выбранного устройства до ручного возобновления. Доступ к роутеру и домашней сети сохраняется.' ]),
					E('li', {}, [ E('strong', {}, 'Расписание'), ' повторяет паузу в выбранные дни. Проверка выполняется каждые 5 минут, поэтому включение или снятие ограничения может немного задержаться.' ]),
					E('li', {}, [ E('strong', {}, 'DNS-фильтр'), ' блокирует известные домены рекламы, трекеров и нежелательных сайтов. Он не меняет VPN-маршрутизацию и не заменяет контроль содержимого на самом устройстве.' ])
				])
			]),
			E('section', { 'class': 'oum-parental-panel' }, [
				E('h3', {}, 'Фильтр для всей сети'),
				E('p', { 'class': 'oum-parental-help' }, 'Режим применяется ко всем устройствам, у которых выбрано «Как для всей сети». «Реклама и трекеры» блокирует известные рекламные и аналитические домены. «Семейный фильтр» дополнительно ограничивает сайты для взрослых.'),
				E('div', { 'class': 'oum-parental-global' }, [
					E('label', {}, [ E('span', {}, 'Режим для всей сети'), E('select', { id: 'global-adguard' }, [
						E('option', { value: 'off', selected: status.mode === 'off' ? '' : null }, 'Без AdGuard DNS'),
						E('option', { value: 'standard', selected: status.mode === 'standard' ? '' : null }, 'Реклама и трекеры'),
						E('option', { value: 'family', selected: status.mode === 'family' ? '' : null }, 'Семейный фильтр')
					]) ]),
					E('button', { 'class': 'btn cbi-button-action', id: 'apply-global-adguard' }, 'Применить')
				]),
				E('p', { 'class': 'oum-parental-help' }, 'Чтобы устройство сразу получило новый DNS, переподключите его к Wi-Fi или кабелю. Собственный DNS или защищённый DNS в браузере может обойти этот фильтр.')
			]),
			E('section', { 'class': 'oum-parental-panel' }, [
				E('h3', {}, 'Устройства'),
				E('p', { 'class': 'oum-parental-help' }, 'Здесь показаны только устройства, которые вы добавили на главной странице. Для каждого можно выбрать DNS-фильтр, временно отключить интернет или настроить регулярную паузу.'),
			...(status.devices?.length ? status.devices.map((device) => {
				const pauseState = device.schedule_paused ? ' · заблокировано расписанием' : (device.manual_paused ? ' · пауза включена' : '');
				return E('div', { 'class': 'oum-parental-device', 'data-device': device.mac }, [
					E('button', { type: 'button', 'class': 'oum-parental-row', 'data-action': 'open-device' }, [
						E('span', { 'class': 'oum-parental-row-main' }, [
							E('strong', {}, device.name),
							E('small', {}, `${device.online ? 'В сети' : 'Не в сети'} · ${device.mac}${pauseState}`)
						]),
						E('span', { 'class': 'oum-parental-row-chev', 'aria-hidden': 'true' }, '›')
					])
				]);
			}) : [ E('div', { 'class': 'oum-parental-empty' }, 'Список пока пуст. Добавьте нужное устройство на главной странице — случайные лампы, телевизоры и другая техника сюда не попадут.') ])
			])
		]);
		const root = E('div', { 'class': 'oum-parental oum-app', 'data-theme': document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, [ page ]);

		const reload = () => window.setTimeout(() => window.location.reload(), 700);
		const notifyError = (error) => ui.addNotification(null, E('p', {}, error.message), 'error');
		root.querySelector('#apply-global-adguard').addEventListener('click', (event) => {
			event.preventDefault();
			const button = event.currentTarget;
			button.disabled = true;
			callSetAdGuard(root.querySelector('#global-adguard').value).then((result) => {
				resultError(result, 'Не удалось запустить DNS-фильтр.');
				const poll = () => callSystemJobStatus().then((job) => job.state === 'running' ? window.setTimeout(poll, 800) : (job.state === 'success' ? reload() : Promise.reject(new Error(job.message || 'DNS-фильтр не применился.')))).catch(notifyError);
				poll();
			}).catch(notifyError).finally(() => { button.disabled = false; });
		});
		root.addEventListener('change', (event) => {
			if (!event.target.matches('[data-adguard-mode]')) return;
			const row = event.target.closest('[data-device]');
			callSetDeviceAdGuard(row.dataset.device, event.target.value).then((result) => { resultError(result, 'Не удалось сохранить фильтр.'); ui.addNotification(null, E('p', {}, result.message), 'info'); }).catch(notifyError);
		});
		const deviceSheet = (device) => {
			const selectedDays = new Set(String(device.sched_days || '').split(','));
			return E('div', { 'data-device': device.mac }, [
				E('p', { 'class': 'oum-help oum-parental-sheet-status', style: 'margin:0 0 8px;' }, `${device.online ? 'В сети' : 'Не в сети'} · ${device.mac}${device.schedule_paused ? ' · заблокировано расписанием' : (device.manual_paused ? ' · пауза включена' : '')}`),
				modeSelect(device.adblock || 'inherit', `adguard-${device.mac}`),
				E('div', { 'class': 'oum-parental-controls', style: 'margin-top:10px;' }, [ E('button', { 'class': 'btn', 'data-action': 'pause', 'data-paused': device.manual_paused ? '1' : '0' }, device.manual_paused ? 'Возобновить' : 'Пауза сейчас'), E('button', { 'class': 'btn', 'data-action': 'toggle-schedule' }, 'Расписание') ]),
				E('div', { 'class': 'oum-parental-schedule', hidden: '' }, [
					E('label', {}, [ E('input', { type: 'checkbox', 'data-schedule-enabled': '', checked: device.sched_enabled ? '' : null }), ' Включить расписание' ]),
					E('p', { 'class': 'oum-parental-help' }, 'Выбранный день означает начало паузы. Например, Пн с 22:00 до 07:00 заблокирует интернет с вечера понедельника до утра вторника. Ручная пауза действует независимо от расписания.'),
					E('div', { 'class': 'oum-parental-days' }, days.map(([ value, label ]) => E('label', { 'class': 'oum-parental-day' }, [ E('input', { type: 'checkbox', value, 'data-schedule-day': '', checked: selectedDays.has(value) ? '' : null }), label ]))),
					E('div', { 'class': 'oum-parental-times' }, [
						E('label', {}, [ 'Без интернета с', E('input', { type: 'time', 'data-schedule-start': '', value: device.start || '22:00' }) ]),
						E('label', {}, [ 'до', E('input', { type: 'time', 'data-schedule-stop': '', value: device.stop || '07:00' }) ]),
						E('button', { 'class': 'btn cbi-button-action', 'data-action': 'save-schedule' }, 'Сохранить')
					])
				])
			]);
		};
		const sheet = E('div', { 'class': 'oum-settings-sheet oum-parental-sheet', hidden: '', role: 'dialog', 'aria-modal': 'true' }, [
			E('div', { 'class': 'oum-settings-sheet-panel' }, [
				E('span', { 'class': 'oum-settings-sheet-handle', 'aria-hidden': 'true' }),
				E('header', { 'class': 'oum-settings-sheet-head' }, [
					E('h3', { id: 'oum-parental-sheet-title' }, ''),
					E('button', { type: 'button', 'class': 'oum-settings-sheet-close', 'aria-label': 'Закрыть' }, '×')
				]),
				E('div', { 'class': 'oum-settings-sheet-content' })
			])
		]);
		root.appendChild(sheet);
		const sheetTitle = sheet.querySelector('#oum-parental-sheet-title');
		const sheetContent = sheet.querySelector('.oum-settings-sheet-content');
		const closeParentalSheet = () => {
			sheetContent.innerHTML = '';
			sheet.hidden = true;
			document.documentElement.classList.remove('oum-settings-sheet-open');
		};
		const openParentalSheet = (title, node) => {
			sheetContent.innerHTML = '';
			sheetTitle.textContent = title;
			sheetContent.appendChild(node);
			sheet.hidden = false;
			document.documentElement.classList.add('oum-settings-sheet-open');
			try {
				const panel = sheet.querySelector('.oum-settings-sheet-panel');
				if (panel) {
					if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
					try { panel.style.setProperty('outline', 'none', 'important'); }
					catch (_) { panel.style.outline = 'none'; }
					if (panel.focus) panel.focus({ preventScroll: true });
				}
			} catch (_) {}
		};
		sheet.querySelector('.oum-settings-sheet-close').addEventListener('click', closeParentalSheet);
		sheet.addEventListener('click', (event) => { if (event.target === sheet) closeParentalSheet(); });
		document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !sheet.hidden) closeParentalSheet(); });
		const sheetPanel = sheet.querySelector('.oum-settings-sheet-panel');
		let sheetSy = 0, sheetCy = 0, sheetDrag = false;
		sheetPanel.addEventListener('touchstart', (event) => {
			if (event.touches.length !== 1) return;
			sheetSy = event.touches[0].clientY;
			sheetDrag = true;
			try { for (let el = event.target; el; el = el.parentElement) { if (el.scrollHeight > el.clientHeight + 4 && el.scrollTop > 0) { sheetDrag = false; break; } if (el === sheetPanel) break; } } catch (_) {}
			try { if (sheetSy - sheetPanel.getBoundingClientRect().top < 72) sheetDrag = true; } catch (_) {}
			sheetPanel.style.transition = 'none';
		}, { passive: true });
		sheetPanel.addEventListener('touchmove', (event) => {
			if (!sheetDrag || event.touches.length !== 1) return;
			sheetCy = event.touches[0].clientY - sheetSy;
			if (sheetCy > 0) sheetPanel.style.transform = `translateY(${sheetCy}px)`;
		}, { passive: true });
		sheetPanel.addEventListener('touchend', () => {
			sheetDrag = false;
			sheetPanel.style.transition = 'transform .2s';
			if (sheetCy > 90) closeParentalSheet();
			sheetPanel.style.transform = '';
			sheetCy = 0;
		});
		root.addEventListener('click', (event) => {
			const el = event.target.closest ? event.target.closest('[data-action]') : null;
			const action = el && el.dataset.action;
			if (!action) return;
			event.preventDefault();
			const row = el.closest('[data-device]');
			if (action === 'open-device') {
				const device = (status.devices || []).find((d) => d.mac === row.dataset.device);
				if (device) openParentalSheet(device.name || 'Устройство', deviceSheet(device));
				return;
			}
			if (action === 'toggle-schedule') {
				const panel = row.querySelector('.oum-parental-schedule');
				panel.hidden = !panel.hidden;
				return;
			}
			if (action === 'pause') {
				const paused = el.dataset.paused !== '1';
				callSetPaused(row.dataset.device, paused).then((result) => { resultError(result, 'Не удалось изменить паузу.'); reload(); }).catch(notifyError);
				return;
			}
			if (action === 'save-schedule') {
				const enabled = row.querySelector('[data-schedule-enabled]').checked;
				const selected = Array.from(row.querySelectorAll('[data-schedule-day]:checked')).map((input) => input.value).join(',');
				const start = row.querySelector('[data-schedule-start]').value;
				const stop = row.querySelector('[data-schedule-stop]').value;
				if (enabled && (!selected || !start || !stop || start === stop)) return ui.addNotification(null, E('p', {}, 'Выберите дни и разное время начала и окончания.'), 'warning');
				callSetSchedule(row.dataset.device, enabled, selected || '1,2,3,4,5', start || '22:00', stop || '07:00').then((result) => { resultError(result, 'Не удалось сохранить расписание.'); reload(); }).catch(notifyError);
			}
		});
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
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
