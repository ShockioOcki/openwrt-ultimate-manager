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
		const root = E('div', { 'class': 'oum-parental' }, [
			E('style', {}, `
				.oum-parental{max-width:1000px;margin:0 auto}.oum-parental h2{margin-bottom:4px}.oum-parental-panel{border:1px solid #ccd3dc;border-radius:8px;padding:18px;margin:16px 0}.oum-parental-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.oum-parental-help{opacity:.72;line-height:1.45}.oum-parental-guide{border:1px solid #ccd3dc;border-radius:8px;padding:13px 15px;margin:16px 0}.oum-parental-guide summary{cursor:pointer;font-weight:600}.oum-parental-guide ul{margin:10px 0 2px;padding-left:20px}.oum-parental-guide li+li{margin-top:7px}.oum-parental-global{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.oum-parental-global label,.oum-parental-filter{display:grid;gap:5px}.oum-parental-global label>span,.oum-parental-filter>span{font-size:.85rem;font-weight:600}.oum-parental-global select{min-width:210px}.oum-parental-device{border:1px solid #ccd3dc;border-radius:8px;margin:10px 0;overflow:hidden}.oum-parental-summary{display:grid;grid-template-columns:minmax(150px,1fr) minmax(190px,auto) auto;align-items:end;gap:10px;padding:12px}.oum-parental-name small{display:block;opacity:.65;margin-top:3px}.oum-parental-controls{display:flex;gap:8px;align-items:center}.oum-parental-schedule{border-top:1px solid #ccd3dc;padding:12px;background:rgba(127,127,127,.05)}.oum-parental-schedule>.oum-parental-help{margin:8px 0 0}.oum-parental-days{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.oum-parental-day{display:flex;gap:5px;align-items:center;border:1px solid #ccd3dc;border-radius:999px;padding:6px 9px}.oum-parental-times{display:flex;align-items:end;gap:10px;flex-wrap:wrap}.oum-parental-times label{display:grid;gap:5px}.oum-parental-times input{min-height:38px}.oum-parental-state{font-size:.85rem;opacity:.72}.oum-parental-empty{padding:24px;text-align:center;opacity:.7}@media(max-width:720px){.oum-parental-head{align-items:flex-start}.oum-parental-summary{grid-template-columns:1fr}.oum-parental-controls{flex-wrap:wrap}.oum-parental-filter,.oum-parental-summary select{width:100%}}
			`),
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
				E('p', { 'class': 'oum-parental-help' }, 'Для каждого устройства можно переопределить общий DNS-фильтр, временно отключить интернет или настроить регулярную паузу.'),
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
				}) : [ E('div', { 'class': 'oum-parental-empty' }, 'Подключите устройство к роутеру — оно появится здесь автоматически.') ])
			])
		]);

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
