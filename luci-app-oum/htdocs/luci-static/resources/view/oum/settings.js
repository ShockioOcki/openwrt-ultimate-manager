'use strict';
'require view';
'require rpc';
'require ui';

const callSettingsStatus = rpc.declare({ object: 'oum', method: 'settingsStatus', expect: { '': {} } });
const callSystemJobStatus = rpc.declare({ object: 'oum', method: 'systemJobStatus', expect: { '': {} } });
const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });
const callVpnJobStatus = rpc.declare({ object: 'oum', method: 'vpnJobStatus', expect: { '': {} } });
const callStartVpnImport = rpc.declare({
	object: 'oum', method: 'startVpnImport', params: [ 'vpn_type', 'payload' ], expect: { '': {} }
});
const callApplyWifi = rpc.declare({
	object: 'oum', method: 'applyWifiSettings', params: [ 'wifi_mode', 'ssid_24', 'ssid_5', 'wifi_password' ], expect: { '': {} }
});
const callApplyWan = rpc.declare({
	object: 'oum', method: 'applyWanSettings', params: [ 'wan_type', 'pppoe_user', 'pppoe_password' ], expect: { '': {} }
});
const callRollback = rpc.declare({ object: 'oum', method: 'rollbackSettings', params: [ 'kind' ], expect: { '': {} } });
const callCreateBackup = rpc.declare({ object: 'oum', method: 'createBackup', expect: { '': {} } });
const callRestoreBackup = rpc.declare({ object: 'oum', method: 'restoreBackup', params: [ 'data' ], expect: { '': {} } });
const callResetVpn = rpc.declare({ object: 'oum', method: 'resetVpn', expect: { '': {} } });
const callResetFirstRun = rpc.declare({ object: 'oum', method: 'resetFirstRun', expect: { '': {} } });

function choice(name, value, title, description, checked) {
	return E('label', { 'class': 'oum-setting-choice' }, [
		E('input', { type: 'radio', name, value, checked: checked ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

function sourceChoice(value, title, description, checked) {
	return E('label', { 'class': 'oum-source-choice' }, [
		E('input', { type: 'radio', name: 'vpn_source', value, checked: checked ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

function field(label, input) {
	return E('div', { 'class': 'oum-setting-field' }, [ E('label', {}, label), input ]);
}

function resultError(result, fallback) {
	if (!result || result.ok !== true)
		throw new Error(result?.message || fallback);
	return result;
}

function confirmation(title, text, actionLabel, danger) {
	return new Promise((resolve) => {
		ui.showModal(title, [
			E('p', {}, text),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', click: () => { ui.hideModal(); resolve(false); } }, 'Отмена'),
				' ',
				E('button', {
					'class': danger ? 'btn cbi-button-negative important' : 'btn cbi-button-action important',
					click: () => { ui.hideModal(); resolve(true); }
				}, actionLabel)
			])
		]);
	});
}

function saveBase64(filename, data) {
	const binary = atob(data.replace(/\s/g, ''));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const url = URL.createObjectURL(new Blob([ bytes ], { type: 'application/octet-stream' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

return view.extend({
	load() {
		return Promise.all([ callSettingsStatus(), callSystemJobStatus(), callStatus(), callVpnJobStatus() ]);
	},

	render(data) {
		const settings = data[0];
		const initialJob = data[1];
		const status = data[2];
		const initialVpnJob = data[3];
		if (!status.setup_complete)
			return E('div', {}, [
				E('h2', {}, 'OUM'),
				E('p', {}, 'Сначала завершите первоначальную настройку роутера.'),
				E('a', { class: 'btn cbi-button-action', href: L.url('oum', 'setup') }, 'Открыть мастер')
			]);
		const wifi = settings.wifi || {};
		const wan = settings.wan || {};
		let selectedSource = status.pending_source !== 'none' ? status.pending_source :
			(status.active_source !== 'none' ? status.active_source : 'subscription');
		const root = E('div', { 'class': 'oum-settings' }, [
			E('style', {}, `
				.oum-settings{max-width:1000px;margin:0 auto}.oum-page-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-page-head h2{margin:0}.oum-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.oum-settings-panel{border:1px solid #ccd3dc;border-radius:12px;padding:18px;margin-bottom:16px}.oum-settings-panel h3{margin-top:0}
				.oum-setting-choices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.oum-setting-choice{display:flex;gap:9px;padding:12px;border:1px solid #ccd3dc;border-radius:9px;cursor:pointer}.oum-setting-choice:has(input:checked){border-color:#1677ff;background:#edf5ff}.oum-setting-choice span{display:flex;flex-direction:column;gap:4px}.oum-setting-choice small,.oum-help{opacity:.7;line-height:1.45}
				.oum-setting-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oum-setting-field{margin:11px 0}.oum-setting-field label{display:block;font-weight:600;margin-bottom:6px}.oum-setting-field input{width:100%;box-sizing:border-box}.oum-setting-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:13px}.oum-job-state{padding:11px 13px;border-radius:8px;background:#eef4fa;margin:0 0 16px}.oum-job-state[data-state="failed"]{background:#ffe9e7}.oum-job-state[data-state="success"]{background:#e6f7eb}
				.oum-maintenance{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.oum-maintenance-card{border:1px solid #d8dde5;border-radius:10px;padding:14px}.oum-maintenance-card h4{margin:0 0 8px}.oum-maintenance-card button{margin-top:9px}.oum-danger{border-color:#e6b5b0}.oum-file{max-width:100%}
				.oum-protected>summary{cursor:pointer;font-size:1.15rem;font-weight:600}.oum-protected[open]>summary{margin-bottom:14px}.oum-protected-content{border-top:1px solid #d8dde5;padding-top:14px}.oum-sources{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.oum-source-choice{display:flex;gap:10px;border:1px solid #ccd3dc;border-radius:10px;padding:14px;cursor:pointer}.oum-source-choice:has(input:checked){border-color:#1677ff;background:#edf5ff}.oum-source-choice span{display:flex;flex-direction:column;gap:5px}.oum-source-choice small{opacity:.72;line-height:1.4}
				.oum-vpn-input{margin:18px 0}.oum-vpn-input label{display:block;font-weight:600;margin-bottom:7px}.oum-vpn-input input,.oum-vpn-input textarea{width:100%;box-sizing:border-box}.oum-vpn-input textarea{min-height:180px;font-family:monospace}.oum-vpn-job{padding:12px;border-radius:8px;background:#eef4fa;margin:14px 0}.oum-vpn-job[data-state="failed"]{background:#ffe9e7}.oum-vpn-job[data-state="success"]{background:#e6f7eb}
				@media(max-width:760px){.oum-settings-grid,.oum-setting-fields,.oum-maintenance,.oum-sources{grid-template-columns:1fr}.oum-setting-choices{grid-template-columns:1fr}}
			`),
			E('div', { 'class': 'oum-page-head' }, [
				E('h2', {}, 'Настройки OUM'),
				E('a', { 'class': 'btn cbi-button', href: L.url('oum', 'logout') }, 'Выйти')
			]),
			E('p', { 'class': 'oum-help' }, 'Пароли не показываются в браузере. Оставьте поле пароля пустым, чтобы сохранить действующий.'),
			E('div', { id: 'system-job', 'class': 'oum-job-state', 'data-state': initialJob.state || 'idle' }, initialJob.message || 'Системные операции не выполняются.'),
			E('div', { 'class': 'oum-settings-grid' }, [
				E('section', { 'class': 'oum-settings-panel' }, [
					E('h3', {}, 'Wi-Fi'),
					E('div', { 'class': 'oum-setting-choices' }, [
						choice('wifi_mode', 'smart', 'Одна сеть', 'Общее имя для 2,4 и 5 ГГц', wifi.mode !== 'separate'),
						choice('wifi_mode', 'separate', 'Две сети', 'Отдельные имена диапазонов', wifi.mode === 'separate')
					]),
					E('div', { 'class': 'oum-setting-fields' }, [
						field('Имя сети 2,4 ГГц', E('input', { id: 'ssid-24', maxlength: 32, value: wifi.ssid_24 || '' })),
						field('Имя сети 5 ГГц', E('input', { id: 'ssid-5', maxlength: 32, value: wifi.ssid_5 || '' }))
					]),
					field('Новый пароль', E('input', { id: 'wifi-password', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password', placeholder: wifi.password_set ? 'Не изменять' : 'От 8 до 63 символов' })),
					field('Повторите новый пароль', E('input', { id: 'wifi-password-confirm', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password' })),
					E('p', { 'class': 'oum-help' }, 'Регион US и шифрование WPA2/WPA3 mixed сохраняются автоматически.'),
					E('div', { 'class': 'oum-setting-actions' }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'apply-wifi', 'data-system-action': '' }, 'Применить Wi-Fi'),
						E('button', { 'class': 'btn', id: 'rollback-wifi', disabled: settings.rollback_wifi ? null : '', 'data-system-action': '' }, 'Вернуть предыдущие')
					])
				]),
				E('section', { 'class': 'oum-settings-panel' }, [
					E('h3', {}, 'Подключение к интернету'),
					E('div', { 'class': 'oum-setting-choices' }, [
						choice('wan_type', 'dhcp', 'DHCP', 'Без логина и пароля', wan.proto !== 'pppoe'),
						choice('wan_type', 'pppoe', 'PPPoE', 'Логин и пароль провайдера', wan.proto === 'pppoe')
					]),
					E('div', { id: 'pppoe-settings' }, [
						field('Логин PPPoE', E('input', { id: 'pppoe-user', maxlength: 128, autocomplete: 'username', value: wan.username || '' })),
						field('Новый пароль PPPoE', E('input', { id: 'pppoe-password', type: 'password', maxlength: 256, autocomplete: 'new-password', placeholder: wan.password_set ? 'Не изменять' : '' }))
					]),
					E('p', { 'class': 'oum-help' }, [ 'Сейчас: ', E('strong', {}, wan.up ? 'подключено' : 'нет соединения'), wan.ipv4 ? ` · ${wan.ipv4}` : '' ]),
					E('div', { 'class': 'oum-setting-actions' }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'apply-wan', 'data-system-action': '' }, 'Применить подключение'),
						E('button', { 'class': 'btn', id: 'rollback-wan', disabled: settings.rollback_wan ? null : '', 'data-system-action': '' }, 'Вернуть предыдущие')
					])
				])
			]),
			E('details', {
				'class': 'oum-settings-panel oum-protected',
				open: status.pending_source !== 'none' && status.active_source === 'none' ? '' : null
			}, [
				E('summary', {}, 'Защищённое подключение'),
				E('div', { 'class': 'oum-protected-content' }, [
					E('p', { 'class': 'oum-help' }, 'Новый источник полностью заменяет предыдущий OUM-профиль. При ошибке старый профиль восстанавливается.'),
					E('div', { 'class': 'oum-sources' }, [
						sourceChoice('subscription', 'Subscription', 'Ссылка на набор серверов', selectedSource === 'subscription'),
						sourceChoice('awg', 'AWG Tunnel', 'Конфигурация AmneziaWG', selectedSource === 'awg'),
						sourceChoice('proxy', 'Proxy', 'VLESS Reality или Hysteria2', selectedSource === 'proxy')
					]),
					E('div', { 'class': 'oum-vpn-input' }, [
						E('label', { id: 'source-label' }, ''),
						E('input', { id: 'subscription-input', type: 'url', autocomplete: 'off', spellcheck: 'false' }),
						E('textarea', { id: 'config-input', autocomplete: 'off', spellcheck: 'false', hidden: '' })
					]),
					E('div', { 'class': 'oum-vpn-job', id: 'vpn-job-status', 'data-state': initialVpnJob.state || 'idle' }, initialVpnJob.message || 'Готово к добавлению подключения.'),
					E('button', { 'class': 'btn cbi-button-action', id: 'import-source' }, 'Проверить и активировать')
				])
			]),
			E('section', { 'class': 'oum-settings-panel' }, [
				E('h3', {}, 'Резервная копия и сброс'),
				E('div', { 'class': 'oum-maintenance' }, [
					E('div', { 'class': 'oum-maintenance-card' }, [
						E('h4', {}, 'Резервная копия'),
						E('p', { 'class': 'oum-help' }, 'Сохраняет сеть, Wi-Fi, OUM, OpenClash и активный VPN-профиль. Файл содержит секреты и не зашифрован.'),
						E('button', { 'class': 'btn cbi-button', id: 'create-backup', 'data-system-action': '' }, 'Скачать копию')
					]),
					E('div', { 'class': 'oum-maintenance-card' }, [
						E('h4', {}, 'Восстановление'),
						E('p', { 'class': 'oum-help' }, 'Принимается только копия OUM для этой модели роутера. Перед применением она полностью проверяется.'),
						E('input', { type: 'file', id: 'restore-file', accept: '.oum', 'class': 'oum-file' }),
						E('button', { 'class': 'btn cbi-button', id: 'restore-backup', 'data-system-action': '' }, 'Восстановить')
					]),
					E('div', { 'class': 'oum-maintenance-card oum-danger' }, [
						E('h4', {}, 'Сброс'),
						E('p', { 'class': 'oum-help' }, 'Можно удалить только VPN либо заново открыть мастер первоначальной настройки.'),
						E('div', { 'class': 'oum-setting-actions' }, [
							E('button', { 'class': 'btn cbi-button-negative', id: 'reset-vpn', 'data-system-action': '' }, 'Сбросить VPN'),
							E('button', { 'class': 'btn cbi-button-negative', id: 'reset-all', 'data-system-action': '' }, 'Первый запуск')
						])
					])
				])
			])
		]);

		const value = (selector) => root.querySelector(selector).value.trim();
		const rawValue = (selector) => root.querySelector(selector).value;
		const selected = (name) => root.querySelector(`[name="${name}"]:checked`)?.value || '';
		const statusNode = root.querySelector('#system-job');
		const vpnJobNode = root.querySelector('#vpn-job-status');
		const importButton = root.querySelector('#import-source');
		const urlInput = root.querySelector('#subscription-input');
		const configInput = root.querySelector('#config-input');
		const sourceLabel = root.querySelector('#source-label');
		let watching = false;

		const setBusy = (busy) => root.querySelectorAll('[data-system-action]').forEach((button) => {
			if (busy && button.dataset.wasDisabled == null)
				button.dataset.wasDisabled = button.disabled ? '1' : '0';
			button.disabled = busy ? true : button.dataset.wasDisabled === '1';
			if (!busy)
				delete button.dataset.wasDisabled;
		});
		const paintStatus = (status) => {
			statusNode.dataset.state = status.state || 'idle';
			statusNode.textContent = status.message || 'Системные операции не выполняются.';
		};
		const watchJob = () => {
			if (watching) return;
			watching = true;
			setBusy(true);
			const tick = () => callSystemJobStatus().then((status) => {
				paintStatus(status);
				if (status.state === 'running') return window.setTimeout(tick, 1500);
				watching = false;
				setBusy(false);
			}).catch(() => window.setTimeout(tick, 2000));
			tick();
		};
		const start = (promise) => promise.then((result) => {
			resultError(result, 'Не удалось запустить операцию.');
			paintStatus({ state: 'running', message: 'Операция запущена…' });
			watchJob();
		}).catch((error) => ui.addNotification(null, E('p', {}, error.message), 'error'));
		const updateWanFields = () => root.querySelector('#pppoe-settings').hidden = selected('wan_type') !== 'pppoe';
		const updateWifiFields = () => root.querySelector('#ssid-5').disabled = selected('wifi_mode') === 'smart';
		const updateVpnInput = () => {
			selectedSource = selected('vpn_source') || 'subscription';
			urlInput.hidden = selectedSource !== 'subscription';
			configInput.hidden = selectedSource === 'subscription';
			sourceLabel.textContent = selectedSource === 'subscription' ? 'Ссылка подписки' :
				(selectedSource === 'awg' ? 'Вставьте AWG-конфигурацию целиком' : 'Вставьте одну или несколько proxy-ссылок');
			configInput.placeholder = selectedSource === 'awg' ? '[Interface]\nPrivateKey = …\n…' : 'vless://…';
		};
		const showVpnJob = (job) => {
			vpnJobNode.dataset.state = job.state || 'idle';
			vpnJobNode.textContent = job.message || job.state || 'Ожидание';
			importButton.disabled = job.state === 'running';
		};
		const watchVpnJob = () => callVpnJobStatus().then((job) => {
			showVpnJob(job);
			if (job.state === 'running')
				window.setTimeout(watchVpnJob, 2000);
		}).catch((error) => {
			showVpnJob({ state: 'failed', message: error.message });
			importButton.disabled = false;
		});
		root.addEventListener('change', (event) => {
			if (event.target.name === 'wan_type') updateWanFields();
			if (event.target.name === 'wifi_mode') updateWifiFields();
			if (event.target.name === 'vpn_source') updateVpnInput();
		});
		importButton.addEventListener('click', (event) => {
			event.preventDefault();
			const payload = (selectedSource === 'subscription' ? urlInput.value : configInput.value).trim();
			if (!payload) return showVpnJob({ state: 'failed', message: 'Введите данные подключения.' });
			showVpnJob({ state: 'running', message: 'Запускаем безопасный импорт…' });
			callStartVpnImport(selectedSource, payload).then((result) => {
				resultError(result, 'Не удалось запустить импорт.');
				urlInput.value = '';
				configInput.value = '';
				watchVpnJob();
			}).catch((error) => showVpnJob({ state: 'failed', message: error.message }));
		});

		root.querySelector('#apply-wifi').addEventListener('click', async () => {
			const mode = selected('wifi_mode'), ssid24 = value('#ssid-24'), ssid5 = mode === 'smart' ? ssid24 : value('#ssid-5');
			const password = rawValue('#wifi-password');
			if (!ssid24 || !ssid5) return ui.addNotification(null, E('p', {}, 'Введите имя Wi-Fi.'), 'warning');
			if (password && (password.length < 8 || password.length > 63)) return ui.addNotification(null, E('p', {}, 'Пароль Wi-Fi должен содержать от 8 до 63 символов.'), 'warning');
			if (password !== rawValue('#wifi-password-confirm')) return ui.addNotification(null, E('p', {}, 'Пароли Wi-Fi не совпадают.'), 'warning');
			if (!await confirmation('Изменить Wi-Fi?', 'Беспроводные устройства отключатся и должны будут подключиться заново.', 'Применить', false)) return;
			start(callApplyWifi(mode, ssid24, ssid5, password));
		});
		root.querySelector('#apply-wan').addEventListener('click', async () => {
			const type = selected('wan_type'), username = value('#pppoe-user'), password = rawValue('#pppoe-password');
			if (type === 'pppoe' && !username) return ui.addNotification(null, E('p', {}, 'Введите логин PPPoE.'), 'warning');
			if (!await confirmation('Изменить подключение?', 'Интернет кратковременно отключится. Предыдущую конфигурацию можно будет вернуть.', 'Применить', false)) return;
			start(callApplyWan(type, username, password));
		});
		root.querySelector('#rollback-wifi').addEventListener('click', async () => {
			if (await confirmation('Вернуть Wi-Fi?', 'Будет восстановлена конфигурация до последнего изменения через OUM.', 'Восстановить', false)) start(callRollback('wifi'));
		});
		root.querySelector('#rollback-wan').addEventListener('click', async () => {
			if (await confirmation('Вернуть подключение?', 'Будет восстановлена конфигурация до последнего изменения через OUM.', 'Восстановить', false)) start(callRollback('wan'));
		});
		root.querySelector('#create-backup').addEventListener('click', () => {
			setBusy(true);
			callCreateBackup().then((result) => {
				resultError(result, 'Не удалось создать резервную копию.');
				saveBase64(result.filename || 'oum-backup.oum', result.data);
				paintStatus({ state: 'success', message: 'Резервная копия скачана. Храните её в безопасном месте.' });
			}).catch((error) => ui.addNotification(null, E('p', {}, error.message), 'error')).finally(() => setBusy(false));
		});
		root.querySelector('#restore-backup').addEventListener('click', async () => {
			const file = root.querySelector('#restore-file').files[0];
			if (!file) return ui.addNotification(null, E('p', {}, 'Выберите файл .oum.'), 'warning');
			if (file.size > 4194304) return ui.addNotification(null, E('p', {}, 'Файл слишком велик.'), 'warning');
			if (!await confirmation('Восстановить копию?', 'Сеть, Wi-Fi, OUM и VPN будут заменены данными из файла. При ошибке текущие настройки сохранятся.', 'Восстановить', true)) return;
			start(file.text().then((content) => callRestoreBackup(content.trim())));
		});
		root.querySelector('#reset-vpn').addEventListener('click', async () => {
			if (await confirmation('Сбросить VPN?', 'OpenClash будет остановлен, а активный OUM-профиль и правила устройств удалены. Wi-Fi и интернет останутся настроенными.', 'Сбросить VPN', true)) start(callResetVpn());
		});
		root.querySelector('#reset-all').addEventListener('click', async () => {
			if (await confirmation('Вернуть первый запуск?', 'VPN будет удалён, появится временная сеть FirstRun и потребуется войти как admin/admin. Текущий LAN-адрес не меняется.', 'Вернуть мастер', true)) start(callResetFirstRun());
		});
		updateWanFields();
		updateWifiFields();
		updateVpnInput();
		if (initialJob.state === 'running') watchJob();
		if (initialVpnJob.state === 'running') watchVpnJob(); else showVpnJob(initialVpnJob);
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
