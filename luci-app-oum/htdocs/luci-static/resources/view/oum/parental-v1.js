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
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260902-mobile9` }),
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
					const selectedDays = new Set(String(device.sched_days || '').split(','));
					return E('div', { 'class': 'oum-parental-device', 'data-device': device.mac }, [
						E('div', { 'class': 'oum-parental-summary' }, [
							E('div', { 'class': 'oum-parental-name' }, [ E('strong', {}, device.name), E('small', {}, `${device.online ? 'В сети' : 'Не в сети'} · ${device.mac}`), E('span', { 'class': 'oum-parental-state' }, device.schedule_paused ? ' · заблокировано расписанием' : (device.manual_paused ? ' · пауза включена' : '')) ]),
							modeSelect(device.adblock || 'inherit', `adguard-${device.mac}`),
							E('div', { 'class': 'oum-parental-controls' }, [ E('button', { 'class': 'btn', 'data-action': 'pause', 'data-paused': device.manual_paused ? '1' : '0' }, device.manual_paused ? 'Возобновить' : 'Пауза сейчас'), E('button', { 'class': 'btn', 'data-action': 'toggle-schedule' }, 'Расписание') ])
						]),
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
		root.addEventListener('click', (event) => {
			const action = event.target.dataset.action;
			if (!action) return;
			event.preventDefault();
			const row = event.target.closest('[data-device]');
			if (action === 'toggle-schedule') {
				const panel = row.querySelector('.oum-parental-schedule');
				panel.hidden = !panel.hidden;
				return;
			}
			if (action === 'pause') {
				const paused = event.target.dataset.paused !== '1';
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
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
