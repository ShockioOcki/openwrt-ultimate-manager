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
const callUpdateEngine = rpc.declare({ object: 'oum', method: 'updateVpnEngine', params: [ 'engine' ], expect: { '': {} } });
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

function appSidebar(active) {
	const item = (key, label, path) => E('a', { 'class': `oum-nav-item${active === key ? ' is-active' : ''}`, href: L.url('oum', path) }, label);
	return E('aside', { 'class': 'oum-sidebar', 'aria-label': 'Навигация OUM' }, [
		E('div', { 'class': 'oum-brand' }, [ E('span', { 'class': 'oum-brand-mark', 'aria-hidden': 'true' }, 'O'), E('span', {}, [ E('strong', {}, 'OUM'), E('small', {}, 'Домашний щит') ]) ]),
		E('div', { 'class': 'oum-nav-caption' }, 'Меню'),
		E('nav', { 'class': 'oum-nav' }, [ item('dashboard', 'Панель', 'dashboard'), item('parental', 'Родительский контроль', 'parental'), item('settings', 'Настройки', 'settings'), item('help', 'Помощь', 'help') ])
	]);
}

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

function engineChoice(value, title, description, checked, disabled, pill, note) {
	return E('label', { 'class': 'oum-engine-choice' }, [
		E('input', { type: 'radio', name: 'vpn_engine', value, checked: checked ? '' : null, disabled: disabled ? '' : null }),
		E('span', {}, [
			E('span', { 'class': 'oum-engine-top' }, [ E('strong', {}, title), ...(pill ? [E('code', { 'class': 'oum-ver' }, pill)] : []) ]),
			E('small', {}, description),
			...(note ? [E('small', { 'class': 'oum-upstream-note' }, note)] : [])
		])
	]);
}

function field(label, input) {
	return E('div', { 'class': 'oum-setting-field' }, [ E('label', {}, label), input ]);
}

function vpnSvg(inner) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('aria-hidden', 'true');
	svg.innerHTML = inner;
	return svg;
}

const svgVpnRepeat = '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>';
const svgVpnGlobe = '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';
const svgVpnShield = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
const svgVpnRefresh = '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>';

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
		let settled = false;
		const cancel = () => { if (settled) return; settled = true; ui.hideModal(); resolve(false); };
		const modal = ui.showModal(title, [
			E('p', {}, text),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', click: cancel }, 'Отмена'),
				' ',
				E('button', {
					'class': danger ? 'btn cbi-button-negative important' : 'btn cbi-button-action important',
					click: () => { if (settled) return; settled = true; ui.hideModal(); resolve(true); }
				}, actionLabel)
			])
		]) || document.querySelector('#modal_overlay .modal');
		if (modal && window.innerWidth <= 900) {
			let sy = 0, cy = 0, drag = false;
			modal.addEventListener('touchstart', (event) => {
				if (event.touches.length !== 1) return;
				sy = event.touches[0].clientY;
				drag = true;
				modal.style.transition = 'none';
			}, { passive: true });
			modal.addEventListener('touchmove', (event) => {
				if (!drag || event.touches.length !== 1) return;
				cy = event.touches[0].clientY - sy;
				if (cy > 0) modal.style.transform = `translateY(${cy}px)`;
			}, { passive: true });
			modal.addEventListener('touchend', () => {
				drag = false;
				modal.style.transition = 'transform .2s';
				if (cy > 90) cancel();
				else modal.style.transform = '';
				cy = 0;
			});
		}
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
		const ups = engines.upstream || {};
		const upstreamNote = (name, label) => {
			if (ups[`${name}_newer`] !== '1' || !ups[`${name}_latest`]) return '';
			return `На GitHub вышла ${label} ${ups[`${name}_latest`]} — OUM ставит проверенную ${ups[`${name}_pinned`] || 'версию'}.`;
		};
		const enginePill = (name) => {
			if (name === 'openclash') return ups.openclash_pinned || (engines.openclash.target_version || '').replace(/^controlled-/, '');
			if (name === 'passwall') return engines.passwall.target_version || '';
			if (name === 'podkop') {
				if (ups.podkop_pinned) return ups.zapret_pinned ? `${ups.podkop_pinned} · Zapret ${ups.zapret_pinned}` : ups.podkop_pinned;
				return (engines.podkop.target_version || '').replace(' + ', ' · ');
			}
			return '';
		};
		const unmanagedTunnels = settings.unmanaged_tunnels || [];
		const activeUnmanagedTunnels = unmanagedTunnels.filter((item) => item.up === true);
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
		const initialVpnTab = status.pending_source !== 'none' && status.active_source === 'none' ? 'connection' : 'engine';
		const page = E('main', { 'class': 'oum-main' }, [
			E('link', { rel: 'stylesheet', href: `${L.resource('oum/oum.css')}?v=20260905-quickping84` }),
			E('div', { 'class': 'oum-page-head' }, [
				E('div', {}, [ E('h2', {}, 'Настройки OUM'), E('p', { 'class': 'oum-muted' }, 'Сеть, Wi‑Fi и защищённое подключение') ])
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
				E('div', { 'class': 'oum-apple-segment oum-wifi-mode-segment', style: 'background:#f1f5f9;padding:3px;border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0 0 8px;' }, [
					E('input', { type: 'radio', name: 'wifi_mode', value: 'smart', checked: wifi.mode !== 'separate' ? '' : null, style: 'display:none' }),
					E('input', { type: 'radio', name: 'wifi_mode', value: 'separate', checked: wifi.mode === 'separate' ? '' : null, style: 'display:none' }),
					E('button', { type: 'button', 'class': 'oum-apple-seg' + (wifi.mode !== 'separate' ? ' is-active' : ''), 'data-wifi-mode-btn': 'smart' }, 'Одна сеть'),
					E('button', { type: 'button', 'class': 'oum-apple-seg' + (wifi.mode === 'separate' ? ' is-active' : ''), 'data-wifi-mode-btn': 'separate' }, 'Две сети')
				]),
					E('div', { 'class': 'oum-setting-fields', id: 'ssid-single-wrap', hidden: wifi.mode === 'separate' ? '' : null }, [
						field('Имя сети', E('input', { id: 'ssid-single', maxlength: 32, value: wifi.ssid_24 || '' }))
					]),
					E('div', { 'class': 'oum-setting-fields', id: 'ssid-split-wrap', hidden: wifi.mode === 'separate' ? null : '' }, [
						field('Имя сети', E('input', { id: 'ssid-base', maxlength: 28, value: (wifi.ssid_24 || '').replace(/_(2G|5G)$/i, '') })),
						E('p', { 'class': 'oum-help', id: 'ssid-split-preview' }, '')
					]),
					field('Новый пароль', E('input', { id: 'wifi-password', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password', placeholder: wifi.password_set ? 'Не изменять' : 'От 8 до 63 символов' })),
					field('Повторите новый пароль', E('input', { id: 'wifi-password-confirm', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password' })),
					E('div', { 'class': 'oum-setting-actions' }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'apply-wifi', 'data-system-action': '' }, 'Применить Wi-Fi'),
						E('button', { 'class': `btn ${wifi.enabled === false ? 'cbi-button-action' : 'cbi-button-negative'}`, id: 'toggle-wifi', 'data-system-action': '' }, wifi.enabled === false ? 'Включить Wi-Fi' : 'Отключить Wi-Fi'),
						E('button', { 'class': 'btn', id: 'rollback-wifi', disabled: settings.rollback_wifi ? null : '', 'data-system-action': '' }, 'Вернуть предыдущие')
					])
				]),
				E('section', { 'class': 'oum-settings-panel oum-internet-panel' }, [
					E('h3', {}, 'Подключение к интернету'),
					E('div', { 'class': 'oum-apple-segment oum-internet-segment' + (capabilities.wisp_supported ? ' oum-apple-segment-3' : ''), style: 'background:#f1f5f9;padding:3px;border-radius:12px;display:grid;grid-template-columns:repeat(' + (capabilities.wisp_supported ? 3 : 2) + ',1fr);gap:4px;margin:0 0 8px;' }, [
						E('input', { type: 'radio', name: 'wan_type', value: 'dhcp', checked: (!wisp.enabled && wan.proto !== 'pppoe') ? '' : null, style: 'display:none' }),
						E('input', { type: 'radio', name: 'wan_type', value: 'pppoe', checked: (!wisp.enabled && wan.proto === 'pppoe') ? '' : null, style: 'display:none' }),
						...(capabilities.wisp_supported ? [ E('input', { type: 'radio', name: 'wan_type', value: 'wisp', checked: wisp.enabled ? '' : null, style: 'display:none' }) ] : []),
						E('button', { type: 'button', 'class': 'oum-apple-seg' + ((!wisp.enabled && wan.proto !== 'pppoe') ? ' is-active' : ''), 'data-wan-type-btn': 'dhcp' }, 'DHCP'),
						E('button', { type: 'button', 'class': 'oum-apple-seg' + ((!wisp.enabled && wan.proto === 'pppoe') ? ' is-active' : ''), 'data-wan-type-btn': 'pppoe' }, 'PPPoE'),
						...(capabilities.wisp_supported ? [ E('button', { type: 'button', 'class': 'oum-apple-seg' + (wisp.enabled ? ' is-active' : ''), 'data-wan-type-btn': 'wisp' }, 'Wi-Fi') ] : [])
					]),
					E('div', { id: 'pppoe-settings' }, [
						field('Логин PPPoE', E('input', { id: 'pppoe-user', maxlength: 128, autocomplete: 'username', value: wan.username || '' })),
						field('Новый пароль PPPoE', E('input', { id: 'pppoe-password', type: 'password', maxlength: 256, autocomplete: 'new-password', placeholder: wan.password_set ? 'Не изменять' : '' }))
					]),
					...(capabilities.wisp_supported ? [ E('div', { id: 'wisp-settings', 'class': 'oum-wisp-inline', hidden: wisp.enabled ? null : '' }, [
						E('p', { 'class': 'oum-wisp-intro' }, [
							E('strong', {}, 'Wi-Fi как интернет (WISP)'),
							E('span', {}, 'Роутер подключится к чужой точке и раздаст интернет своим клиентам. Кабельный WAN останется сохранён.')
						]),
						E('div', { id: 'wisp-status', 'class': 'oum-wisp-status' }, wisp.connected ? `Подключено: ${wisp.ssid}${wisp.ip ? ` · ${wisp.ip}` : ''}${wisp.signal != null ? ` · ${wisp.signal} dBm` : ''}` : (wisp.enabled ? 'Настройка включена, но соединения нет.' : 'Выберите сеть и введите её пароль.')),
						E('div', { 'class': 'oum-wisp-scan-row', style: 'grid-template-columns:minmax(112px,.62fr) minmax(0,1.38fr);gap:8px' }, [
							field('Диапазон', E('select', { id: 'wisp-band' }, [
								E('option', { value: '2g', selected: wisp.band !== '5g' ? '' : null }, '2,4 ГГц'),
								E('option', { value: '5g', selected: wisp.band === '5g' ? '' : null }, '5 ГГц')
							])),
							field('Исходная сеть', E('input', { id: 'wisp-ssid', maxlength: 32, value: wisp.ssid || '', placeholder: 'Имя исходной сети' })),
							E('button', { 'class': 'btn oum-wisp-scan', id: 'scan-wisp', type: 'button' }, 'Найти сети')
						]),
						field('Пароль исходной сети', E('input', { id: 'wisp-password', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password', placeholder: wisp.enabled ? 'Введите для переподключения' : 'Пусто — если сеть открытая' })),
						E('div', { id: 'wisp-results', 'class': 'oum-wisp-results', hidden: '' }),
						E('div', { 'class': 'oum-setting-actions oum-wisp-actions' }, [
							E('button', { 'class': 'btn cbi-button-action', id: 'enable-wisp', 'data-system-action': '' }, 'Применить подключение'),
							E('button', { 'class': 'btn oum-internet-secondary', id: 'disable-wisp', 'data-system-action': '', disabled: wisp.enabled ? null : '' }, 'Отключить'),
							E('button', { 'class': 'btn oum-internet-secondary', id: 'rollback-wisp', 'data-system-action': '', disabled: wisp.rollback ? null : '' }, 'Вернуть'),
							E('button', { type: 'button', 'class': 'btn oum-mobile-sheet-cancel' }, 'Отмена')
						])
					]) ] : []),
					E('p', { 'class': 'oum-help' }, [ 'Сейчас: ', E('strong', {}, wan.up ? 'подключено' : 'нет соединения'), wan.ipv4 ? ` · ${wan.ipv4}` : '' ]),
					E('div', { 'class': 'oum-setting-actions', id: 'wan-wired-actions', hidden: wisp.enabled ? '' : null }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'apply-wan', 'data-system-action': '' }, 'Применить подключение'),
						E('button', { 'class': 'btn oum-internet-secondary', id: 'rollback-wan', disabled: settings.rollback_wan ? null : '', 'data-system-action': '' }, 'Вернуть предыдущие'),
						E('button', { type: 'button', 'class': 'btn oum-mobile-sheet-cancel' }, 'Отмена')
					])
				])
			]),
			E('details', { 'class': 'oum-settings-panel oum-protected' }, [
				E('summary', {}, 'Расширение сети'),
				E('div', { 'class': 'oum-protected-content' }, [
					E('div', { 'class': 'oum-network-card-grid' }, [
						E('section', { 'class': 'oum-network-card' }, [
							E('div', { 'class': 'oum-network-card-head' }, [
								E('div', {}, [ E('h4', {}, 'Локальная сеть'), E('p', { 'class': 'oum-help' }, 'Адрес панели управления и домашней сети.') ]),
								E('span', { 'class': 'oum-network-status' }, '/24')
							]),
							E('p', { 'class': 'oum-network-card-note' }, 'Подсеть не должна совпадать с сетью вышестоящего роутера.'),
							E('div', { 'class': 'oum-setting-fields' }, [
								field('LAN IPv4', E('input', { id: 'lan-address', inputmode: 'decimal', maxlength: 15, value: lan.address || '192.168.5.1', placeholder: '192.168.5.1' })),
								field('Маска', E('input', { value: '255.255.255.0', disabled: '' }))
							]),
							E('div', { 'class': 'oum-setting-actions' }, [
								E('button', { 'class': 'btn cbi-button-action', id: 'apply-lan', 'data-system-action': '' }, 'Изменить LAN-адрес'),
								E('button', { 'class': 'btn', id: 'rollback-lan', 'data-system-action': '', disabled: lan.rollback ? null : '' }, lan.rollback_address ? `Вернуть ${lan.rollback_address}` : 'Вернуть предыдущий')
							])
						]),
						...(capabilities.mesh_driver ? [ E('section', { 'class': 'oum-network-card oum-mesh-card' }, [
							E('div', { 'class': 'oum-network-card-head' }, [
								E('div', {}, [ E('h4', {}, 'Mesh-сеть'), E('p', { 'class': 'oum-help' }, 'Бесшовное покрытие между роутерами OUM.') ]),
								E('span', { 'class': 'oum-network-status', 'data-state': mesh.enabled ? 'active' : (meshReady ? 'ready' : 'warning') }, mesh.enabled ? 'Включена' : (meshReady ? 'Готова' : 'Нужен компонент'))
							]),
							E('p', { 'class': 'oum-network-card-note' }, meshReady ? 'На каждом роутере укажите одинаковые Mesh ID и пароль. Обычные точки Wi-Fi останутся включены.' : meshState),
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
						...(capabilities.usb_host ? [ E('section', { 'class': 'oum-network-card oum-network-card-compact' }, [
							E('div', { 'class': 'oum-network-card-head' }, [ E('div', {}, [ E('h4', {}, 'USB и 4G'), E('p', { 'class': 'oum-help' }, usbState) ]) ])
						]) ] : [])
					])
				])
			]),
			E('section', { 'class': 'oum-settings-panel oum-vpn-workspace' }, [
				E('header', { 'class': 'oum-vpn-workspace-head' }, [
					E('div', { 'class': 'oum-vpn-workspace-title' }, [
						E('span', { 'class': 'oum-vpn-workspace-icon', 'aria-hidden': 'true' }),
						E('strong', {}, 'VPN-движок'),
						E('span', { 'class': 'oum-vpn-current-pill' }, `${engineTitle}${engineVersion ? ` · ${engineVersion}` : ''}`)
					]),
					E('span', { 'class': 'oum-help' }, 'Настройки старого движка не переносятся.')
				]),
					E('div', { 'class': 'oum-inline-warning', hidden: activeUnmanagedTunnels.length ? null : '' }, activeUnmanagedTunnels.length ?
						`Обнаружено дополнительное VPN-подключение, созданное не через OUM: ${activeUnmanagedTunnels.map((item) => item.name).join(', ')}. Не меняйте VPN-движок, пока оно включено: два подключения могут мешать друг другу. Отключить его можно в полном интерфейсе OpenWrt.` : ''),
					E('div', { 'class': 'oum-engine-choices' }, [
						engineChoice('openclash', 'OpenClash', 'Подписки, AWG и прокси.', engines.current === 'openclash', false, enginePill('openclash'), upstreamNote('openclash', 'OpenClash')),
						engineChoice('passwall', 'PassWall', 'Тонкая маршрутизация через Xray.', engines.current === 'passwall', false, enginePill('passwall')),
						engineChoice('podkop', 'Podkop + Zapret', 'AWG-туннель, YouTube напрямую через Zapret.', engines.current === 'podkop', false, enginePill('podkop'), upstreamNote('podkop', 'Podkop'))
					]),
					E('p', { 'class': 'oum-help oum-engine-explainer' }, `OUM временно остановит VPN и проверит прямой доступ к GitHub. Затем старый движок и его настройки будут полностью удалены, а выбранный движок установлен заново.${engines.passwall.cache_ready ? ' Локальный комплект PassWall готов.' : ''}`),
					E('nav', { 'class': 'oum-vpn-switchboard', 'aria-label': 'Настройки VPN' }, [
						E('button', { 'class': 'btn cbi-button-action', id: 'switch-engine', 'data-system-action': '', disabled: engines.supported ? null : '' }, engineActionLabel),
						E('button', { 'class': 'btn', type: 'button', 'data-vpn-settings-tab': 'dns', 'data-active': 'false' }, 'DNS для VPN'),
						E('button', { 'class': 'btn', type: 'button', 'data-vpn-settings-tab': 'connection', 'data-active': String(initialVpnTab === 'connection') }, 'Защищённое подключение'),
						...((engines.current === 'openclash' || engines.current === 'podkop') ? [
							E('button', { 'class': 'btn oum-engine-update', type: 'button', id: 'update-engine', 'data-system-action': '' }, 'Проверить обновление')
						] : [])
					]),
			E('details', { 'class': 'oum-settings-panel oum-protected oum-vpn-section', id: 'vpn-section-dns', hidden: '' }, [
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
				'class': 'oum-settings-panel oum-protected oum-vpn-section',
				id: 'vpn-section-connection',
				hidden: initialVpnTab === 'connection' ? null : '',
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
							E('textarea', { id: 'config-input', autocomplete: 'off', spellcheck: 'false' })
						]),
						E('div', { 'class': 'oum-vpn-job', id: 'vpn-job-status', 'data-state': initialVpnJob.state || 'idle' }, initialVpnJob.message || 'Готово к добавлению подключения.'),
						E('button', { 'class': 'btn cbi-button-action', id: 'import-source' }, 'Проверить и активировать')
					])
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
		const root = E('div', { 'class': 'oum-settings oum-app', 'data-theme': document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, [ page ]);

		const value = (selector) => root.querySelector(selector).value.trim();
		const rawValue = (selector) => root.querySelector(selector).value;
		const selected = (name) => root.querySelector(`[name="${name}"]:checked`)?.value || '';
		root.querySelector('.oum-vpn-switchboard').addEventListener('click', (event) => {
			const button = event.target.closest('[data-vpn-settings-tab]');
			if (!button) return;
			const target = button.dataset.vpnSettingsTab;
			const section = root.querySelector(`#vpn-section-${target}`);
			const closing = button.dataset.active === 'true' && section && !section.hidden;
			root.querySelectorAll('[data-vpn-settings-tab]').forEach((item) => item.dataset.active = String(!closing && item === button));
			root.querySelectorAll('.oum-vpn-section').forEach((section) => {
				const active = !closing && section.id === `vpn-section-${target}`;
				section.hidden = !active;
				if (active) section.open = true;
			});
		});
		const statusNode = root.querySelector('#system-job');
		const vpnJobNode = root.querySelector('#vpn-job-status');
		const importButton = root.querySelector('#import-source');
		const configInput = root.querySelector('#config-input');
		const sourceLabel = root.querySelector('#source-label');
		const engineButton = root.querySelector('#switch-engine');
		let watching = false;
		let pendingEngineTitle = window.sessionStorage.getItem('oum-engine-switch-title') || '';
		let engineModal = null;
		let engineModalDismissed = false;
		let lastEngineStage = 0;
		let lastEngineProgress = 4;

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
		const engineStepPlan = () => [
			{ codes: [ 'queued', 'preparing', 'runtime' ], label: 'Подготовка компонентов OUM' },
			{ codes: [ 'vpn_access' ], label: 'Проверка доступа к загрузкам' },
			...(!engineMissing ? [ { codes: [ 'stopping' ], label: 'Проверка прямого интернета' } ] : []),
			{ codes: [ 'removing' ], label: 'Удаление прежних VPN-движков' },
			{ codes: [ 'package_index' ], label: 'Обновление каталога OpenWrt' },
			{ codes: [ 'downloading' ], label: 'Загрузка и проверка нового движка' },
			{ codes: [ 'installing', 'reconnecting' ], label: 'Чистая установка нового движка' }
		];
		const engineStageInfo = (status, plan) => {
			const progressByCode = {
				queued: 4, preparing: 8, runtime: 14, vpn_access: 28, stopping: 40,
				removing: 52, package_index: 62, downloading: 76, installing: 90, reconnecting: 96
			};
			if (status.state === 'success') return { stage: plan.length, progress: 100 };
			if (status.state === 'failed') return { stage: lastEngineStage, progress: lastEngineProgress };
			const found = plan.findIndex((step) => step.codes.includes(status.code));
			const stage = found >= 0 ? found : lastEngineStage;
			const progress = progressByCode[status.code] ?? lastEngineProgress;
			lastEngineStage = stage;
			lastEngineProgress = progress;
			return { stage, progress };
		};
		const buildEngineModal = (title) => {
			const plan = engineStepPlan();
			const steps = plan.map((item, index) => E('div', { 'class': 'oum-engine-step', 'data-step': index, 'data-state': 'pending' }, [
				E('span', { 'class': 'oum-engine-step-mark', 'aria-hidden': 'true' }),
				E('span', { 'class': 'oum-engine-step-label' }, item.label),
				E('span', { 'class': 'oum-engine-step-state' }, 'ожидает')
			]));
			const fill = E('span', { 'class': 'oum-engine-progress-fill' });
			const content = E('div', { 'class': 'oum-engine-progress' }, [
				E('p', { 'class': 'oum-engine-progress-message' }, 'Подготавливаем операцию…'),
				E('div', { 'class': 'oum-engine-step-list' }, steps),
				E('div', { 'class': 'oum-engine-progress-meta' }, [
					E('span', { 'class': 'oum-engine-progress-stage' }, `Шаг 1 из ${plan.length}`),
					E('strong', { 'class': 'oum-engine-progress-percent' }, '4%')
				]),
				E('div', { 'class': 'oum-engine-progress-bar', role: 'progressbar', 'aria-label': 'Ход смены VPN-движка', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '4' }, [ fill ]),
				E('div', { 'class': 'oum-engine-progress-actions' })
			]);
			ui.showModal(`${engineMissing ? 'Установка' : 'Смена'}: ${title}`, [ content ]);
			return {
				content,
				message: content.querySelector('.oum-engine-progress-message'),
				plan,
				steps,
				fill,
				bar: content.querySelector('.oum-engine-progress-bar'),
				percent: content.querySelector('.oum-engine-progress-percent'),
				stage: content.querySelector('.oum-engine-progress-stage'),
				actions: content.querySelector('.oum-engine-progress-actions')
			};
		};
		const showEngineJob = (status) => {
			const terminal = status.state === 'success' || status.state === 'failed';
			if (engineModalDismissed && !terminal) return;
			if (!engineModal || !engineModal.content.isConnected) {
				engineModalDismissed = false;
				engineModal = buildEngineModal(pendingEngineTitle || 'VPN-движок');
			}
			const info = engineStageInfo(status, engineModal.plan);
			const currentIndex = Math.min(info.stage, engineModal.plan.length - 1);
			const currentLabel = engineModal.plan[currentIndex]?.label || 'Подготовка операции';
			if (status.code === 'reconnecting')
				engineModal.steps[currentIndex].querySelector('.oum-engine-step-label').textContent = 'Подключение сохранённого AWG-туннеля';
			engineModal.message.textContent = status.message || 'Подготавливаем операцию…';
			engineModal.fill.style.width = `${info.progress}%`;
			engineModal.bar.setAttribute('aria-valuenow', String(info.progress));
			engineModal.percent.textContent = `${info.progress}%`;
			engineModal.stage.textContent = status.state === 'success' ? 'Все этапы завершены' :
				(status.state === 'failed' ? `Не завершено: ${currentLabel}` : `Шаг ${currentIndex + 1} из ${engineModal.plan.length}`);
			engineModal.content.dataset.state = status.state || 'running';
			engineModal.steps.forEach((step, index) => {
				const failed = status.state === 'failed' && index === currentIndex;
				const done = status.state === 'success' || index < info.stage;
				const active = status.state === 'running' && index === info.stage;
				step.dataset.state = failed ? 'failed' : (done ? 'done' : (active ? 'active' : 'pending'));
				step.querySelector('.oum-engine-step-state').textContent = failed ? 'ошибка' : (done ? 'готово' : (active ? 'выполняется…' : 'ожидает'));
			});
			if (status.state === 'running') {
				engineModal.actions.replaceChildren(E('button', { 'class': 'btn', click: () => {
					engineModalDismissed = true;
					engineModal = null;
					ui.hideModal();
				} }, 'Скрыть'));
			} else if (status.state === 'success') {
				window.sessionStorage.removeItem('oum-engine-switch-title');
				engineModal.actions.replaceChildren(
					E('button', { 'class': 'btn', click: () => acknowledgeStatus(status).finally(() => { ui.hideModal(); window.location.reload(); }) }, 'Позже'),
					E('button', { 'class': 'btn cbi-button-action important', click: rebootNow }, 'Перезагрузить сейчас')
				);
			} else {
				window.sessionStorage.removeItem('oum-engine-switch-title');
				engineModal.actions.replaceChildren(E('button', { 'class': 'btn cbi-button-action important', click: () => { ui.hideModal(); acknowledgeStatus(status); } }, 'Закрыть'));
			}
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
				if ((status.action === 'wifi_toggle' || status.action === 'dns' || status.action === 'adguard' || status.action === 'mesh' || status.action === 'mesh_runtime' || status.action === 'wisp' || status.action === 'rollback_wisp' || status.action === 'project_update' || status.action === 'project_rollback' || status.action === 'engine_update' || status.action === 'podkop_configure' || status.action === 'podkop_awg' || status.action === 'podkop_proxy' || status.action === 'podkop_youtube' || status.action?.startsWith('zapret_')) && status.state === 'success')
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
		const updateWanFields = () => {
			const mode = selected('wan_type');
			root.querySelector('#pppoe-settings').hidden = mode !== 'pppoe';
			const wispSettings = root.querySelector('#wisp-settings');
			if (wispSettings) wispSettings.hidden = mode !== 'wisp';
			root.querySelector('#wan-wired-actions').hidden = mode === 'wisp';
		};
		const stripSsidSuffix = (name) => (name || '').trim().replace(/_(2G|5G)$/i, '');
		const splitSsid = (base, suffix) => { const clean = stripSsidSuffix(base); return clean ? clean + suffix : ''; };
		const updateSplitPreview = () => {
			const preview = root.querySelector('#ssid-split-preview');
			if (!preview) return;
			const base = root.querySelector('#ssid-base').value;
			preview.textContent = stripSsidSuffix(base)
				? `Будут созданы 2 сети: ${splitSsid(base, '_2G')} (2,4 ГГц) и ${splitSsid(base, '_5G')} (5 ГГц).`
				: 'Введите имя сети — к нему добавятся окончания _2G и _5G.';
		};
		const updateWifiFields = () => {
			const smart = selected('wifi_mode') === 'smart';
			const single = root.querySelector('#ssid-single'), base = root.querySelector('#ssid-base');
			root.querySelector('#ssid-single-wrap').hidden = !smart;
			root.querySelector('#ssid-split-wrap').hidden = smart;
			if (smart) { if (single && base && document.activeElement !== single) single.value = stripSsidSuffix(base.value) || single.value; }
			else { if (single && base && document.activeElement !== base) base.value = stripSsidSuffix(single.value); updateSplitPreview(); }
		};
		const updateVpnInput = () => {
			selectedSource = selected('vpn_source') || 'subscription';
			sourceLabel.textContent = selectedSource === 'subscription' ? 'Ссылка подписки' :
				(selectedSource === 'awg' ? 'Вставьте AWG-конфигурацию целиком' : 'Вставьте одну или несколько proxy-ссылок');
			configInput.placeholder = selectedSource === 'subscription' ?
				'https://example.com/subscription\n// Вставьте ссылку подписки' :
				(selectedSource === 'awg' ? '[Interface]\nPrivateKey = …\n…' : 'vless://…\nhy2://…');
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
		root.querySelector('#ssid-base').addEventListener('input', updateSplitPreview);
		root.addEventListener('click', (event) => {
			const segBtn = event.target.closest ? event.target.closest('[data-wifi-mode-btn]') : null;
			if (!segBtn) return;
			const mode = segBtn.getAttribute('data-wifi-mode-btn');
			root.querySelectorAll('[data-wifi-mode-btn]').forEach((b) => b.classList.toggle('is-active', b === segBtn));
			const radio = root.querySelector(`input[name="wifi_mode"][value="${mode}"]`);
			if (radio) radio.checked = true;
			updateWifiFields();
		});
		root.addEventListener('click', (event) => {
			const wanBtn = event.target.closest ? event.target.closest('[data-wan-type-btn]') : null;
			if (!wanBtn) return;
			const mode = wanBtn.getAttribute('data-wan-type-btn');
			root.querySelectorAll('[data-wan-type-btn]').forEach((b) => b.classList.toggle('is-active', b === wanBtn));
			const radio = root.querySelector(`input[name="wan_type"][value="${mode}"]`);
			if (radio) radio.checked = true;
			updateWanFields();
		});
		updateSplitPreview();
		root.querySelector('#reboot-router').addEventListener('click', rebootNow);
		engineButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const target = selected('vpn_engine');
			if (!target || target === engines.current) return ui.addNotification(null, E('p', {}, 'Выберите другой VPN-движок.'), 'warning');
			const title = target === 'passwall' ? 'PassWall' : (target === 'podkop' ? 'Podkop + Zapret' : 'OpenClash');
			const text = engineMissing ? `${title} будет установлен с чистой конфигурацией и останется выключенным до добавления подключения.` : `Старый VPN-движок и его настройки будут полностью удалены. ${title} установится с чистой конфигурацией и останется выключенным до добавления подключения.`;
			if (await confirmation(engineMissing ? `Установить ${title}?` : `Перейти на ${title}?`, text, engineActionLabel, true)) {
				pendingEngineTitle = title;
				window.sessionStorage.setItem('oum-engine-switch-title', title);
				engineModalDismissed = false;
				showEngineJob({ state: 'running', code: 'queued', message: 'Запускаем установку…' });
				start(callSwitchEngine(target));
			}
		});
		const updateEngineButton = root.querySelector('#update-engine');
		if (updateEngineButton) updateEngineButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const text = `OUM сверит ${engineTitle} с проверенной версией из текущей сборки. Если обновление есть, настройки и активное подключение будут сохранены, а служба кратковременно перезапустится.`;
			if (await confirmation(`Проверить обновление ${engineTitle}?`, text, 'Проверить', false))
				start(callUpdateEngine(engines.current));
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
			const payload = configInput.value.trim();
			if (!payload) return showVpnJob({ state: 'failed', message: 'Введите данные подключения.' });
			showVpnJob({ state: 'running', message: 'Запускаем безопасный импорт…' });
			callStartVpnImport(selectedSource, payload).then((result) => {
				resultError(result, 'Не удалось запустить импорт.');
				configInput.value = '';
				watchVpnJob();
			}).catch((error) => showVpnJob({ state: 'failed', message: error.message }));
		});

		root.querySelector('#apply-wifi').addEventListener('click', async () => {
			const mode = selected('wifi_mode');
			let ssid24, ssid5;
			if (mode === 'smart') { ssid24 = value('#ssid-single'); ssid5 = ssid24; }
			else {
				const clean = stripSsidSuffix(value('#ssid-base'));
				if (!clean) return ui.addNotification(null, E('p', {}, 'Введите имя Wi-Fi.'), 'warning');
				ssid24 = clean + '_2G'; ssid5 = clean + '_5G';
			}
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
		const wifiPanel = root.querySelector('.oum-settings-grid > .oum-settings-panel:first-child');
		const internetPanel = root.querySelector('.oum-settings-grid > .oum-internet-panel');
		const networkPanel = root.querySelector('details.oum-settings-panel.oum-protected:not(.oum-vpn-section)');
		const vpnPanel = root.querySelector('.oum-vpn-workspace');
		const maintenancePanel = Array.from(root.querySelectorAll('.oum-settings-panel')).find((panel) => panel.querySelector(':scope > h3')?.textContent === 'Обслуживание OUM');
		const maintenanceCards = maintenancePanel ? Array.from(maintenancePanel.querySelectorAll('.oum-maintenance-card')) : [];
		const mobileSources = [ wifiPanel, internetPanel, networkPanel, vpnPanel, maintenancePanel ].filter(Boolean);
		mobileSources.forEach((node) => node.classList.add('oum-mobile-sheet-source'));

		let activeSheetNode = null;
		let activeSheetPlaceholder = null;
		const sheet = E('div', { 'class': 'oum-settings-sheet', hidden: '', role: 'dialog', 'aria-modal': 'true' }, [
			E('div', { 'class': 'oum-settings-sheet-panel' }, [
				E('span', { 'class': 'oum-settings-sheet-handle', 'aria-hidden': 'true' }),
				E('header', { 'class': 'oum-settings-sheet-head' }, [
					E('h3', { id: 'oum-settings-sheet-title' }, ''),
					E('button', { type: 'button', 'class': 'oum-settings-sheet-close', 'aria-label': 'Закрыть' }, '×')
				]),
				E('div', { 'class': 'oum-settings-sheet-content' })
			])
		]);
		const sheetTitle = sheet.querySelector('#oum-settings-sheet-title');
		const sheetContent = sheet.querySelector('.oum-settings-sheet-content');
		const closeSheet = () => {
			if (activeSheetNode && activeSheetPlaceholder && activeSheetPlaceholder.parentNode) {
				activeSheetNode.classList.remove('oum-mobile-sheet-active');
				if (activeSheetPlaceholder && activeSheetPlaceholder.parentNode) {
					activeSheetPlaceholder.parentNode.insertBefore(activeSheetNode, activeSheetPlaceholder.nextSibling);
					activeSheetPlaceholder.remove();
				} else if (activeSheetNode.parentNode) {
					activeSheetNode.remove();
				}
			}
			activeSheetNode = null;
			activeSheetPlaceholder = null;
			delete sheet.dataset.section;
			sheet.hidden = true;
			document.documentElement.classList.remove('oum-settings-sheet-open');
		};
		root.querySelectorAll('.oum-mobile-sheet-cancel').forEach((button) => button.addEventListener('click', closeSheet));
		const openSheet = (title, node, prepare) => {
			if (!node) return;
			closeSheet();
			// ensure clean sheet for custom nodes (fix DNS showing AWG)
			sheetContent.innerHTML = '';
			activeSheetNode = node;
			activeSheetPlaceholder = document.createComment(`oum-settings:${title}`);
			sheet.dataset.section = node.classList.contains('oum-internet-panel') ? 'internet' : '';
			if (node.parentNode) node.parentNode.insertBefore(activeSheetPlaceholder, node); else activeSheetPlaceholder = null;
			node.classList.add('oum-mobile-sheet-active');
			if (node.tagName === 'DETAILS') node.open = true;
			sheetTitle.textContent = title;
			sheetContent.appendChild(node);
			if (typeof prepare === 'function') prepare(node);
			sheet.hidden = false;
			document.documentElement.classList.add('oum-settings-sheet-open');
			sheet.querySelector('.oum-settings-sheet-close').focus();
		};
		sheet.querySelector('.oum-settings-sheet-close').addEventListener('click', closeSheet);
		sheet.addEventListener('click', (event) => { if (event.target === sheet) closeSheet(); });
		document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !sheet.hidden) closeSheet(); });
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
			if (sheetCy > 90) closeSheet();
			sheetPanel.style.transform = '';
			sheetCy = 0;
		});
		root.appendChild(sheet);

		const launcher = (title, description, action, danger = false) => {
			const button = E('button', { type: 'button', 'class': `oum-mobile-settings-launcher${danger ? ' is-danger' : ''}` }, [
				E('span', {}, [ E('strong', {}, title), E('small', {}, description) ]),
				E('span', { 'class': 'oum-mobile-settings-launcher-action' }, [ E('span', {}, 'Настроить'), E('b', { 'aria-hidden': 'true' }, '›') ])
			]);
			button.addEventListener('click', action);
			return button;
		};
		const showVpnSection = (name) => {
			root.querySelectorAll('[data-vpn-settings-tab]').forEach((button) => button.dataset.active = 'false');
			root.querySelectorAll('.oum-vpn-section').forEach((section) => { section.hidden = true; section.open = false; });
			if (!name) return;
			const button = root.querySelector(`[data-vpn-settings-tab="${name}"]`);
			const section = root.querySelector(`#vpn-section-${name}`);
			if (button) button.dataset.active = 'true';
			if (section) { section.hidden = false; section.open = true; }
		};
		const openActivationSheet = (kind, payload) => {
			const steps = kind === 'subscription'
				? ['Проверка формата', 'Загрузка подписки', 'Установка и активация']
				: ['Проверка формата', 'Установка и активация'];
			const order = kind === 'subscription' ? ['queued', 'preparing', 'downloading', 'activating'] : ['queued', 'preparing', 'activating'];
			let ov = document.getElementById('oum-activation-sheet');
			if (ov) ov.remove();
			ov = E('div', { id: 'oum-activation-sheet', hidden: '' }, [
				E('div', { 'class': 'oum-mobile-menu-panel oum-activation-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Активация ключа' }, [
					E('span', { 'class': 'oum-mobile-menu-handle', 'aria-hidden': 'true' }),
					E('div', { 'class': 'oum-act-title' }, 'Активация ключа'),
					E('div', { 'class': 'oum-act-desc' }, kind === 'subscription' ? 'Проверяем формат, загружаем подписку и безопасно активируем подключение.' : 'Проверяем формат и безопасно активируем подключение.'),
					E('div', { 'class': 'oum-act-steps' }, steps.map(s=>E('div', { 'class': 'oum-act-step', 'data-state': 'pending' }, [E('span', { 'class': 'oum-act-ico', 'aria-hidden': 'true' }), E('span', {}, s)]))),
					E('div', { 'class': 'oum-act-bar' }, [E('span', { 'class': 'oum-act-fill' })]),
					E('div', { 'class': 'oum-act-result', hidden: '' }),
					E('button', { type: 'button', 'class': 'oum-mobile-menu-btn oum-act-hide', 'data-act-close': '' }, 'Скрыть')
				])
			]);
			document.body.appendChild(ov);
			const panel = ov.firstChild;
			const stepEls = Array.from(panel.querySelectorAll('.oum-act-step'));
			const fill = panel.querySelector('.oum-act-fill');
			const resBox = panel.querySelector('.oum-act-result');
			let stopped = false;
			const closeAct = () => { stopped = true; ov.hidden = true; document.body.classList.remove('oum-act-open'); };
			panel.querySelector('[data-act-close]').addEventListener('click', closeAct);
			ov.addEventListener('click', (ev) => { if (ev.target === ov) closeAct(); });
			document.addEventListener('keydown', function escAct(ev) { if (ev.key === 'Escape' && !ov.hidden) { closeAct(); document.removeEventListener('keydown', escAct); } });
			let touchY = null;
			panel.addEventListener('touchstart', (ev) => { if (ev.touches.length === 1) touchY = ev.touches[0].clientY; }, { passive: true });
			panel.addEventListener('touchend', (ev) => { if (touchY == null || !ev.changedTouches.length) return; if (ev.changedTouches[0].clientY - touchY > 90) closeAct(); touchY = null; }, { passive: true });
			const stageStep = kind === 'subscription'
				? { queued: 0, preparing: 0, downloading: 1, activating: 2 }
				: { queued: 0, preparing: 0, activating: 1 };
			let lastStep = 0;
			const paint = (code, state, message) => {
				let activeIdx;
				if (state === 'success') { activeIdx = steps.length; lastStep = steps.length; }
				else if (state === 'failed') {
				const failStep = { invalid_url: 0, invalid_payload: 0, invalid_type: 0, invalid_vpn: 0, missing_input: 0, download_failed: (kind === 'subscription' ? 1 : 0), activation_failed: (kind === 'subscription' ? 2 : 1) };
				activeIdx = (code in stageStep) ? stageStep[code] : ((code in failStep) ? failStep[code] : lastStep);
			}
				else { activeIdx = (code in stageStep) ? stageStep[code] : lastStep; lastStep = activeIdx; }
				stepEls.forEach((el, i) => {
					let st = 'pending';
					if (state === 'success' || i < activeIdx) st = 'done';
					else if (i === activeIdx) st = state === 'failed' ? 'failed' : 'active';
					el.dataset.state = st;
				});
				if (fill) fill.style.width = Math.round(100 * Math.min(activeIdx, steps.length) / steps.length) + '%';
				if (resBox) {
					if (state === 'success' || state === 'failed') {
						resBox.hidden = false;
						resBox.dataset.state = state;
						resBox.textContent = message || (state === 'success' ? 'Подключение активировано' : 'Не удалось активировать');
					} else { resBox.hidden = true; }
				}
				const mirror = document.getElementById('vpn-job-status');
				if (mirror) { mirror.dataset.state = state || 'idle'; mirror.textContent = message || ''; }
				const mobMirror = document.getElementById('vpn-job-mobile');
				if (mobMirror) mobMirror.textContent = message || '';
			};
			const poll = () => {
				if (stopped) return;
				callVpnJobStatus().then((job) => {
					paint(job.code || '', job.state || 'idle', job.message || '');
					if (!stopped && job.state === 'running') window.setTimeout(poll, 1500);
				}).catch(() => { if (!stopped) window.setTimeout(poll, 2000); });
			};
			ov.hidden = false;
			document.body.classList.add('oum-act-open');
			paint('queued', 'running', 'Запускаем безопасный импорт…');
			if (!payload) { paint('', 'failed', 'Введите данные подключения.'); return; }
			callStartVpnImport(kind, payload).then((result) => {
				try { resultError(result, 'Не удалось запустить импорт.'); }
				catch (e) { paint('', 'failed', e.message); return; }
				poll();
			}).catch((e) => paint('', 'failed', e.message));
		};
		const openVpnSheet = (title, section) => {
			console.log('openVpnSheet', title, section, window.innerWidth);
			if (section === 'dns' && window.innerWidth <= 900) {
				try {
					const dnsSection = document.getElementById('vpn-section-dns');
					if (dnsSection) {
						const customDNS = E('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
							E('div', { style: 'background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;' }, Array.from(dnsSection.querySelectorAll('.oum-dns-engine')).map(engine=>{
								const title = engine.querySelector('h4')?.textContent || 'Podkop + Zapret';
								const mainSel = engine.querySelector('select#dns-current');
								const bootSel = engine.querySelector('select#bootstrap-dns-current');
								return E('div', {}, [
									E('div', { style: 'font-weight:700;font-size:13px;' }, title),
									E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'Основной DNS'),
									mainSel ? E('select', { id: 'dns-current-mobile', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;' }, Array.from(mainSel.options).map(o=>E('option', { value: o.value, selected: o.selected ? '' : null }, o.textContent))) : E('div', {}, 'Нет DNS'),
									E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'Bootstrap DNS'),
									bootSel ? E('select', { id: 'bootstrap-dns-current-mobile', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;' }, Array.from(bootSel.options).map(o=>E('option', { value: o.value, selected: o.selected ? '' : null }, o.textContent))) : E('div', {}, ''),
									E('div', { style: 'font-size:11px;color:#6b7280;margin-top:4px;' }, engine.querySelector('small')?.textContent || 'Используется штатный параметр bootstrap_dns_server Podkop.')
								]);
							})),
							E('button', { 'class': 'btn cbi-button-action', style: 'width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;margin-top:4px;', click: ()=>document.getElementById('apply-engine-dns')?.click() }, 'Применить DNS'),
							E('div', { style: 'font-size:11px;color:#6b7280;text-align:center;' }, 'Podkop + Zapret будет кратковременно перезапущен.')
						]);
						openSheet(title, customDNS);
						return;
					}
				} catch(e){ console.log('dns custom error', e.message); }
			}
			if (section === 'connection') {
				try {
				// openclash/passwall: sources sheet (Subscription/AWG/Proxy) wired to desktop import
				if (engines.current === 'openclash' || engines.current === 'passwall') {
					const isOC = engines.current === 'openclash';
					const engName = isOC ? 'OpenClash' : 'PassWall';
					const srcTabs = isOC ? [['subscription','Subscription'],['awg','AWG'],['proxy','Reality']] : [['subscription','Subscription'],['proxy','Reality']];
					const srcLabels = { subscription: 'Ссылка подписки', awg: 'Вставьте AWG-конфигурацию целиком', proxy: 'Вставьте одну или несколько proxy-ссылок' };
					const srcPh = { subscription: 'https://example.com/subscription\n// Вставьте ссылку подписки', awg: '[Interface]\nPrivateKey = …\n…', proxy: 'vless://…\nhy2://…' };
					const curSrc = (document.querySelector('[name="vpn_source"]:checked') || {}).value || 'subscription';
					const paintSrcSeg = (wrap) => {
						wrap.querySelectorAll('[data-src-tab]').forEach(b=>{ const ac=b.dataset.srcTab===wrap.dataset.activeSrc; b.classList.toggle('is-active', ac); b.style.background=ac?'#fff':'transparent'; b.style.color=ac?'#0f172a':'#64748b'; b.style.boxShadow=ac?'0 1px 3px rgba(0,0,0,.08)':'none'; });
					};
					const applySrc = (wrap, v) => {
						wrap.dataset.activeSrc = v;
						const r = document.querySelector('[name="vpn_source"][value="'+v+'"]'); if (r) r.checked = true;
						const lab = wrap.parentNode.querySelector('[data-src-label]'); if (lab) lab.textContent = srcLabels[v] || v;
						const ta = wrap.parentNode.querySelector('textarea'); if (ta) ta.placeholder = srcPh[v] || '';
						paintSrcSeg(wrap);
					};
					const segS = E('div', { 'class': 'oum-apple-segment oum-apple-segment-3', style: 'background:#f1f5f9;padding:3px;border-radius:12px;display:grid;grid-template-columns:repeat('+srcTabs.length+',1fr);gap:4px;margin:0 0 12px;', 'data-active-src': curSrc }, srcTabs.map(([v,lab])=>E('button', { type: 'button', 'class': 'oum-apple-seg'+(v===curSrc?' is-active':''), style: 'padding:7px;font-size:11px;font-weight:600;border-radius:8px;border:none;', 'data-src-tab': v }, lab)));
					const cardS = E('div', { style: 'background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;' }, [
						E('div', {}, [ E('div', { style: 'font-weight:700;font-size:13px;' }, 'Подключение '+engName), E('div', { style: 'font-size:11px;color:#6b7280;margin-top:2px;' }, isOC ? 'Новый источник заменяет предыдущий профиль. При ошибке старый восстанавливается.' : 'Subscription или proxy-ссылки. При ошибке старый профиль восстанавливается.') ]),
						E('label', { style: 'display:block;font-weight:600;font-size:11px;', 'data-src-label': '' }, srcLabels[curSrc] || curSrc),
						E('textarea', { id: 'vpn-config-mobile', autocomplete: 'off', spellcheck: 'false', style: 'width:100%;min-height:88px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:13px;background:#fff;box-sizing:border-box;font-family:monospace;' }, (document.getElementById('config-input') || {}).value || ''),
						E('div', { style: 'font-size:11px;color:#6b7280;', id: 'vpn-job-mobile' }, (document.getElementById('vpn-job-status') || {}).textContent || 'Готово к добавлению подключения.'),
						E('button', { 'class': 'btn cbi-button-action', style: 'width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;' }, 'Проверить и активировать')
					]);
					const customS = E('div', { 'class': 'oum-settings-sheet-content' }, [segS, cardS]);
					applySrc(segS, curSrc);
					segS.querySelectorAll('[data-src-tab]').forEach(btn=>btn.addEventListener('click', ()=>applySrc(segS, btn.dataset.srcTab)));
					const taS = cardS.querySelector('textarea');
					if (taS) taS.addEventListener('input', ()=>{ const orig=document.getElementById('config-input'); if(orig) orig.value=taS.value; });
					const jobS = cardS.querySelector('#vpn-job-mobile');
					const impBtn = document.getElementById('import-source');
					if (impBtn) { const watched=document.getElementById('vpn-job-status'); if(watched){ const obs=new MutationObserver(()=>{ if(jobS){ const n=document.getElementById('vpn-job-status'); if(n) jobS.textContent=n.textContent; } const ab=cardS.querySelector('button'); if(ab) ab.disabled=impBtn.disabled; }); obs.observe(watched,{childList:true,characterData:true,subtree:true}); } }
					cardS.querySelector('button').addEventListener('click', ()=>{ const v=(taS && taS.value.trim()) || ''; if(taS){ const orig=document.getElementById('config-input'); if(orig) orig.value=taS.value; } openActivationSheet(segS.dataset.activeSrc || curSrc, v); });
					openSheet(title, customS);
					callVpnJobStatus().then((job)=>{ const m=cardS.querySelector('#vpn-job-mobile'); if(m) m.textContent=(job && job.message) || 'Готово к добавлению подключения.'; }).catch(()=>{});
					return;
				}
				if (engineMissing) {
					openSheet(title, E('div', { 'class': 'oum-settings-sheet-content' }, [E('p', { 'class': 'oum-help' }, 'Сначала установите VPN-движок — настройки подключения появятся после установки.')]));
					return;
				}
				// etalon: build custom bottom-sheet for Защищённое подключение as per right image
				const isAWG = engines.podkop?.transport !== 'reality';
				const awgActive = isAWG;
				const seg = E('div', { 'class': 'oum-apple-segment', style: 'background:#f1f5f9;padding:3px;border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0 0 12px;' }, [
					E('button', { type: 'button', 'class': awgActive ? 'oum-apple-seg is-active' : 'oum-apple-seg', style: 'padding:7px;font-size:12px;font-weight:600;border-radius:8px;border:none;background:'+(awgActive?'#fff':'transparent')+';color:'+(awgActive?'#0f172a':'#64748b')+';box-shadow:'+(awgActive?'0 1px 3px rgba(0,0,0,.08)':'none'), 'data-conn-tab': 'awg' }, 'AWG'),
					E('button', { type: 'button', 'class': !awgActive ? 'oum-apple-seg is-active' : 'oum-apple-seg', style: 'padding:7px;font-size:12px;font-weight:600;border-radius:8px;border:none;background:'+(!awgActive?'#fff':'transparent')+';color:'+(!awgActive?'#0f172a':'#64748b')+';box-shadow:'+(!awgActive?'0 1px 3px rgba(0,0,0,.08)':'none'), 'data-conn-tab': 'reality' }, 'Reality')
				]);
				const awgPane = E('div', { 'data-conn-pane': 'awg', hidden: awgActive ? null : '' }, [
					E('textarea', { id: 'podkop-awg-config-mobile', placeholder: '[Interface]\nPrivateKey = ...\nAddress = ...\n...\n\n[Peer]\nPublicKey = ...\nEndpoint = ...', style: 'width:100%;min-height:88px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:13px;background:#fff;box-sizing:border-box;' }, document.getElementById('podkop-awg-config')?.value || 'test'),
					E('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px;' }, [
						E('select', { id: 'podkop-interface-mobile', style: 'height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;' }, ...podkopInterfaces.map(name=>E('option', { value: name, selected: name===engines.podkop?.interface ? '' : null }, name))),
						E('button', { 'class': 'btn cbi-button-action', style: 'height:42px;padding:0 12px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-weight:600;', click: ()=>document.getElementById('import-podkop-awg')?.click() }, 'Импорт')
					]),
					E('button', { 'class': 'btn', style: 'width:100%;height:42px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;font-weight:500;margin-top:8px;', click: ()=>document.getElementById('configure-podkop')?.click() }, 'Использовать')
				]);
				const realityPane = E('div', { 'data-conn-pane': 'reality', hidden: !awgActive ? null : '' }, [
					E('textarea', { id: 'podkop-reality-config-mobile', placeholder: 'vless://UUID@server:443?security=reality&pbk=...', style: 'width:100%;min-height:88px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:13px;background:#fff;box-sizing:border-box;' }, document.getElementById('podkop-reality-config')?.value || ''),
					E('button', { 'class': 'btn cbi-button-action', style: 'width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;margin-top:8px;', click: ()=>document.getElementById('import-podkop-reality')?.click() }, 'Проверить и использовать Reality')
				]);
				const youtubeSeg = E('div', { 'class': 'oum-apple-segment', style: 'background:#f1f5f9;padding:3px;border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:12px 0 8px;' }, [
					E('button', { type: 'button', 'class': youtubeMode==='zapret' ? 'oum-apple-seg is-active' : 'oum-apple-seg', style: 'padding:7px;font-size:11px;font-weight:600;border-radius:8px;border:none;background:'+(youtubeMode==='zapret'?'#fff':'transparent')+';color:'+(youtubeMode==='zapret'?'#0f172a':'#64748b'), 'data-youtube': 'zapret' }, 'Напрямую + Zapret'),
					E('button', { type: 'button', 'class': youtubeMode==='vpn' ? 'oum-apple-seg is-active' : 'oum-apple-seg', style: 'padding:7px;font-size:11px;font-weight:600;border-radius:8px;border:none;background:'+(youtubeMode==='vpn'?'#fff':'transparent')+';color:'+(youtubeMode==='vpn'?'#0f172a':'#64748b'), 'data-youtube': 'vpn' }, 'Через VPN')
				]);
				const zapretInfo = E('div', { style: 'background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-top:12px;' }, [
					E('div', { style: 'font-weight:700;font-size:13px;' }, 'Стратегия Zapret'),
					E('div', { style: 'font-size:11px;color:#6b7280;margin:4px 0 8px;' }, 'Каталог 27 стратегий - рабочая от 3 из 4 проверок.'),
					E('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-size:12px;' }, [
						E('span', {}, 'Текущая: '+(zapret.current || 'не выбрана OUM')),
						E('span', { style: 'color:#6b7280;font-size:11px;' }, '1/4 · 6264 мс')
					]),
					E('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px;' }, [
						E('select', { id: 'zapret-strategy-mobile', style: 'height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;' }, ...(zapret.strategies||[]).map(item=>E('option', { value: item.id, selected: item.id===zapret.current ? '' : null }, item.id))),
						E('button', { 'class': 'btn', style: 'height:42px;padding:0 12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;', click: ()=>document.getElementById('zapret-apply')?.click() }, 'Применить')
					]),
					E('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;' }, [
						E('button', { 'class': 'btn cbi-button-action', style: 'height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;', click: ()=>document.getElementById('zapret-auto')?.click() }, 'Подобрать автоматически'),
						E('button', { 'class': 'btn', style: 'height:42px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;', click: ()=>document.getElementById('zapret-check')?.click() }, 'Проверить текущую')
					]),
					E('div', { style: 'text-align:center;margin-top:8px;' }, E('a', { href: '#', style: 'font-size:11px;color:#6b7280;text-decoration:underline;', click: (e)=>{ e.preventDefault(); document.getElementById('zapret-restore')?.click(); } }, 'Вернуть предыдущую')),
					E('div', { style: 'font-size:11px;color:#6b7280;text-align:center;margin-top:4px;' }, 'YouTube кратковременно перезапустится при автоподборе.')
				]);
				const custom = E('div', { 'class': 'oum-settings-sheet-content' }, [
					seg, awgPane, realityPane,
					E('div', { style: 'font-weight:700;font-size:13px;margin-top:12px;' }, 'Маршрут YouTube'),
					E('div', { style: 'font-size:11px;color:#6b7280;margin-bottom:6px;' }, 'Напрямую экономит VPN-трафик, через VPN - Zapret не нужен.'),
					youtubeSeg,
					E('button', { 'class': 'btn cbi-button-action', style: 'width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;margin-top:8px;', click: ()=>document.getElementById('apply-youtube-mode')?.click() }, 'Применить режим YouTube'),
					zapretInfo
				]);
				// tab switching
				custom.querySelectorAll('[data-conn-tab]').forEach(btn=>{
					btn.addEventListener('click', ()=>{
						const isAWG = btn.dataset.connTab==='awg';
						custom.querySelectorAll('[data-conn-tab]').forEach(b=>{ b.classList.toggle('is-active', b===btn); b.style.background=b===btn?'#fff':'transparent'; b.style.color=b===btn?'#0f172a':'#64748b'; b.style.boxShadow=b===btn?'0 1px 3px rgba(0,0,0,.08)':'none'; });
						custom.querySelector('[data-conn-pane="awg"]').hidden = !isAWG;
						custom.querySelector('[data-conn-pane="reality"]').hidden = isAWG;
					});
				});
				custom.querySelectorAll('[data-youtube]').forEach(btn=>{
					btn.addEventListener('click', ()=>{
						custom.querySelectorAll('[data-youtube]').forEach(b=>{ const ac=b===btn; b.classList.toggle('is-active', ac); b.style.background=ac?'#fff':'transparent'; b.style.color=ac?'#0f172a':'#64748b'; });
						// sync hidden radio
						const target = btn.dataset.youtube;
						document.querySelectorAll('[name="youtube_mode"]').forEach(r=>r.checked=r.value===target);
					});
				});
				openSheet(title, custom);
				console.log('custom sheet opened');
				return;
			} catch(e){ console.log('custom error', e.message, e.stack); }
			}
			openSheet(title, vpnPanel, () => showVpnSection(section));
		};
		const openNetworkSheet = (title) => {
			if (window.innerWidth <= 900) {
				try {
					const lanAddr = lan.address || '192.168.5.1';
					const rollbackAddr = lan.rollback_address || '';
					const hasRollback = !!lan.rollback;
					const meshIdVal = mesh.id || '';
					const meshBandVal = mesh.band || '5g';
					const seg = E('div', { 'class': 'oum-apple-segment', style: 'background:#f1f5f9;padding:3px;border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0 0 12px;' }, [
						E('button', { type: 'button', 'class': 'oum-apple-seg is-active', style: 'padding:7px;font-size:12px;font-weight:600;border-radius:8px;border:none;background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.08)', 'data-net-tab': 'lan' }, 'Локальная сеть'),
						E('button', { type: 'button', 'class': 'oum-apple-seg', style: 'padding:7px;font-size:12px;font-weight:600;border-radius:8px;border:none;background:transparent;color:#64748b;box-shadow:none', 'data-net-tab': 'mesh' }, 'Mesh-сеть')
					]);
					const lanPane = E('div', { 'data-net-pane': 'lan' }, [
						E('div', { style: 'background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;' }, [
							E('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;' }, [
								E('div', {}, [ E('div', { style: 'font-weight:700;font-size:13px;' }, 'Локальная сеть'), E('div', { style: 'font-size:11px;color:#6b7280;margin-top:2px;' }, 'Адрес панели управления и домашней сети.') ]),
								E('span', { style: 'font-size:11px;font-weight:700;color:#475569;background:#f8fafc;border:1px solid #e5e7eb;padding:4px 8px;border-radius:999px;' }, '/24')
							]),
							E('div', { style: 'background:#f8fafc;border:1px solid #f1f5f9;border-radius:10px;padding:8px 10px;font-size:11px;color:#64748b;line-height:1.4;' }, 'Подсеть не должна совпадать с сетью вышестоящего роутера.'),
							E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'LAN IPv4'),
							E('input', { id: 'lan-address-mobile', inputmode: 'decimal', maxlength: 15, value: lanAddr, placeholder: '192.168.5.1', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;font-size:13px;box-sizing:border-box;' }),
							E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'Маска'),
							E('input', { value: '255.255.255.0', disabled: '', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#f1f5f9;color:#64748b;font-size:13px;box-sizing:border-box;' }),
							E('button', { 'class': 'btn cbi-button-action', style: 'width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;margin-top:8px;', click: () => { const v=document.getElementById('lan-address-mobile')?.value.trim(); const orig=document.getElementById('lan-address'); if(orig&&v) orig.value=v; document.getElementById('apply-lan')?.click(); } }, 'Изменить LAN-адрес'),
							E('button', { 'class': 'btn', style: 'width:100%;height:42px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;font-weight:500;', disabled: hasRollback ? null : '', click: () => document.getElementById('rollback-lan')?.click() }, rollbackAddr ? `Вернуть ${rollbackAddr}` : 'Вернуть предыдущий')
						])
					]);
					const meshStatusText = mesh.enabled ? 'Включена' : (meshReady ? 'Готова' : 'Нужен компонент');
					const meshBg = mesh.enabled ? '#ecfdf5' : (meshReady ? '#f0fdf4' : '#fef2f2');
					const meshBd = mesh.enabled ? '#a7f3d0' : (meshReady ? '#bbf7d0' : '#fecaca');
					const meshCo = mesh.enabled ? '#059669' : (meshReady ? '#15803d' : '#dc2626');
					const meshPane = E('div', { 'data-net-pane': 'mesh', hidden: '' }, [
						E('div', { style: 'background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;' }, [
							E('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;' }, [
								E('div', {}, [ E('div', { style: 'font-weight:700;font-size:13px;' }, 'Mesh-сеть'), E('div', { style: 'font-size:11px;color:#6b7280;margin-top:2px;' }, 'Бесшовное покрытие между роутерами OUM.') ]),
								E('span', { style: 'font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;border:1px solid '+meshBd+';background:'+meshBg+';color:'+meshCo+';' }, meshStatusText)
							]),
							E('div', { style: 'background:#f8fafc;border:1px solid #f1f5f9;border-radius:10px;padding:8px 10px;font-size:11px;color:#64748b;line-height:1.4;' }, meshReady ? 'На каждом роутере укажите одинаковые Mesh ID и пароль. Обычные точки Wi-Fi останутся включены.' : meshState),
							...(!meshReady && capabilities.mesh_runtime_bundle ? [E('button', { 'class': 'btn cbi-button-action', style: 'width:100%;height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;', click: ()=>document.getElementById('install-mesh-runtime')?.click() }, 'Установить поддержку Mesh')] : []),
							E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'Mesh ID'),
							E('input', { id: 'mesh-id-mobile', maxlength: 32, value: meshIdVal, placeholder: 'HomeMesh', disabled: meshReady ? null : '', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;font-size:13px;box-sizing:border-box;' }),
							E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'Диапазон'),
							E('select', { id: 'mesh-band-mobile', disabled: meshReady ? null : '', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;font-size:13px;box-sizing:border-box;' }, [ E('option', { value: '5g', selected: meshBandVal !== '2g' ? '' : null }, '5 ГГц — выше скорость'), E('option', { value: '2g', selected: meshBandVal === '2g' ? '' : null }, '2,4 ГГц — больше дальность') ]),
							E('label', { style: 'display:block;font-weight:600;font-size:11px;margin:8px 0 4px;' }, 'Пароль Mesh'),
							E('input', { id: 'mesh-password-mobile', type: 'password', minlength: 8, maxlength: 63, autocomplete: 'new-password', placeholder: mesh.enabled ? 'Введите заново для изменения' : 'Минимум 8 символов', disabled: meshReady ? null : '', style: 'width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;font-size:13px;box-sizing:border-box;' }),
							E('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;' }, [
								E('button', { 'class': 'btn cbi-button-action', style: 'height:42px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:600;', disabled: meshReady ? null : '', click: () => { const id=document.getElementById('mesh-id-mobile')?.value.trim(); const pw=document.getElementById('mesh-password-mobile')?.value; const band=document.getElementById('mesh-band-mobile')?.value||'5g'; const oId=document.getElementById('mesh-id'); const oPw=document.getElementById('mesh-password'); const oBand=document.getElementById('mesh-band'); if(oId) oId.value=id||''; if(oPw) oPw.value=pw||''; if(oBand) oBand.value=band; document.getElementById('enable-mesh')?.click(); } }, mesh.enabled ? 'Обновить Mesh' : 'Включить Mesh'),
								E('button', { 'class': 'btn', style: 'height:42px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;', disabled: mesh.enabled ? null : '', click: ()=>document.getElementById('disable-mesh')?.click() }, 'Отключить Mesh')
							])
						])
					]);
					const custom = E('div', { 'class': 'oum-settings-sheet-content' }, [seg, lanPane, meshPane]);
					custom.querySelectorAll('[data-net-tab]').forEach(btn=>{
						btn.addEventListener('click', ()=>{
							const isLan = btn.dataset.netTab==='lan';
							custom.querySelectorAll('[data-net-tab]').forEach(b=>{ const ac=b===btn; b.classList.toggle('is-active', ac); b.style.background=ac?'#fff':'transparent'; b.style.color=ac?'#0f172a':'#64748b'; b.style.boxShadow=ac?'0 1px 3px rgba(0,0,0,.08)':'none'; });
							custom.querySelector('[data-net-pane="lan"]').hidden = !isLan;
							custom.querySelector('[data-net-pane="mesh"]').hidden = isLan;
						});
					});
					openSheet(title, custom);
					return;
				} catch(e){ console.log('network custom error', e.message, e.stack); }
			}
			openSheet(title, networkPanel);
		};
		const vpnState = engineMissing ? 'Не установлен' : `${engineTitle}${engineVersion ? ` · ${engineVersion}` : ''}`;
		const maintenanceTitles = [ 'Обновление проекта', 'Резервная копия', 'Восстановление', 'Сброс' ];
		const maintenanceDescriptions = [
			projectUpdatable ? `Установлена версия ${project.version}` : 'Локальная версия проекта',
			'Скачать настройки OUM и сети',
			'Загрузить ранее сохранённую копию',
			'Сброс VPN или повторный первый запуск'
		];
		const mobileHub = E('section', { 'class': 'oum-mobile-settings-hub', 'aria-label': 'Разделы настроек' }, [
			E('div', { 'class': 'oum-mobile-settings-intro' }, [
				E('h2', {}, 'Настройки OUM'),
				E('p', {}, 'Сеть, Wi‑Fi и защищённое подключение'),
				E('small', {}, 'Пароли не показываются. Оставьте поле пустым, чтобы сохранить действующий.')
			]),
			E('div', { 'class': 'oum-mobile-settings-launchers' }, [
				launcher('Wi-Fi', `${wifi.mode === 'separate' ? 'Две сети' : 'Одна сеть'} · ${wifi.ssid_24 || 'имя не задано'} · WPA2/WPA3 · ${wifi.enabled === false ? 'выключена' : 'включена'}`, () => openSheet('Wi-Fi', wifiPanel)),
				launcher('Подключение к интернету', `${wisp.enabled ? 'Wi-Fi' : (wan.proto === 'pppoe' ? 'PPPoE' : 'DHCP')} · ${wan.up ? 'подключено' : 'нет соединения'}${wan.ipv4 ? ` · ${wan.ipv4}` : ''}`, () => openSheet('Подключение к интернету', internetPanel)),
				launcher('Расширение сети', `Локальная сеть · ${mesh.enabled ? 'Mesh включена' : 'Mesh-сеть'}`, () => openNetworkSheet('Расширение сети'))
			]),
			E('section', { 'class': 'oum-mobile-vpn-card' }, [
				E('header', {}, [ E('strong', {}, 'VPN-движок'), E('span', {}, vpnState) ]),
				E('div', { 'class': 'oum-mobile-vpn-current' }, [ E('span', { 'aria-hidden': 'true' }), E('strong', {}, engineTitle), E('small', {}, engineMissing ? 'не установлен' : 'активен') ]),
				E('div', { 'class': 'oum-mobile-vpn-actions' }, [
					E('button', { type: 'button' }, [vpnSvg(svgVpnRepeat), 'Заменить движок']),
					E('button', { type: 'button' }, [vpnSvg(svgVpnGlobe), 'DNS для VPN']),
					E('button', { type: 'button' }, [vpnSvg(svgVpnShield), 'Защита']),
					E('button', { type: 'button', disabled: (engines.current === 'openclash' || engines.current === 'podkop') ? null : '' }, [vpnSvg(svgVpnRefresh), 'Обновление'])
				])
			]),
			E('section', { 'class': 'oum-mobile-maintenance-hub' }, [
				E('h3', {}, 'Обслуживание OUM'),
				...maintenanceCards.map((card, index) => launcher(maintenanceTitles[index], maintenanceDescriptions[index], () => openSheet(maintenanceTitles[index], card), index === 3))
			])
		]);
		const vpnActions = mobileHub.querySelectorAll('.oum-mobile-vpn-actions button');
		vpnActions[0]?.addEventListener('click', () => openVpnSheet('VPN-движок'));
		vpnActions[1]?.addEventListener('click', () => openVpnSheet('DNS для VPN', 'dns'));
		vpnActions[2]?.addEventListener('click', () => openVpnSheet('Защищённое подключение', 'connection'));
		vpnActions[3]?.addEventListener('click', () => root.querySelector('#update-engine')?.click());
		page.insertBefore(mobileHub, root.querySelector('.oum-settings-grid'));
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
