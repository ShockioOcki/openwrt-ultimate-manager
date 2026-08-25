'use strict';
'require view';
'require rpc';
'require ui';

const callStatus = rpc.declare({
	object: 'oum',
	method: 'status',
	expect: { '': {} }
});

const callApplySetup = rpc.declare({
	object: 'oum',
	method: 'applySetup',
	params: [
		'wan_type', 'pppoe_user', 'pppoe_password', 'wifi_mode',
		'ssid_24', 'ssid_5', 'wifi_password', 'admin_password', 'vpn_type'
	],
	expect: { '': {} }
});

function field(name) {
	return document.querySelector(`[name="${name}"]`);
}

function value(name) {
	return field(name)?.value?.trim() ?? '';
}

function selected(name) {
	return document.querySelector(`[name="${name}"]:checked`)?.value ?? '';
}

function show(selector, yes) {
	const node = document.querySelector(selector);
	if (node)
		node.hidden = !yes;
}

function cardRadio(name, radioValue, title, description) {
	return E('label', { 'class': 'oum-choice' }, [
		E('input', { 'type': 'radio', 'name': name, 'value': radioValue }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

return view.extend({
	load() {
		return callStatus();
	},

	render(status) {
		if (status.setup_complete)
			return E('div', { 'class': 'oum-shell' }, [
				E('h2', {}, 'Роутер уже настроен'),
				E('p', {}, 'Мастер первого запуска завершён. Откройте главную страницу OUM.'),
				E('a', { 'class': 'btn cbi-button-action', 'href': L.url('oum', 'dashboard') }, 'Перейти на главную')
			]);

		const root = E('div', { 'class': 'oum-shell' }, [
			E('style', {}, `
				.oum-shell{max-width:900px;margin:0 auto}.oum-progress{display:flex;gap:8px;margin:18px 0 24px}
				.oum-progress span{height:6px;flex:1;background:#d7dde6;border-radius:5px}.oum-progress span.active{background:#1677ff}
				.oum-step[hidden],.oum-extra[hidden]{display:none}.oum-choice{display:flex;gap:12px;padding:15px;margin:10px 0;border:1px solid #ccd3dc;border-radius:10px;cursor:pointer}
				.oum-choice:has(input:checked){border-color:#1677ff;background:#edf5ff}.oum-choice input{margin-top:4px}.oum-choice span{display:flex;flex-direction:column;gap:5px}.oum-choice small{opacity:.75;line-height:1.45}
				.oum-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.oum-field{margin:14px 0}.oum-field label{display:block;font-weight:600;margin-bottom:6px}.oum-field input{width:100%;box-sizing:border-box}
				.oum-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px}.oum-note{padding:12px 14px;border-radius:8px;background:#eef4fa;line-height:1.45}.oum-warn{background:#fff4df}
				@media(max-width:650px){.oum-grid{grid-template-columns:1fr}.oum-shell{padding:0 4px}}
			`),
			E('h2', {}, 'Добро пожаловать в OUM'),
			E('p', {}, 'Четыре понятных шага — и роутер готов к работе.'),
			E('div', { 'class': 'oum-progress' }, [1,2,3,4].map((n) => E('span', { 'data-progress': n }))),

			E('section', { 'class': 'oum-step', 'data-step': 1 }, [
				E('h3', {}, '1. Подключение к интернету'),
				E('p', {}, 'Выберите данные, которые выдал интернет-провайдер.'),
				cardRadio('wan_type', 'dhcp', 'Прямое подключение (DHCP)', 'Логин и пароль не нужны. Обычно кабель провайдера просто подключается в WAN-порт.'),
				cardRadio('wan_type', 'pppoe', 'PPPoE', 'Провайдер выдал отдельные логин и пароль для подключения.'),
				E('div', { 'id': 'pppoe-fields', 'class': 'oum-extra', 'hidden': '' }, [
					E('div', { 'class': 'oum-grid' }, [
						E('div', { 'class': 'oum-field' }, [E('label', {}, 'Логин PPPoE'), E('input', { 'name': 'pppoe_user', 'autocomplete': 'username' })]),
						E('div', { 'class': 'oum-field' }, [E('label', {}, 'Пароль PPPoE'), E('input', { 'name': 'pppoe_password', 'type': 'password', 'autocomplete': 'current-password' })])
					])
				]),
				E('p', { 'class': 'oum-note' }, 'Не знаете тип? Уточните его у поддержки провайдера. Для подключения за другим роутером вставьте кабель из свободного LAN-порта основного роутера в WAN-порт этого роутера и выберите DHCP.')
			]),

			E('section', { 'class': 'oum-step', 'data-step': 2, 'hidden': '' }, [
				E('h3', {}, '2. Настройка Wi-Fi'),
				cardRadio('wifi_mode', 'smart', 'Одна сеть (рекомендуется)', 'Одинаковое имя для 2,4 и 5 ГГц. Телефон сам выбирает подходящий диапазон.'),
				cardRadio('wifi_mode', 'separate', 'Две отдельные сети', 'Разные имена диапазонов позволяют вручную выбирать дальность 2,4 ГГц или скорость 5 ГГц.'),
				E('div', { 'class': 'oum-grid' }, [
					E('div', { 'class': 'oum-field' }, [E('label', { 'id': 'ssid24-label' }, 'Имя Wi-Fi'), E('input', { 'name': 'ssid_24', 'maxlength': 32, 'placeholder': 'Домашний Wi-Fi' })]),
					E('div', { 'class': 'oum-field', 'id': 'ssid5-wrap', 'hidden': '' }, [E('label', {}, 'Имя сети 5 ГГц'), E('input', { 'name': 'ssid_5', 'maxlength': 32, 'placeholder': 'Домашний Wi-Fi 5G' })])
				]),
				E('div', { 'class': 'oum-grid' }, [
					E('div', { 'class': 'oum-field' }, [E('label', {}, 'Пароль Wi-Fi'), E('input', { 'name': 'wifi_password', 'type': 'password', 'minlength': 8, 'maxlength': 63, 'autocomplete': 'new-password' })]),
					E('div', { 'class': 'oum-field' }, [E('label', {}, 'Повторите пароль'), E('input', { 'name': 'wifi_password_confirm', 'type': 'password', 'minlength': 8, 'maxlength': 63, 'autocomplete': 'new-password' })])
				]),
				E('p', { 'class': 'oum-note' }, 'Будут включены WPA2/WPA3 mixed и регион US. Минимальная длина пароля для этого режима — 8 символов.')
			]),

			E('section', { 'class': 'oum-step', 'data-step': 3, 'hidden': '' }, [
				E('h3', {}, '3. Защищённое подключение'),
				cardRadio('vpn_type', 'subscription', 'Subscription', 'Ссылка провайдера на набор серверов. Позже можно выбирать страну и ноду в панели OUM.'),
				cardRadio('vpn_type', 'awg', 'AWG Tunnel', 'Конфигурация AmneziaWG — быстрый отдельный туннель.'),
				cardRadio('vpn_type', 'proxy', 'Reality / Proxy', 'Одиночная ссылка VLESS Reality, Hysteria2 или другой поддерживаемый прокси.'),
				cardRadio('vpn_type', 'none', 'Пропустить', 'Добавить защищённое подключение можно позже.'),
				E('p', { 'class': 'oum-note' }, 'После применения базовых настроек и переподключения OUM откроет безопасную форму выбранного типа. Новый источник всегда создаёт один профиль и полностью заменяет предыдущий.')
			]),

			E('section', { 'class': 'oum-step', 'data-step': 4, 'hidden': '' }, [
				E('h3', {}, '4. Защита панели'),
				E('p', {}, 'Временный пароль admin больше использоваться не будет. Задайте новый пароль панели управления.'),
				E('div', { 'class': 'oum-grid' }, [
					E('div', { 'class': 'oum-field' }, [E('label', {}, 'Новый пароль admin'), E('input', { 'name': 'admin_password', 'type': 'password', 'minlength': 6, 'autocomplete': 'new-password' })]),
					E('div', { 'class': 'oum-field' }, [E('label', {}, 'Повторите пароль'), E('input', { 'name': 'admin_password_confirm', 'type': 'password', 'minlength': 6, 'autocomplete': 'new-password' })])
				]),
				E('p', { 'class': 'oum-note' }, status.usb_present ? 'USB-накопитель обнаружен. Настройку NAS предложим после завершения базового мастера.' : 'USB-накопитель не обнаружен, поэтому шаг NAS сейчас пропущен.')
			]),

			E('div', { 'class': 'oum-actions' }, [
				E('button', { 'class': 'btn cbi-button', 'id': 'oum-back', 'disabled': '' }, 'Назад'),
				E('button', { 'class': 'btn cbi-button-action', 'id': 'oum-next' }, 'Продолжить')
			])
		]);

		let step = 1;
		const update = () => {
			root.querySelectorAll('.oum-step').forEach((n) => n.hidden = +n.dataset.step !== step);
			root.querySelectorAll('[data-progress]').forEach((n) => n.classList.toggle('active', +n.dataset.progress <= step));
			root.querySelector('#oum-back').disabled = step === 1;
			root.querySelector('#oum-next').textContent = step === 4 ? 'Применить настройки' : 'Продолжить';
		};

		const validateStep = () => {
			if (step === 1) {
				if (!selected('wan_type')) return 'Выберите тип подключения.';
				if (selected('wan_type') === 'pppoe' && (!value('pppoe_user') || !value('pppoe_password'))) return 'Введите логин и пароль PPPoE.';
			}
			if (step === 2) {
				if (!selected('wifi_mode')) return 'Выберите режим Wi-Fi.';
				if (!value('ssid_24') || (selected('wifi_mode') === 'separate' && !value('ssid_5'))) return 'Введите имя Wi-Fi.';
				if (value('wifi_password').length < 8) return 'Пароль Wi-Fi должен содержать минимум 8 символов.';
				if (value('wifi_password') !== value('wifi_password_confirm')) return 'Пароли Wi-Fi не совпадают.';
			}
			if (step === 3 && !selected('vpn_type')) return 'Выберите тип подключения или «Пропустить».';
			if (step === 4) {
				if (value('admin_password').length < 6) return 'Пароль панели должен содержать минимум 6 символов.';
				if (value('admin_password') !== value('admin_password_confirm')) return 'Пароли панели не совпадают.';
			}
			return null;
		};

		root.addEventListener('change', (ev) => {
			if (ev.target.name === 'wan_type') show('#pppoe-fields', ev.target.value === 'pppoe');
			if (ev.target.name === 'wifi_mode') {
				show('#ssid5-wrap', ev.target.value === 'separate');
				root.querySelector('#ssid24-label').textContent = ev.target.value === 'separate' ? 'Имя сети 2,4 ГГц' : 'Имя Wi-Fi';
			}
		});

		root.querySelector('#oum-back').addEventListener('click', (ev) => { ev.preventDefault(); step--; update(); });
		root.querySelector('#oum-next').addEventListener('click', (ev) => {
			ev.preventDefault();
			const error = validateStep();
			if (error) return ui.addNotification(null, E('p', {}, error), 'warning');
			if (step < 4) { step++; update(); return; }

			const smart = selected('wifi_mode') === 'smart';
			const networkNames = smart ? `«${value('ssid_24')}»` : `«${value('ssid_24')}» или «${value('ssid_5')}»`;
			const apply = () => {
				ui.showModal('Применяем настройки', [ E('p', { 'class': 'spinning' }, 'Сеть и Wi-Fi будут перезапущены…') ]);
				callApplySetup(
					selected('wan_type'), value('pppoe_user'), value('pppoe_password'), selected('wifi_mode'),
					value('ssid_24'), smart ? value('ssid_24') : value('ssid_5'), value('wifi_password'),
					value('admin_password'), selected('vpn_type')
				).then((result) => {
					if (!result.ok) throw new Error(result.message || 'Не удалось применить настройки.');
					ui.showModal('Настройка завершена', [
						E('p', {}, `Подключитесь к новой Wi-Fi сети ${networkNames}.`),
						E('p', {}, 'Затем снова откройте 192.168.1.1 и войдите как admin с новым паролем панели.'),
						E('a', { 'class': 'btn cbi-button-action', 'href': L.url('oum', 'dashboard') }, 'Открыть OUM после подключения')
					]);
				}).catch((err) => ui.showModal('Ошибка', [ E('p', {}, err.message), E('button', { 'class': 'btn', 'click': ui.hideModal }, 'Закрыть') ]));
			};

			ui.showModal('Wi-Fi будет перезапущен', [
				E('p', {}, `После применения текущая сеть FirstRun отключится. Подключитесь к новой сети ${networkNames}.`),
				E('p', { 'class': 'oum-note oum-warn' }, 'Запомните новое имя Wi-Fi и пароль. После переподключения откройте 192.168.1.1.'),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, 'Вернуться'),
					' ',
					E('button', { 'class': 'btn cbi-button-action important', 'click': apply }, 'Применить и переподключиться')
				])
			]);
		});

		update();
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
