'use strict';
'require view';
'require rpc';
'require ui';

const callSettingsStatus = rpc.declare({ object: 'oum', method: 'settingsStatus', expect: { '': {} } });
const callSystemJobStatus = rpc.declare({ object: 'oum', method: 'systemJobStatus', expect: { '': {} } });
const callClearSystemJobStatus = rpc.declare({ object: 'oum', method: 'clearSystemJobStatus', params: [ 'action', 'code' ], expect: { '': {} } });
const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });
const callVpnJobStatus = rpc.declare({ object: 'oum', method: 'vpnJobStatus', expect: { '': {} } });
const callStartVpnImport = rpc.declare({
	object: 'oum', method: 'startVpnImport', params: [ 'vpn_type', 'payload' ], expect: { '': {} }
});
const callApplyWifi = rpc.declare({
	object: 'oum', method: 'applyWifiSettings', params: [ 'wifi_mode', 'ssid_24', 'ssid_5', 'wifi_password' ], expect: { '': {} }
});
const callSetWifiEnabled = rpc.declare({ object: 'oum', method: 'setWifiEnabled', params: [ 'enabled' ], expect: { '': {} } });
const callApplyWan = rpc.declare({
	object: 'oum', method: 'applyWanSettings', params: [ 'wan_type', 'pppoe_user', 'pppoe_password' ], expect: { '': {} }
});
const callApplyLan = rpc.declare({ object: 'oum', method: 'applyLanSettings', params: [ 'address' ], expect: { '': {} } });
const callApplyMesh = rpc.declare({ object: 'oum', method: 'applyMeshSettings', params: [ 'enabled', 'mesh_id', 'password', 'band' ], expect: { '': {} } });
const callInstallMeshRuntime = rpc.declare({ object: 'oum', method: 'installMeshRuntime', expect: { '': {} } });
const callScanWifi = rpc.declare({ object: 'oum', method: 'scanWifi', params: [ 'band' ], expect: { '': {} } });
const callSetWisp = rpc.declare({ object: 'oum', method: 'setWisp', params: [ 'enabled', 'ssid', 'password', 'band' ], expect: { '': {} } });
const callRollback = rpc.declare({ object: 'oum', method: 'rollbackSettings', params: [ 'kind' ], expect: { '': {} } });
const callSwitchEngine = rpc.declare({ object: 'oum', method: 'switchVpnEngine', params: [ 'engine' ], expect: { '': {} } });
const callSetEngineDnsPreferences = rpc.declare({ object: 'oum', method: 'setEngineDnsPreferences', params: [ 'engine', 'server', 'bootstrap' ], expect: { '': {} } });
const callRebootRouter = rpc.declare({ object: 'oum', method: 'rebootRouter', expect: { '': {} } });
const callConfigurePodkop = rpc.declare({ object: 'oum', method: 'configurePodkop', params: [ 'interface' ], expect: { '': {} } });
const callImportPodkopAwg = rpc.declare({ object: 'oum', method: 'importPodkopAwg', params: [ 'payload' ], expect: { '': {} } });
const callImportPodkopReality = rpc.declare({ object: 'oum', method: 'importPodkopReality', params: [ 'payload' ], expect: { '': {} } });
const callSetPodkopYoutubeMode = rpc.declare({ object: 'oum', method: 'setPodkopYoutubeMode', params: [ 'mode', 'strategy' ], expect: { '': {} } });
const callZapretStrategyStatus = rpc.declare({ object: 'oum', method: 'zapretStrategyStatus', expect: { '': {} } });
const callStartZapretStrategy = rpc.declare({ object: 'oum', method: 'startZapretStrategy', params: [ 'action', 'strategy' ], expect: { '': {} } });
const callCreateBackup = rpc.declare({ object: 'oum', method: 'createBackup', expect: { '': {} } });
const callRestoreBackup = rpc.declare({ object: 'oum', method: 'restoreBackup', params: [ 'data' ], expect: { '': {} } });
const callResetVpn = rpc.declare({ object: 'oum', method: 'resetVpn', expect: { '': {} } });
const callResetFirstRun = rpc.declare({ object: 'oum', method: 'resetFirstRun', expect: { '': {} } });
const callUpdateProject = rpc.declare({ object: 'oum', method: 'updateProject', expect: { '': {} } });
const callRollbackProject = rpc.declare({ object: 'oum', method: 'rollbackProject', expect: { '': {} } });

function choice(name, value, title, description, checked) {
	return E('label', { 'class': 'oum-setting-choice' }, [
		E('input', { type: 'radio', name, value, checked: checked ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

function sourceChoice(value, title, description, checked, disabled) {
	return E('label', { 'class': `oum-source-choice${disabled ? ' is-disabled' : ''}` }, [
		E('input', { type: 'radio', name: 'vpn_source', value, checked: checked ? '' : null, disabled: disabled ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

function engineChoice(value, title, description, checked, disabled) {
	return E('label', { 'class': `oum-engine-choice${disabled ? ' is-disabled' : ''}` }, [
		E('input', { type: 'radio', name: 'vpn_engine', value, checked: checked ? '' : null, disabled: disabled ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

function field(label, input) {
	return E('div', { 'class': 'oum-setting-field' }, [ E('label', {}, label), input ]);
}

function dnsSelect(id, value) {
	const options = [
		[ '77.88.8.8', 'Яндекс — 77.88.8.8' ],
		[ '77.88.8.1', 'Яндекс — 77.88.8.1' ],
		[ '1.1.1.1', 'Cloudflare — 1.1.1.1' ],
		[ '1.0.0.1', 'Cloudflare — 1.0.0.1' ],
		[ '8.8.8.8', 'Google — 8.8.8.8' ],
		[ '8.8.4.4', 'Google — 8.8.4.4' ],
		[ '9.9.9.9', 'Quad9 — 9.9.9.9' ],
		[ '149.112.112.112', 'Quad9 — 149.112.112.112' ]
	];
	return E('select', { id }, options.map(([ server, label ]) => E('option', { value: server, selected: value === server ? '' : null }, label)));
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
		return Promise.all([ callSettingsStatus(), callSystemJobStatus(), callStatus(), callVpnJobStatus(), callZapretStrategyStatus() ]);
	},

	render(data) {
		const settings = data[0];
		const initialJob = data[1];
		const status = data[2];
		const initialVpnJob = data[3];
		const zapret = data[4] || { available: false, running: false, strategies: [] };
		if (!status.setup_complete)
			return E('div', {}, [
				E('h2', {}, 'OUM'),
				E('p', {}, 'Сначала завершите первоначальную настройку роутера.'),
				E('a', { class: 'btn cbi-button-action', href: L.url('oum', 'setup') }, 'Открыть мастер')
			]);
		const wifi = settings.wifi || {};
		const wan = settings.wan || {};
		const lan = settings.lan || { address: '192.168.5.1', prefix: 24, rollback: false, rollback_address: '' };
		const mesh = settings.mesh || { enabled: false, id: '', band: '5g' };
		const wisp = settings.wisp || { enabled: false, connected: false, ssid: '', ip: '', signal: null, band: '2g', rollback: false };
		const project = settings.project || { version: 'development', rollback: false };
		const projectUpdatable = project.version && project.version !== 'development';
		const dns = settings.dns || {
			openclash: '1.1.1.1', bootstrap_openclash: '1.0.0.1',
			passwall: '1.1.1.1', bootstrap_passwall: '1.0.0.1',
			podkop: '77.88.8.8', bootstrap_podkop: '77.88.8.1'
		};
		const engines = settings.engines || { current: 'none', supported: false, passwall: {}, openclash: {}, podkop: {} };
		const unmanagedTunnels = settings.unmanaged_tunnels || [];
		const engineTitle = engines.current === 'passwall' ? 'PassWall' : (engines.current === 'podkop' ? 'Podkop + Zapret' : (engines.current === 'openclash' ? 'OpenClash' : 'не установлен'));
		const engineMissing = !engines.current || engines.current === 'none';
		const engineActionLabel = engineMissing ? 'Установить движок' : 'Заменить движок';
		const engineVersion = engines.current === 'passwall' ? engines.passwall.version : (engines.current === 'podkop' ? engines.podkop.version : engines.openclash.version);
		const activeDns = engineMissing ? null : {
			server: dns[engines.current],
			bootstrap: dns[`bootstrap_${engines.current}`],
			help: engines.current === 'openclash' ? 'Bootstrap записывается в default-nameserver профиля Mihomo.' :
				(engines.current === 'passwall' ? 'Bootstrap используется как прямой DNS для поиска удалённого DNS.' : 'Используется штатный параметр bootstrap_dns_server Podkop.')
		};
		const podkopInterfaces = Array.from(new Set([ engines.podkop?.interface || '', ...unmanagedTunnels.map((item) => item.name) ].filter(Boolean)));
		const youtubeMode = engines.podkop?.youtube_mode || 'zapret';
		const sourceSupported = engines.current === 'openclash' || engines.current === 'passwall';
		const sourceHelp = engines.current === 'openclash' ?
			'Новый источник полностью заменяет предыдущий OUM-профиль. При ошибке старый профиль восстанавливается.' :
			(engines.current === 'podkop' ?
				'Podkop использует отдельный сетевой туннель; выберите его в разделе VPN-движка выше.' :
				(engines.current === 'passwall' ?
					'PassWall принимает Subscription и Proxy через собственный парсер с резервной копией. AWG является отдельным туннелем и используется с Podkop + Zapret.' :
					'Сначала установите VPN-движок. После успешной установки здесь появятся подходящие способы подключения.'));
		const capabilities = settings.capabilities || {};
		const meshState = !capabilities.mesh_driver ? 'Режим 802.11s не поддерживается радиодрайвером.' :
			(capabilities.mesh_runtime ? 'Mesh поддерживается и программный компонент установлен.' :
				(capabilities.mesh_runtime_bundle ? 'Радиомодуль поддерживает Mesh. Совместимый компонент готов к установке.' : 'Радиомодуль поддерживает Mesh, но для этой прошивки нет проверенного комплекта.'));
		const meshReady = capabilities.mesh_driver === true && capabilities.mesh_runtime === true;
		const usbState = !capabilities.usb_host ? '' :
			[ capabilities.usb_storage ? 'накопитель' : '', capabilities.usb_network ? 'сетевое устройство' : '', capabilities.usb_modem ? 'модем' : '' ].filter(Boolean).join(', ') || 'USB-порт доступен, подключённых устройств нет.';
		let selectedSource = status.pending_source !== 'none' ? status.pending_source :
			(status.active_source !== 'none' ? status.active_source : 'subscription');
		if (engines.current === 'passwall' && selectedSource === 'awg') selectedSource = 'subscription';
		const root = E('div', { 'class': 'oum-settings' }, [
			E('style', {}, `
				.oum-settings{max-width:1000px;margin:0 auto}.oum-page-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-page-head h2{margin:0}.oum-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.oum-settings-panel{border:1px solid #ccd3dc;border-radius:12px;padding:18px;margin-bottom:16px}.oum-settings-panel h3{margin-top:0}
				.oum-setting-choices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.oum-setting-choice{display:flex;gap:9px;padding:12px;border:1px solid #ccd3dc;border-radius:9px;cursor:pointer}.oum-setting-choice:has(input:checked){border-color:#1677ff;background:rgba(22,119,255,.16)}.oum-setting-choice span{display:flex;flex-direction:column;gap:4px}.oum-setting-choice small,.oum-help{opacity:.7;line-height:1.45}.oum-source-choice.is-disabled{opacity:.5;cursor:not-allowed}
				.oum-setting-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oum-setting-field{margin:11px 0}.oum-setting-field label{display:block;font-weight:600;margin-bottom:6px}.oum-setting-field input,.oum-setting-field select{width:100%;min-height:42px;box-sizing:border-box}.oum-setting-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:13px}.oum-job-state{padding:11px 13px;border-radius:8px;background:rgba(127,127,127,.1);margin:0 0 16px}.oum-job-state[data-state="idle"]{display:none}.oum-job-state[data-state="failed"]{background:rgba(201,75,75,.16)}.oum-job-state[data-state="success"]{background:rgba(43,155,104,.16)}
				.oum-maintenance{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.oum-maintenance-card{border:1px solid #d8dde5;border-radius:10px;padding:14px;min-width:0}.oum-maintenance-card h4{margin:0 0 8px}.oum-maintenance-card button{margin-top:9px}.oum-danger{border-color:#e6b5b0}.oum-file{max-width:100%}
				.oum-capability-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.oum-capability{border:1px solid #d8dde5;border-radius:10px;padding:14px}.oum-capability h4{margin:0 0 8px}.oum-capability-state{line-height:1.45}.oum-network-extension{border-top:1px solid #d8dde5;margin-top:16px;padding-top:16px}.oum-network-extension h4{margin:0 0 7px}.oum-wisp-results{display:grid;gap:7px;margin:10px 0}.oum-wisp-result{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left}.oum-wisp-result span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.oum-wisp-status{padding:10px 12px;border-radius:8px;background:rgba(127,127,127,.1);margin:10px 0}
				.oum-engine-current{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px;border-radius:9px;background:rgba(127,127,127,.1);margin-bottom:14px}.oum-engine-current small{opacity:.7}.oum-engine-choices{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.oum-engine-choice{display:flex;gap:10px;border:1px solid #ccd3dc;border-radius:10px;padding:14px;cursor:pointer}.oum-engine-choice:has(input:checked){border-color:#1677ff;background:rgba(22,119,255,.16)}.oum-engine-choice span{display:flex;flex-direction:column;gap:5px}.oum-engine-choice small{opacity:.72;line-height:1.4}.oum-engine-choice.is-disabled{opacity:.55;cursor:not-allowed}.oum-engine-actions{display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap}
				.oum-dns-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.oum-dns-engine{min-width:0;border-top:1px solid #d8dde5;padding-top:12px}.oum-dns-engine h4{margin:0 0 4px}.oum-dns-engine .oum-setting-field{margin:10px 0}.oum-dns-engine .oum-help{display:block;overflow-wrap:anywhere}
				.oum-protected>summary{cursor:pointer;font-size:1.15rem;font-weight:600}.oum-protected[open]>summary{margin-bottom:14px}.oum-protected-content{border-top:1px solid #d8dde5;padding-top:14px}.oum-inline-warning{padding:11px 13px;border:1px solid #b28a29;background:rgba(178,138,41,.16);border-radius:9px;margin:12px 0;line-height:1.45}.oum-sources{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.oum-source-choice{display:flex;gap:10px;border:1px solid #ccd3dc;border-radius:10px;padding:14px;cursor:pointer}.oum-source-choice:has(input:checked){border-color:#1677ff;background:rgba(22,119,255,.16)}.oum-source-choice span{display:flex;flex-direction:column;gap:5px}.oum-source-choice small{opacity:.72;line-height:1.4}.oum-podkop-transports{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oum-transport-card{border:1px solid #ccd3dc;border-radius:11px;padding:14px}.oum-transport-card[data-active="true"]{border-color:#2b9b68}.oum-transport-card h4{margin:0 0 7px}.oum-transport-card textarea{width:100%;min-height:150px;font-family:monospace;box-sizing:border-box;margin:8px 0}
				.oum-vpn-input{margin:18px 0}.oum-vpn-input label{display:block;font-weight:600;margin-bottom:7px}.oum-vpn-input input,.oum-vpn-input textarea{width:100%;box-sizing:border-box}.oum-vpn-input textarea{min-height:180px;font-family:monospace}.oum-vpn-job{padding:12px;border-radius:8px;background:rgba(127,127,127,.1);margin:14px 0}.oum-vpn-job[data-state="failed"]{background:rgba(201,75,75,.16)}.oum-vpn-job[data-state="success"]{background:rgba(43,155,104,.16)}
				@media(max-width:760px){.oum-settings-grid,.oum-setting-fields,.oum-maintenance,.oum-sources,.oum-capability-grid,.oum-engine-choices,.oum-dns-grid,.oum-podkop-transports{grid-template-columns:1fr}.oum-setting-choices{grid-template-columns:1fr}}
			`),
			E('div', { 'class': 'oum-page-head' }, [
				E('h2', {}, 'Настройки OUM'),
				E('a', { 'class': 'btn cbi-button', href: L.url('oum', 'logout') }, 'Выйти')
			]),
			E('p', { 'class': 'oum-help' }, 'Пароли не показываются в браузере. Оставьте поле пароля пустым, чтобы сохранить действующий.'),
			E('div', { id: 'system-job', 'class': 'oum-job-state', role: 'status', 'aria-live': 'polite', 'data-state': initialJob.state || 'idle' }, initialJob.message || ''),
			E('div', { 'class': 'oum-inline-warning', id: 'reboot-required', hidden: settings.reboot_required ? null : '' }, [
				E('strong', {}, 'Рекомендуется перезагрузка'),
				E('p', {}, 'VPN-движок уже установлен. Перезагрузите роутер в удобный момент, чтобы заново поднять сетевые модули и правила.'),
				E('button', { 'class': 'btn cbi-button-action', id: 'reboot-router' }, 'Перезагрузить сейчас')
			]),
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
						E('button', { 'class': `btn ${wifi.enabled === false ? 'cbi-button-action' : 'cbi-button-negative'}`, id: 'toggle-wifi', 'data-system-action': '' }, wifi.enabled === false ? 'Включить Wi-Fi' : 'Отключить Wi-Fi'),
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
			E('details', { 'class': 'oum-settings-panel oum-protected' }, [
				E('summary', {}, 'Расширение сети'),
				E('div', { 'class': 'oum-protected-content' }, [
					E('h4', {}, 'Локальный адрес роутера'),
					E('p', { 'class': 'oum-help' }, 'Используется частная подсеть /24. Она не должна совпадать с WAN-подсетью вышестоящего роутера.'),
					E('div', { 'class': 'oum-setting-fields' }, [
						field('LAN IPv4', E('input', { id: 'lan-address', inputmode: 'decimal', maxlength: 15, value: lan.address || '192.168.5.1', placeholder: '192.168.5.1' })),
						field('Маска', E('input', { value: '/24 — 255.255.255.0', disabled: '' }))
					]),
					E('div', { 'class': 'oum-setting-actions' }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'apply-lan', 'data-system-action': '' }, 'Изменить LAN-адрес'),
						E('button', { 'class': 'btn', id: 'rollback-lan', 'data-system-action': '', disabled: lan.rollback ? null : '' }, lan.rollback_address ? `Вернуть ${lan.rollback_address}` : 'Вернуть предыдущий')
					]),
					...((capabilities.mesh_driver || capabilities.wisp_supported || capabilities.usb_host) ? [ E('div', { 'class': 'oum-capability-grid oum-network-extension' }, [
						...(capabilities.mesh_driver ? [ E('div', { 'class': 'oum-capability' }, [ E('h4', {}, 'Mesh'), E('div', { 'class': 'oum-capability-state' }, meshState) ]) ] : []),
						...(capabilities.wisp_supported ? [ E('div', { 'class': 'oum-capability' }, [ E('h4', {}, 'Wi-Fi как интернет'), E('div', { 'class': 'oum-capability-state' }, wisp.connected ? `Подключено к ${wisp.ssid}${wisp.ip ? ` · ${wisp.ip}` : ''}` : (wisp.enabled ? 'Подключение не установлено' : 'Выключено')) ]) ] : []),
						...(capabilities.usb_host ? [ E('div', { 'class': 'oum-capability' }, [ E('h4', {}, 'USB и 4G'), E('div', { 'class': 'oum-capability-state' }, usbState) ]) ] : [])
					]) ] : []),
					...(capabilities.mesh_driver ? [ E('section', { 'class': 'oum-network-extension' }, [
						E('h4', {}, 'Mesh между роутерами OUM'),
						E('p', { 'class': 'oum-help' }, meshReady ? 'Объединяет два или больше совместимых роутеров OUM в бесшовную сеть. На каждом узле укажите одинаковые Mesh ID и пароль; обычные точки Wi-Fi останутся включены.' : 'Для Mesh нужен совместимый wpad-mesh той же ревизии, что и hostapd-common.'),
						...(!meshReady && capabilities.mesh_runtime_bundle ? [ E('div', { 'class': 'oum-setting-actions' }, [
							E('button', { 'class': 'btn cbi-button-action', id: 'install-mesh-runtime', 'data-system-action': '' }, 'Установить поддержку Mesh'),
							E('span', { 'class': 'oum-help' }, 'Wi-Fi перезапустится на несколько секунд; при ошибке OUM вернёт исходный компонент.')
						]) ] : []),
						E('div', { 'class': 'oum-setting-fields' }, [
							field('Mesh ID', E('input', { id: 'mesh-id', maxlength: 32, value: mesh.id || '', placeholder: 'HomeMesh', disabled: meshReady ? null : '' })),
							field('Диапазон', E('select', { id: 'mesh-band', disabled: meshReady ? null : '' }, [
								E('option', { value: '5g', selected: mesh.band !== '2g' ? '' : null }, '5 ГГц — выше скорость'),
								E('option', { value: '2g', selected: mesh.band === '2g' ? '' : null }, '2,4 ГГц — больше дальность')
							])),
							field('Пароль Mesh', E('input', { id: 'mesh-password', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password', placeholder: mesh.enabled ? 'Введите заново для изменения' : 'Минимум 8 символов', disabled: meshReady ? null : '' }))
						]),
						E('div', { 'class': 'oum-setting-actions' }, [
							E('button', { 'class': 'btn cbi-button-action', id: 'enable-mesh', 'data-system-action': '', disabled: meshReady ? null : '' }, mesh.enabled ? 'Обновить Mesh' : 'Включить Mesh'),
							E('button', { 'class': 'btn', id: 'disable-mesh', 'data-system-action': '', disabled: mesh.enabled ? null : '' }, 'Отключить Mesh')
						])
					]) ] : []),
					...(capabilities.wisp_supported ? [ E('section', { 'class': 'oum-network-extension' }, [
						E('h4', {}, 'Интернет от другой Wi-Fi сети (WISP)'),
						E('p', { 'class': 'oum-help' }, 'Роутер подключится к обычной точке Wi-Fi как клиент, а ваши LAN и Wi-Fi останутся отдельной защищённой сетью. Кабельный WAN не удаляется.'),
						E('div', { id: 'wisp-status', 'class': 'oum-wisp-status' }, wisp.connected ? `Подключено: ${wisp.ssid}${wisp.ip ? ` · ${wisp.ip}` : ''}${wisp.signal != null ? ` · ${wisp.signal} dBm` : ''}` : (wisp.enabled ? 'Настройка включена, но соединения нет.' : 'WISP выключен.')),
						E('div', { 'class': 'oum-setting-fields' }, [
							field('Диапазон', E('select', { id: 'wisp-band' }, [
								E('option', { value: '2g', selected: wisp.band !== '5g' ? '' : null }, '2,4 ГГц'),
								E('option', { value: '5g', selected: wisp.band === '5g' ? '' : null }, '5 ГГц')
							])),
							field('Исходная сеть', E('input', { id: 'wisp-ssid', maxlength: 32, value: wisp.ssid || '', placeholder: 'Выберите после сканирования или введите имя' })),
							field('Пароль исходной сети', E('input', { id: 'wisp-password', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password', placeholder: wisp.enabled ? 'Введите для переподключения' : 'Для открытой сети оставьте пустым' }))
						]),
						E('div', { 'class': 'oum-setting-actions' }, [
							E('button', { 'class': 'btn', id: 'scan-wisp' }, 'Найти сети'),
							E('button', { 'class': 'btn cbi-button-action', id: 'enable-wisp', 'data-system-action': '' }, wisp.enabled ? 'Переподключить' : 'Подключить'),
							E('button', { 'class': 'btn', id: 'disable-wisp', 'data-system-action': '', disabled: wisp.enabled ? null : '' }, 'Отключить'),
							E('button', { 'class': 'btn', id: 'rollback-wisp', 'data-system-action': '', disabled: wisp.rollback ? null : '' }, 'Вернуть предыдущие')
						]),
						E('div', { id: 'wisp-results', 'class': 'oum-wisp-results', hidden: '' })
					]) ] : [])
				])
			]),
			E('details', { 'class': 'oum-settings-panel oum-protected', open: '' }, [
				E('summary', {}, 'VPN-движок'),
				E('div', { 'class': 'oum-protected-content' }, [
					E('div', { 'class': 'oum-engine-current' }, [
						E('span', {}, [ E('small', {}, 'Сейчас установлен'), E('br'), E('strong', {}, engineTitle) ]),
						E('span', { 'class': 'oum-help' }, engineVersion || '')
					]),
					E('div', { 'class': 'oum-inline-warning', hidden: unmanagedTunnels.length ? null : '' }, unmanagedTunnels.length ?
						`Найдены туннели вне OUM: ${unmanagedTunnels.map((item) => item.name).join(', ')}. Перед включением другого движка проверьте их маршруты.` : ''),
					E('div', { 'class': 'oum-engine-choices' }, [
						engineChoice('openclash', 'OpenClash', `Управляемый выпуск ${engines.openclash.target_version || ''}. Подписки, AWG и прокси.`, engines.current === 'openclash', false),
						engineChoice('passwall', 'PassWall', `Закреплённая версия ${engines.passwall.target_version || '26.5.11-r1'}. Тонкая маршрутизация через Xray.`, engines.current === 'passwall', false),
						engineChoice('podkop', 'Podkop + Zapret', `Podkop ${engines.podkop?.target_version || 'с AWG-туннелем'}. YouTube напрямую через Zapret.`, engines.current === 'podkop', false)
					]),
					E('p', { 'class': 'oum-help' }, `OUM временно остановит VPN и проверит прямой доступ к GitHub. Затем старый движок и его настройки будут полностью удалены, а выбранный движок установлен заново.${engines.passwall.cache_ready ? ' Локальный комплект PassWall готов.' : ''}`),
					E('div', { 'class': 'oum-engine-actions' }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'switch-engine', 'data-system-action': '', disabled: engines.supported ? null : '' }, engineActionLabel),
						E('span', { 'class': 'oum-help' }, engines.supported ? (engineMissing ? 'Выберите и установите движок для работы VPN.' : 'Настройки старого движка не переносятся.') : 'Для этой платформы нет проверенного пакета.')
					])
				])
			]),
			E('details', { 'class': 'oum-settings-panel oum-protected' }, [
					E('summary', {}, 'DNS для VPN'),
					E('div', { 'class': 'oum-protected-content' }, [
					E('p', { 'class': 'oum-help' }, engineMissing ? 'Выберите движок — настройки DNS появятся после установки.' : `DNS для активного движка (сейчас: ${engineTitle}). При смене движка его DNS останется сохранён отдельно.`),
					...(activeDns ? [ E('div', { 'class': 'oum-dns-grid' }, [
						E('section', { 'class': 'oum-dns-engine' }, [
							E('h4', {}, engineTitle),
							field('Основной DNS', dnsSelect('dns-current', activeDns.server)),
							field('Bootstrap DNS', dnsSelect('bootstrap-dns-current', activeDns.bootstrap)),
							E('small', { 'class': 'oum-help' }, activeDns.help)
						])
					]) ] : []),
						E('div', { 'class': 'oum-setting-actions' }, [
							E('button', { 'class': 'btn cbi-button-action', id: 'apply-engine-dns', 'data-system-action': '', disabled: engineMissing ? '' : null }, 'Применить DNS'),
							E('span', { 'class': 'oum-help' }, engineMissing ? 'Сначала установите VPN-движок.' : `${engineTitle} будет кратковременно перезапущен.`)
						])
					])
				]),
			E('details', {
				'class': 'oum-settings-panel oum-protected',
				open: status.pending_source !== 'none' && status.active_source === 'none' ? '' : null
			}, [
				E('summary', {}, 'Защищённое подключение'),
				E('div', { 'class': 'oum-protected-content' }, [
					E('div', { hidden: engines.current === 'podkop' ? null : '' }, [
						E('h4', {}, 'Подключение Podkop'),
						E('p', { 'class': 'oum-help' }, 'AWG и Reality взаимоисключающие: успешно проверенное новое подключение заменяет текущее.'),
						E('div', { 'class': 'oum-podkop-transports' }, [
							E('section', { 'class': 'oum-transport-card', 'data-active': engines.podkop?.transport !== 'reality' ? 'true' : 'false' }, [
								E('h4', {}, 'AWG-туннель'),
								E('p', { 'class': 'oum-help' }, 'DNS из файла игнорируется, маршрут по умолчанию не создаётся.'),
								E('textarea', { id: 'podkop-awg-config', autocomplete: 'off', spellcheck: 'false', placeholder: '[Interface]\nPrivateKey = …\nAddress = …\n…\n\n[Peer]\nPublicKey = …\nEndpoint = …' }),
								E('div', { 'class': 'oum-setting-actions' }, [
									E('button', { 'class': 'btn cbi-button-action', id: 'import-podkop-awg', 'data-system-action': '' }, 'Импортировать AWG'),
									E('select', { id: 'podkop-interface' }, podkopInterfaces.length ? podkopInterfaces.map((name) => E('option', { value: name, selected: name === engines.podkop?.interface ? '' : null }, name)) : E('option', { value: '' }, 'Туннель не найден')),
									E('button', { 'class': 'btn', id: 'configure-podkop', 'data-system-action': '', disabled: podkopInterfaces.length ? null : '' }, 'Использовать выбранный')
								])
							]),
							E('section', { 'class': 'oum-transport-card', 'data-active': engines.podkop?.transport === 'reality' ? 'true' : 'false' }, [
								E('h4', {}, 'Reality-прокси'),
								E('p', { 'class': 'oum-help' }, 'Одна полная VLESS Reality-ссылка. Секрет после сохранения не отображается.'),
								E('textarea', { id: 'podkop-reality-config', autocomplete: 'off', spellcheck: 'false', placeholder: 'vless://UUID@server:443?security=reality&pbk=…&fp=…&sni=…' }),
								E('button', { 'class': 'btn cbi-button-action', id: 'import-podkop-reality', 'data-system-action': '' }, 'Проверить и использовать Reality')
							])
						]),
						E('hr'),
						E('h4', {}, 'Маршрут YouTube'),
						E('p', { 'class': 'oum-help' }, 'YouTube может идти напрямую через Zapret без расхода VPN-трафика либо через текущее защищённое подключение.'),
						E('div', { 'class': 'oum-setting-choices' }, [
							choice('youtube_mode', 'zapret', 'Напрямую + Zapret', 'Экономит VPN-трафик; используется выбранная DPI-стратегия.', youtubeMode === 'zapret'),
							choice('youtube_mode', 'vpn', 'Через VPN', 'Zapret и его правила останавливаются; YouTube использует AWG или Reality.', youtubeMode === 'vpn')
						]),
						E('button', { 'class': 'btn cbi-button-action', id: 'apply-youtube-mode', 'data-system-action': '' }, 'Применить режим YouTube'),
						E('hr'),
						E('h4', {}, 'Стратегия Zapret'),
						E('p', { 'class': 'oum-help' }, `Закреплённый каталог содержит ${zapret.catalog_total || 27} стратегий. Можно выбрать стратегию вручную или запустить автоподбор. Рабочим считается результат не хуже 3 из 4 проверок.`),
						E('div', { 'class': 'oum-engine-current' }, [
							E('span', {}, [ E('small', {}, 'Текущая стратегия'), E('br'), E('strong', { id: 'zapret-current' }, zapret.current || 'не выбрана OUM') ]),
							E('span', { 'class': 'oum-help' }, zapret.last_total ? `Последняя проверка: ${zapret.last_ok}/${zapret.last_total} · ${zapret.last_elapsed_ms} мс` : (zapret.running ? 'Zapret работает' : 'Сначала настройте AWG и запустите Podkop'))
						]),
						E('div', { 'class': 'oum-setting-actions' }, [
							E('select', { id: 'zapret-strategy' }, (zapret.strategies || []).map((item) => E('option', { value: item.id, selected: item.id === zapret.current ? '' : null }, item.label))),
							E('button', { 'class': 'btn', id: 'zapret-apply', 'data-system-action': '' }, youtubeMode === 'vpn' ? 'Включить с выбранной' : 'Применить выбранную'),
							E('button', { 'class': 'btn cbi-button-action', id: 'zapret-auto', 'data-system-action': '' }, youtubeMode === 'vpn' ? 'Подобрать и включить' : 'Подобрать автоматически'),
							E('button', { 'class': 'btn', id: 'zapret-check', 'data-system-action': '', disabled: youtubeMode === 'zapret' && zapret.running ? null : '' }, 'Проверить текущую'),
							E('button', { 'class': 'btn', id: 'zapret-restore', 'data-system-action': '', disabled: youtubeMode === 'zapret' && zapret.rollback ? null : '' }, 'Вернуть предыдущую')
						]),
						E('p', { 'class': 'oum-help', id: 'zapret-status' }, initialJob.action?.startsWith('zapret_') ? initialJob.message : (youtubeMode === 'vpn' ? 'Zapret сейчас остановлен. Ручной выбор или автоподбор одновременно переключит YouTube на прямое подключение.' : 'Во время автоподбора YouTube-соединения будут кратковременно перезапускаться.'))
					]),
					E('div', { hidden: sourceSupported ? null : '' }, [
						E('p', { 'class': 'oum-help' }, sourceHelp),
						E('div', { 'class': 'oum-sources' }, [
							sourceChoice('subscription', 'Subscription', 'Ссылка на набор серверов', selectedSource === 'subscription', false),
							...(engines.current === 'openclash' ? [ sourceChoice('awg', 'AWG Tunnel', 'Конфигурация AmneziaWG', selectedSource === 'awg', false) ] : []),
							sourceChoice('proxy', 'Reality / Proxy', 'VLESS Reality, Hysteria2 и другие ссылки', selectedSource === 'proxy', false)
						]),
						E('div', { 'class': 'oum-vpn-input' }, [
							E('label', { id: 'source-label' }, ''),
							E('input', { id: 'subscription-input', type: 'url', autocomplete: 'off', spellcheck: 'false' }),
							E('textarea', { id: 'config-input', autocomplete: 'off', spellcheck: 'false', hidden: '' })
						]),
						E('div', { 'class': 'oum-vpn-job', id: 'vpn-job-status', 'data-state': initialVpnJob.state || 'idle' }, initialVpnJob.message || 'Готово к добавлению подключения.'),
						E('button', { 'class': 'btn cbi-button-action', id: 'import-source' }, 'Проверить и активировать')
					])
				])
			]),
			E('section', { 'class': 'oum-settings-panel' }, [
				E('h3', {}, 'Обслуживание OUM'),
				E('div', { 'class': 'oum-maintenance' }, [
					E('div', { 'class': 'oum-maintenance-card' }, [
						E('h4', {}, 'Обновление проекта'),
						E('p', { 'class': 'oum-help' }, projectUpdatable ?
							`Установлена версия ${project.version}. Перед обновлением OUM автоматически сохраняет предыдущую версию интерфейса и служб.` :
							'Установлена локальная версия для разработки. Онлайн-обновление станет доступно после установки опубликованной сборки.'),
						E('div', { 'class': 'oum-setting-actions' }, [
							E('button', { 'class': 'btn cbi-button-action', id: 'update-project', disabled: projectUpdatable ? null : '', 'data-system-action': '' }, 'Проверить и обновить'),
							E('button', { 'class': 'btn', id: 'rollback-project', disabled: project.rollback ? null : '', 'data-system-action': '' }, 'Откатить версию')
						])
					]),
					E('div', { 'class': 'oum-maintenance-card' }, [
						E('h4', {}, 'Резервная копия'),
					E('p', { 'class': 'oum-help' }, `Сохраняет сеть, Wi-Fi, OUM и конфигурацию текущего движка ${engineTitle}. Файл содержит секреты и не зашифрован.`),
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
		const engineButton = root.querySelector('#switch-engine');
		let watching = false;
		let pendingEngineTitle = '';

		const setBusy = (busy) => root.querySelectorAll('[data-system-action]').forEach((button) => {
			if (busy && button.dataset.wasDisabled == null)
				button.dataset.wasDisabled = button.disabled ? '1' : '0';
			button.disabled = busy ? true : button.dataset.wasDisabled === '1';
			if (!busy)
				delete button.dataset.wasDisabled;
		});
		const paintStatus = (status) => {
			statusNode.dataset.state = status.state || 'idle';
			statusNode.textContent = status.message || '';
		};
		const acknowledgeStatus = (status) => callClearSystemJobStatus(status.action || '', status.code || '')
			.then((result) => result?.ok === true ? true : false)
			.catch(() => false);
		const rebootNow = () => {
			ui.showModal('Перезагрузка роутера', [ E('p', {}, 'Соединение прервётся примерно на минуту. Подождите и снова откройте панель OUM.') ]);
			callRebootRouter().catch((error) => ui.addNotification(null, E('p', {}, error.message), 'error'));
		};
		const showEngineJob = (status) => {
			const title = status.state === 'running' ? `${engineMissing ? 'Установка' : 'Смена'}: ${pendingEngineTitle || 'VPN-движок'}` :
				(status.state === 'success' ? 'VPN-движок установлен' : 'Не удалось установить VPN-движок');
			const progress = status.total > 0 ? E('progress', { max: status.total, value: status.progress || 0 }) : E('progress', {});
			const actions = status.state === 'running' ? [
				E('button', { 'class': 'btn', disabled: '' }, 'Операция выполняется…')
			] : (status.state === 'success' ? [
				E('button', { 'class': 'btn', click: () => acknowledgeStatus(status).finally(() => { ui.hideModal(); window.location.reload(); }) }, 'Позже'),
				' ',
				E('button', { 'class': 'btn cbi-button-action important', click: rebootNow }, 'Перезагрузить сейчас')
			] : [
				E('button', { 'class': 'btn cbi-button-action important', click: () => { ui.hideModal(); acknowledgeStatus(status); } }, 'Закрыть')
			]);
			ui.showModal(title, [
				E('p', {}, status.message || 'Подготавливаем операцию…'),
				progress,
				E('p', { 'class': 'oum-help' }, status.code ? `Этап: ${status.code}` : 'Ожидаем статус…'),
				E('div', { 'class': 'right' }, actions)
			]);
		};
		const watchJob = () => {
			if (watching) return;
			watching = true;
			setBusy(true);
			const tick = () => callSystemJobStatus().then((status) => {
				paintStatus(status);
				if (status.action === 'engine') showEngineJob(status);
				if (status.state === 'running') return window.setTimeout(tick, 1500);
				watching = false;
				setBusy(false);
				const zapretStatus = root.querySelector('#zapret-status');
				if (zapretStatus && status.action?.startsWith('zapret_'))
					zapretStatus.textContent = status.message || 'Операция Zapret выполняется…';
				if (status.action === 'engine') return;
				if ((status.action === 'wifi_toggle' || status.action === 'dns' || status.action === 'adguard' || status.action === 'mesh' || status.action === 'mesh_runtime' || status.action === 'wisp' || status.action === 'rollback_wisp' || status.action === 'project_update' || status.action === 'project_rollback' || status.action === 'podkop_configure' || status.action === 'podkop_awg' || status.action === 'podkop_proxy' || status.action === 'podkop_youtube' || status.action?.startsWith('zapret_')) && status.state === 'success')
					acknowledgeStatus(status).finally(() => window.setTimeout(() => window.location.reload(), 900));
			}).catch(() => window.setTimeout(tick, 2000));
			tick();
		};
		const start = (promise) => promise.then((result) => {
			resultError(result, 'Не удалось запустить операцию.');
			paintStatus({ state: 'running', message: 'Операция запущена…' });
			watchJob();
		}).catch((error) => {
			if (pendingEngineTitle)
				showEngineJob({ state: 'failed', code: 'start_failed', message: error.message });
			else
				ui.addNotification(null, E('p', {}, error.message), 'error');
		});
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
		root.querySelector('#reboot-router').addEventListener('click', rebootNow);
		engineButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const target = selected('vpn_engine');
			if (!target || target === engines.current) return ui.addNotification(null, E('p', {}, 'Выберите другой VPN-движок.'), 'warning');
			const title = target === 'passwall' ? 'PassWall' : (target === 'podkop' ? 'Podkop + Zapret' : 'OpenClash');
			const text = engineMissing ? `${title} будет установлен с чистой конфигурацией и останется выключенным до добавления подключения.` : `Старый VPN-движок и его настройки будут полностью удалены. ${title} установится с чистой конфигурацией и останется выключенным до добавления подключения.`;
			if (await confirmation(engineMissing ? `Установить ${title}?` : `Перейти на ${title}?`, text, engineActionLabel, true)) {
				pendingEngineTitle = title;
				showEngineJob({ state: 'running', code: 'queued', message: 'Запускаем установку…' });
				start(callSwitchEngine(target));
			}
		});
		root.querySelector('#apply-engine-dns').addEventListener('click', async (event) => {
			event.preventDefault();
			if (engines.current === 'none') return ui.addNotification(null, E('p', {}, 'Сначала установите VPN-движок.'), 'warning');
			const activeServer = value('#dns-current');
			const activeBootstrap = value('#bootstrap-dns-current');
			if (await confirmation('Изменить DNS?', `Для ${engineTitle} сейчас будут применены основной DNS ${activeServer} и Bootstrap DNS ${activeBootstrap}; VPN кратковременно перезапустится.`, 'Применить', false))
				start(callSetEngineDnsPreferences(engines.current, activeServer, activeBootstrap));
		});
		root.querySelector('#apply-lan').addEventListener('click', async (event) => {
			event.preventDefault();
			const address = value('#lan-address');
			if (!await confirmation('Изменить LAN-адрес?', `Через несколько секунд панель станет доступна по адресу http://${address}/. Текущее соединение с роутером прервётся.`, 'Изменить адрес', true)) return;
			setBusy(true);
			callApplyLan(address).then((result) => {
				resultError(result, 'Не удалось запустить смену LAN-адреса.');
				ui.showModal('Переподключитесь к роутеру', [
					E('p', {}, `LAN изменяется на ${address}/24. Подождите около 10 секунд и получите новый адрес по DHCP.`),
					E('a', { 'class': 'btn cbi-button-action', href: `http://${address}/cgi-bin/luci/oum` }, `Открыть ${address}`)
				]);
			}).catch((error) => {
				setBusy(false);
				ui.addNotification(null, E('p', {}, error.message), 'error');
			});
		});
		root.querySelector('#rollback-lan').addEventListener('click', async (event) => {
			event.preventDefault();
			const previous = lan.rollback_address || 'предыдущему адресу';
			if (!await confirmation('Вернуть LAN-адрес?', `Текущее соединение прервётся. После перезапуска сети откройте роутер по адресу ${previous}.`, 'Восстановить', true)) return;
			setBusy(true);
			callRollback('lan').then((result) => {
				resultError(result, 'Не удалось запустить восстановление LAN-адреса.');
				ui.showModal('LAN восстанавливается', [ E('p', {}, `Подождите около 10 секунд и откройте роутер по адресу ${previous}.`) ]);
			}).catch((error) => {
				setBusy(false);
				ui.addNotification(null, E('p', {}, error.message), 'error');
			});
		});
		const enableMeshButton = root.querySelector('#enable-mesh');
		if (enableMeshButton) enableMeshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const meshId = value('#mesh-id');
			const password = value('#mesh-password');
			const band = value('#mesh-band');
			if (!meshId || password.length < 8) return ui.addNotification(null, E('p', {}, 'Введите имя Mesh и пароль минимум из 8 символов.'), 'warning');
			if (await confirmation('Включить Mesh?', `Будет создан отдельный Mesh ${meshId} в диапазоне ${band === '5g' ? '5 ГГц' : '2,4 ГГц'}. Точки доступа останутся включены.`, mesh.enabled ? 'Обновить' : 'Включить', false))
				start(callApplyMesh(1, meshId, password, band));
		});
		const meshRuntimeButton = root.querySelector('#install-mesh-runtime');
		if (meshRuntimeButton) meshRuntimeButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (await confirmation('Установить поддержку Mesh?', 'Обычные точки Wi-Fi будут недоступны несколько секунд. OUM проверит версию и контрольные суммы; при ошибке выполнит откат.', 'Установить', false))
				start(callInstallMeshRuntime());
		});
		const disableMeshButton = root.querySelector('#disable-mesh');
		if (disableMeshButton) disableMeshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (await confirmation('Отключить Mesh?', 'Будет удалён только управляемый интерфейс OUM Mesh. Обычный Wi-Fi останется включён.', 'Отключить', true))
				start(callApplyMesh(0, '', '', mesh.band || '5g'));
		});
		const wispResults = root.querySelector('#wisp-results');
		const scanWispButton = root.querySelector('#scan-wisp');
		if (scanWispButton) scanWispButton.addEventListener('click', (event) => {
			event.preventDefault();
			const band = value('#wisp-band');
			scanWispButton.disabled = true;
			scanWispButton.textContent = 'Ищем…';
			callScanWifi(band).then((result) => {
				resultError(result, 'Не удалось найти Wi-Fi сети.');
				const networks = result.networks || [];
				wispResults.hidden = false;
				wispResults.replaceChildren(...(networks.length ? networks.map((network) => E('button', {
					type: 'button',
					'class': 'btn oum-wisp-result',
					click: () => {
						root.querySelector('#wisp-ssid').value = network.ssid;
						wispResults.hidden = true;
					}
				}, [ E('span', {}, network.ssid), E('small', {}, `${network.signal} dBm · ${network.encryption}`) ])) : [ E('p', { 'class': 'oum-help' }, 'Сети не найдены. Можно ввести имя вручную.') ]));
			}).catch((error) => ui.addNotification(null, E('p', {}, error.message), 'error')).finally(() => {
				scanWispButton.disabled = false;
				scanWispButton.textContent = 'Найти сети';
			});
		});
		const enableWispButton = root.querySelector('#enable-wisp');
		if (enableWispButton) enableWispButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const ssid = rawValue('#wisp-ssid').trim();
			const password = rawValue('#wisp-password');
			const band = value('#wisp-band');
			if (!ssid) return ui.addNotification(null, E('p', {}, 'Выберите или введите исходную Wi-Fi сеть.'), 'warning');
			if (password && (password.length < 8 || password.length > 63)) return ui.addNotification(null, E('p', {}, 'Пароль должен содержать от 8 до 63 символов.'), 'warning');
			const conflict = mesh.enabled && mesh.band === band ? ' Mesh использует тот же диапазон; скорость и устойчивость могут снизиться.' : '';
			if (await confirmation('Подключить интернет по Wi-Fi?', `Роутер подключится к «${ssid}» и проверит получение интернета.${conflict} При ошибке прежняя сеть восстановится.`, wisp.enabled ? 'Переподключить' : 'Подключить', false))
				start(callSetWisp(true, ssid, password, band));
		});
		const disableWispButton = root.querySelector('#disable-wisp');
		if (disableWispButton) disableWispButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (await confirmation('Отключить интернет по Wi-Fi?', 'Управляемое WISP-подключение будет удалено; кабельный WAN останется без изменений.', 'Отключить', true))
				start(callSetWisp(false, '', '', wisp.band || '2g'));
		});
		const rollbackWispButton = root.querySelector('#rollback-wisp');
		if (rollbackWispButton) rollbackWispButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (await confirmation('Вернуть настройки WISP?', 'Будут восстановлены сеть, Wi-Fi и firewall до последнего изменения WISP.', 'Восстановить', true))
				start(callRollback('wisp'));
		});
		const podkopButton = root.querySelector('#configure-podkop');
		if (podkopButton) podkopButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const iface = root.querySelector('#podkop-interface')?.value || '';
			if (!iface) return ui.addNotification(null, E('p', {}, 'Не найден отдельный AWG/WireGuard-интерфейс.'), 'warning');
			if (await confirmation('Запустить Podkop + Zapret?', `Трафик Russia inside пойдёт через ${iface}, а YouTube — напрямую через Zapret.`, 'Настроить', false))
				start(callConfigurePodkop(iface));
		});
		const podkopAwgButton = root.querySelector('#import-podkop-awg');
		if (podkopAwgButton) podkopAwgButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const payload = root.querySelector('#podkop-awg-config')?.value.trim() || '';
			if (!/^\s*\[Interface\]\s*$/mi.test(payload) || !/^\s*\[Peer\]\s*$/mi.test(payload))
				return ui.addNotification(null, E('p', {}, 'Вставьте полный AWG-конфиг с секциями [Interface] и [Peer].'), 'warning');
			if (await confirmation('Импортировать AWG?', 'OUM проверит пакеты и конфигурацию, создаст отдельный интерфейс oum_awg и запустит Podkop. При ошибке сеть будет восстановлена.', 'Импортировать', false))
				start(callImportPodkopAwg(payload));
		});
		const podkopRealityButton = root.querySelector('#import-podkop-reality');
		if (podkopRealityButton) podkopRealityButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const payload = root.querySelector('#podkop-reality-config')?.value.trim() || '';
			if (!/^vless:\/\/\S+$/i.test(payload) || !/[?&]security=reality(?:&|$)/i.test(payload))
				return ui.addNotification(null, E('p', {}, 'Вставьте одну полную VLESS Reality-ссылку.'), 'warning');
			if (await confirmation('Переключиться на Reality?', 'OUM проверит ссылку и реальный выход через прокси. AWG будет отключён только после успешной проверки.', 'Проверить Reality', false))
				start(callImportPodkopReality(payload));
		});
		const runZapret = async (action) => {
			const strategy = root.querySelector('#zapret-strategy')?.value || '';
			if (youtubeMode === 'vpn' && (action === 'apply' || action === 'auto')) {
				const manual = action === 'apply';
				const text = manual ?
					`YouTube будет переключён напрямую, затем OUM применит и проверит стратегию ${strategy}. Рабочим считается результат 3/4 или лучше.` :
					'YouTube будет переключён напрямую, после чего OUM проверит текущую стратегию и при необходимости выполнит полный автоподбор.';
				if (await confirmation('Включить Zapret?', text, manual ? 'Применить' : 'Начать подбор', false))
					start(callSetPodkopYoutubeMode('zapret', manual ? strategy : ''));
				return;
			}
			const descriptions = {
				auto: 'OUM последовательно проверит 27 стратегий. Это займёт несколько минут и временно перезапустит YouTube-соединения.',
				apply: `Стратегия ${strategy} будет применена и проверена. При ошибке вернётся предыдущая.`,
				check: 'Будет проверена текущая стратегия без изменения конфигурации.',
				restore: 'Будет восстановлена конфигурация Zapret до последнего выбора через OUM.'
			};
			if (await confirmation('Настроить Zapret?', descriptions[action], action === 'auto' ? 'Начать подбор' : 'Продолжить', action === 'restore'))
				start(callStartZapretStrategy(action, strategy));
		};
		const youtubeModeButton = root.querySelector('#apply-youtube-mode');
		if (youtubeModeButton) youtubeModeButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const mode = selected('youtube_mode') || 'zapret';
			if (mode === youtubeMode) return ui.addNotification(null, E('p', {}, 'Этот режим YouTube уже используется.'), 'warning');
			const text = mode === 'vpn' ?
				'YouTube будет направлен через текущее защищённое подключение. Zapret остановится, автозапуск и nftables-правила будут отключены.' :
				'YouTube будет исключён из VPN. OUM запустит последнюю стратегию Zapret и проверит прямой доступ.';
			if (await confirmation('Изменить маршрут YouTube?', text, 'Переключить', false))
				start(callSetPodkopYoutubeMode(mode, ''));
		});
		for (const action of [ 'auto', 'apply', 'check', 'restore' ]) {
			const button = root.querySelector(`#zapret-${action}`);
			if (button) button.addEventListener('click', (event) => { event.preventDefault(); runZapret(action); });
		}
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
		root.querySelector('#toggle-wifi').addEventListener('click', async (event) => {
			event.preventDefault();
			const enable = wifi.enabled === false;
			if (enable) {
				if (await confirmation('Включить Wi-Fi?', 'Будут включены точки доступа, которые работали до отключения.', 'Включить', false)) start(callSetWifiEnabled(true));
				return;
			}
			if (await confirmation('Отключить Wi-Fi?', 'Отключение Wi-Fi оборвёт беспроводное подключение. Для восстановления понадобится проводное подключение к LAN-порту роутера (кабель). Продолжить?', 'Отключить', true))
				start(callSetWifiEnabled(false));
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
		root.querySelector('#update-project').addEventListener('click', async () => {
			if (await confirmation('Обновить OUM?', 'Будет загружена и проверена текущая закреплённая версия проекта. Перед установкой OUM сохранит локальный снимок для отката. Сеть и VPN не перенастраиваются.', 'Обновить', false))
				start(callUpdateProject());
		});
		root.querySelector('#rollback-project').addEventListener('click', async () => {
			if (await confirmation('Откатить OUM?', 'Интерфейс и системные службы OUM вернутся к версии, сохранённой перед последним обновлением. Настройки сети и VPN останутся на месте.', 'Откатить версию', true))
				start(callRollbackProject());
		});
		root.querySelector('#reset-vpn').addEventListener('click', async () => {
			const text = engines.current === 'passwall' ?
				'PassWall будет остановлен, правила устройств OUM удалены, а конфигурация нод сохранена в защищённом снимке. Wi-Fi и WAN не изменятся.' :
				(engines.current === 'podkop' ?
					'Podkop и Zapret будут остановлены, правила устройств OUM удалены, а их конфигурация сохранена в защищённом снимке. AWG, Wi-Fi и WAN не изменятся.' :
					'OpenClash будет остановлен, а активный OUM-профиль и правила устройств удалены. Wi-Fi и WAN не изменятся.');
			if (await confirmation('Сбросить VPN?', text, 'Сбросить VPN', true)) start(callResetVpn());
		});
		root.querySelector('#reset-all').addEventListener('click', async () => {
			if (await confirmation('Вернуть первый запуск?', 'VPN будет удалён, появится временная сеть FirstRun и потребуется войти как admin/admin. Текущий LAN-адрес не меняется.', 'Вернуть мастер', true)) start(callResetFirstRun());
		});
		updateWanFields();
		updateWifiFields();
		updateVpnInput();
		if (initialJob.state === 'running') watchJob();
		else if (initialJob.action === 'engine' && initialJob.state !== 'idle') showEngineJob(initialJob);
		else if (initialJob.state === 'success')
			window.setTimeout(() => acknowledgeStatus(initialJob).then((cleared) => { if (cleared) paintStatus({ state: 'idle', message: '' }); }), 5000);
		if (initialVpnJob.state === 'running') watchVpnJob(); else showVpnJob(initialVpnJob);
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
