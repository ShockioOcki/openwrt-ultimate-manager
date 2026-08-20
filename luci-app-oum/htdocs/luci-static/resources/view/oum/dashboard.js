'use strict';
'require view';
'require rpc';

const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });

return view.extend({
	load() { return callStatus(); },
	render(status) {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'OUM'),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'Состояние'),
				E('p', {}, status.setup_complete ? 'Первичная настройка завершена.' : 'Первичная настройка ещё не завершена.'),
				E('p', {}, `Режим VPN: ${status.active_source || 'none'}`),
				E('p', {}, `Регион Wi-Fi: ${status.country || 'US'}`)
			]),
			E('p', {}, 'Виджеты сети, клиентов, скорости, температуры и VPN будут добавлены после стабилизации мастера первого запуска.')
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

