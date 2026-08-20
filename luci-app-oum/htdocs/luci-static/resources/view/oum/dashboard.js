'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });
const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });
const callVpnJobStatus = rpc.declare({ object: 'oum', method: 'vpnJobStatus', expect: { '': {} } });
const callStartVpnImport = rpc.declare({
	object: 'oum', method: 'startVpnImport', params: [ 'vpn_type', 'payload' ], expect: { '': {} }
});

const sourceNames = { none: 'Не настроено', subscription: 'Subscription', awg: 'AWG Tunnel', proxy: 'Proxy' };

function sourceChoice(value, title, description, checked) {
	return E('label', { 'class': 'oum-source-choice' }, [
		E('input', { type: 'radio', name: 'vpn_source', value, checked: checked ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

return view.extend({
	load() { return Promise.all([ callStatus(), callDashboardStatus(), callVpnJobStatus() ]); },

	render(data) {
		const status = data[0];
		const dashboard = data[1];
		const initialJob = data[2];
		if (!status.setup_complete)
			return E('div', {}, [
				E('h2', {}, 'OUM'),
				E('p', {}, 'Сначала завершите базовую настройку роутера.'),
				E('a', { class: 'btn cbi-button-action', href: L.url('oum', 'setup') }, 'Открыть мастер')
			]);

		let selected = status.pending_source !== 'none' ? status.pending_source :
			(status.active_source !== 'none' ? status.active_source : 'subscription');

		const root = E('div', { 'class': 'oum-dashboard' }, [
			E('style', {}, `
				.oum-dashboard{max-width:1050px;margin:0 auto}.oum-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}
				.oum-card,.oum-panel{border:1px solid #ccd3dc;border-radius:12px;padding:16px}.oum-card small{display:block;opacity:.7;margin-bottom:8px}.oum-card strong{font-size:1.1rem}
				.oum-sources{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.oum-source-choice{display:flex;gap:10px;border:1px solid #ccd3dc;border-radius:10px;padding:14px;cursor:pointer}
				.oum-source-choice:has(input:checked){border-color:#1677ff;background:#edf5ff}.oum-source-choice span{display:flex;flex-direction:column;gap:5px}.oum-source-choice small{opacity:.72;line-height:1.4}
				.oum-input{margin:18px 0}.oum-input label{display:block;font-weight:600;margin-bottom:7px}.oum-input input,.oum-input textarea{width:100%;box-sizing:border-box}.oum-input textarea{min-height:180px;font-family:monospace}
				.oum-job{padding:12px;border-radius:8px;background:#eef4fa;margin:14px 0}.oum-job[data-state="failed"]{background:#ffe9e7}.oum-job[data-state="success"]{background:#e6f7eb}
				.oum-clients{width:100%;border-collapse:collapse}.oum-clients th,.oum-clients td{text-align:left;padding:9px 7px;border-bottom:1px solid #e1e5ea}.oum-clients th{opacity:.7;font-size:.9em}
				.oum-muted{opacity:.68}.oum-panels{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px}
				@media(max-width:850px){.oum-cards{grid-template-columns:1fr 1fr}}@media(max-width:700px){.oum-cards,.oum-sources{grid-template-columns:1fr}.oum-clients .optional{display:none}}
			`),
			E('h2', {}, 'OUM'),
			E('div', { 'class': 'oum-cards' }, [
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Интернет'), E('strong', { id: 'wan-state' }, ''), E('div', { id: 'wan-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Клиенты'), E('strong', { id: 'client-count' }, '0'), E('div', { id: 'wifi-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Температура'), E('strong', { id: 'thermal-state' }, '—'), E('div', { 'class': 'oum-muted' }, 'Максимум по датчикам') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'VPN-профиль'), E('strong', { id: 'active-source' }, sourceNames[dashboard.active_source] || dashboard.active_source) ])
			]),
			E('div', { 'class': 'oum-panels' }, [
				E('section', { 'class': 'oum-panel' }, [
					E('h3', {}, 'Подключённые устройства'),
					E('table', { 'class': 'oum-clients' }, [
						E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'IP-адрес'), E('th', {}, 'Подключение'), E('th', { 'class': 'optional' }, 'MAC') ])),
						E('tbody', { id: 'client-list' })
					])
				])
			]),
			E('section', { 'class': 'oum-panel' }, [
				E('h3', {}, 'Защищённое подключение'),
				E('p', {}, 'Новый источник полностью заменяет предыдущий OUM-профиль. При ошибке старый профиль восстанавливается.'),
				E('div', { 'class': 'oum-sources' }, [
					sourceChoice('subscription', 'Subscription', 'Ссылка на набор серверов', selected === 'subscription'),
					sourceChoice('awg', 'AWG Tunnel', 'Конфигурация AmneziaWG', selected === 'awg'),
					sourceChoice('proxy', 'Proxy', 'VLESS Reality или Hysteria2', selected === 'proxy')
				]),
				E('div', { 'class': 'oum-input' }, [
					E('label', { id: 'source-label' }, ''),
					E('input', { id: 'subscription-input', type: 'url', autocomplete: 'off', spellcheck: 'false' }),
					E('textarea', { id: 'config-input', autocomplete: 'off', spellcheck: 'false', hidden: '' })
				]),
				E('div', { 'class': 'oum-job', id: 'job-status', 'data-state': initialJob.state || 'idle' }, initialJob.message || 'Готово к добавлению подключения.'),
				E('button', { 'class': 'btn cbi-button-action', id: 'import-source' }, 'Проверить и активировать')
			])
		]);

		const jobNode = root.querySelector('#job-status');
		const button = root.querySelector('#import-source');
		const urlInput = root.querySelector('#subscription-input');
		const configInput = root.querySelector('#config-input');
		const label = root.querySelector('#source-label');

		const updateDashboard = (fresh) => {
			root.querySelector('#wan-state').textContent = fresh.wan?.up ? 'Подключён' : 'Нет соединения';
			root.querySelector('#wan-detail').textContent = fresh.wan?.ipv4 ? `${fresh.wan.ipv4} · ${String(fresh.wan.proto || '').toUpperCase()}` : String(fresh.wan?.proto || '').toUpperCase();
			root.querySelector('#client-count').textContent = String(fresh.clients?.length || 0);
			const ssids = Array.from(new Set((fresh.wifi || []).map((item) => item.ssid)));
			root.querySelector('#wifi-detail').textContent = ssids.length ? ssids.join(' · ') : 'Wi-Fi выключен';
			root.querySelector('#thermal-state').textContent = fresh.thermal?.maximum != null ? `${Math.round(fresh.thermal.maximum)} °C` : 'Нет данных';
			root.querySelector('#active-source').textContent = sourceNames[fresh.active_source] || fresh.active_source;
			const body = root.querySelector('#client-list');
			body.replaceChildren(...(fresh.clients || []).map((client) => E('tr', {}, [
				E('td', {}, client.name), E('td', {}, client.ip),
				E('td', {}, client.medium === 'wifi' ? 'Wi-Fi' : 'Кабель'),
				E('td', { 'class': 'optional' }, client.mac)
			])));
			if (!fresh.clients?.length)
				body.appendChild(E('tr', {}, E('td', { colspan: 4, 'class': 'oum-muted' }, 'Нет активных DHCP-клиентов')));
		};

		const updateInput = () => {
			selected = root.querySelector('[name="vpn_source"]:checked')?.value || 'subscription';
			urlInput.hidden = selected !== 'subscription';
			configInput.hidden = selected === 'subscription';
			label.textContent = selected === 'subscription' ? 'Ссылка подписки' :
				(selected === 'awg' ? 'Вставьте AWG-конфигурацию целиком' : 'Вставьте одну или несколько proxy-ссылок');
			configInput.placeholder = selected === 'awg' ? '[Interface]\nPrivateKey = …\n…' : 'vless://…';
		};

		const showJob = (job) => {
			jobNode.dataset.state = job.state || 'idle';
			jobNode.textContent = job.message || job.state || 'Ожидание';
			button.disabled = job.state === 'running';
		};

		const watchJob = () => callVpnJobStatus().then((job) => {
			showJob(job);
			if (job.state === 'running')
				window.setTimeout(watchJob, 2000);
			else if (job.state === 'success')
				callStatus().then((fresh) => {
					root.querySelector('#active-source').textContent = sourceNames[fresh.active_source] || fresh.active_source;
				});
		}).catch((err) => {
			showJob({ state: 'failed', message: err.message });
			button.disabled = false;
		});

		root.addEventListener('change', (ev) => {
			if (ev.target.name === 'vpn_source') updateInput();
		});

		button.addEventListener('click', (ev) => {
			ev.preventDefault();
			const payload = (selected === 'subscription' ? urlInput.value : configInput.value).trim();
			if (!payload)
				return ui.addNotification(null, E('p', {}, 'Введите данные подключения.'), 'warning');
			button.disabled = true;
			showJob({ state: 'running', message: 'Запускаем безопасный импорт…' });
			callStartVpnImport(selected, payload).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось запустить импорт.');
				urlInput.value = '';
				configInput.value = '';
				watchJob();
			}).catch((err) => {
				showJob({ state: 'failed', message: err.message });
				button.disabled = false;
			});
		});

		updateInput();
		updateDashboard(dashboard);
		poll.add(() => callDashboardStatus().then(updateDashboard), 10);
		if (initialJob.state === 'running') watchJob(); else showJob(initialJob);
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
