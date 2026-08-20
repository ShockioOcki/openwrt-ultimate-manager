'use strict';
'require view';
'require rpc';
'require poll';

const callStatus = rpc.declare({ object: 'oum', method: 'status', expect: { '': {} } });
const callDashboardStatus = rpc.declare({ object: 'oum', method: 'dashboardStatus', expect: { '': {} } });
const callNodeStatus = rpc.declare({ object: 'oum', method: 'nodeStatus', expect: { '': {} } });
const callMeasureNodeDelays = rpc.declare({ object: 'oum', method: 'measureNodeDelays', expect: { '': {} } });
const callSelectNode = rpc.declare({ object: 'oum', method: 'selectNode', params: [ 'name' ], expect: { '': {} } });
const callSetVpnEnabled = rpc.declare({ object: 'oum', method: 'setVpnEnabled', params: [ 'enabled' ], expect: { '': {} } });
const callSetDevicePolicy = rpc.declare({ object: 'oum', method: 'setDevicePolicy', params: [ 'mac', 'policy' ], expect: { '': {} } });
const callVpnJobStatus = rpc.declare({ object: 'oum', method: 'vpnJobStatus', expect: { '': {} } });
const callStartVpnImport = rpc.declare({
	object: 'oum', method: 'startVpnImport', params: [ 'vpn_type', 'payload' ], expect: { '': {} }
});

const sourceNames = { none: 'Не настроено', subscription: 'Subscription', awg: 'AWG Tunnel', proxy: 'Proxy' };

function countryKey(name) {
	const flag = String(name).match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
	if (flag)
		return Array.from(flag[0]).map((symbol) =>
			String.fromCharCode(65 + symbol.codePointAt(0) - 0x1F1E6)).join('');
	const normalized = String(name).toLowerCase();
	if (/(?:финлянд|finland|helsinki)/.test(normalized)) return 'FI';
	if (/(?:нидерланд|netherland|holland|amsterdam)/.test(normalized)) return 'NL';
	const code = String(name).match(/(?:^|[\s_|+\-])([A-Z]{2})(?:$|[\s_|+\-])/);
	return code ? code[1] : '';
}

function sortedNodes(nodes) {
	return (nodes || []).slice().sort((a, b) => {
		const ad = a.delay > 0 ? a.delay : Number.MAX_SAFE_INTEGER;
		const bd = b.delay > 0 ? b.delay : Number.MAX_SAFE_INTEGER;
		return ad - bd || a.name.localeCompare(b.name);
	});
}

function preferredNodes(nodeStatus) {
	const sorted = sortedNodes(nodeStatus.nodes).filter((node) => node.name !== nodeStatus.current);
	const result = [], countries = new Set();
	for (const required of [ 'FI', 'NL' ]) {
		const node = sorted.find((candidate) => countryKey(candidate.name) === required);
		if (!node) continue;
		result.push(node);
		countries.add(required);
	}
	for (const node of sorted) {
		if (result.includes(node)) continue;
		const country = countryKey(node.name);
		if (country && countries.has(country)) continue;
		result.push(node);
		if (country) countries.add(country);
		if (result.length === 5) return result;
	}
	for (const node of sorted) {
		if (!result.includes(node)) result.push(node);
		if (result.length === 5) break;
	}
	return result;
}

function sourceChoice(value, title, description, checked) {
	return E('label', { 'class': 'oum-source-choice' }, [
		E('input', { type: 'radio', name: 'vpn_source', value, checked: checked ? '' : null }),
		E('span', {}, [ E('strong', {}, title), E('small', {}, description) ])
	]);
}

function policySelect(client) {
	return E('select', { 'class': 'oum-policy', 'data-mac': client.mac }, [
		E('option', { value: 'default', selected: client.policy === 'default' ? '' : null }, 'По общим правилам'),
		E('option', { value: 'direct', selected: client.policy === 'direct' ? '' : null }, 'Всегда напрямую'),
		E('option', { value: 'vpn', selected: client.policy === 'vpn' ? '' : null }, 'Полностью через VPN')
	]);
}

return view.extend({
	load() { return Promise.all([ callStatus(), callDashboardStatus(), callVpnJobStatus(), callNodeStatus() ]); },

	render(data) {
		const status = data[0];
		const dashboard = data[1];
		const initialJob = data[2];
		const initialNodes = data[3];
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
				.oum-card,.oum-panel{border:1px solid #ccd3dc;border-radius:12px;padding:16px}.oum-card small{display:block;opacity:.7;margin-bottom:8px}.oum-card strong{font-size:1.1rem}.oum-vpn-card-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.oum-vpn-card-row button{padding:4px 9px}.oum-card-message{font-size:.82em;margin-top:7px;min-height:1.2em}
				.oum-sources{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.oum-source-choice{display:flex;gap:10px;border:1px solid #ccd3dc;border-radius:10px;padding:14px;cursor:pointer}
				.oum-source-choice:has(input:checked){border-color:#1677ff;background:#edf5ff}.oum-source-choice span{display:flex;flex-direction:column;gap:5px}.oum-source-choice small{opacity:.72;line-height:1.4}
				.oum-input{margin:18px 0}.oum-input label{display:block;font-weight:600;margin-bottom:7px}.oum-input input,.oum-input textarea{width:100%;box-sizing:border-box}.oum-input textarea{min-height:180px;font-family:monospace}
				.oum-job{padding:12px;border-radius:8px;background:#eef4fa;margin:14px 0}.oum-job[data-state="failed"]{background:#ffe9e7}.oum-job[data-state="success"]{background:#e6f7eb}
				.oum-clients{width:100%;border-collapse:collapse}.oum-clients th,.oum-clients td{text-align:left;padding:9px 7px;border-bottom:1px solid #e1e5ea}.oum-clients th{opacity:.7;font-size:.9em}.oum-policy{min-width:180px}.oum-policy-message{min-height:1.4em;margin-top:10px}.oum-policy-message[data-state="failed"]{color:#c0392b}
				.oum-muted{opacity:.68}.oum-panels{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px}
				.oum-node-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.oum-current-node{padding:13px;border-radius:9px;background:#eef4fa;margin:10px 0 8px}.oum-node-list{display:grid;gap:8px}
				.oum-node{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #d8dde5;border-radius:9px}.oum-delay{min-width:70px;text-align:right}
				.oum-node-title{font-weight:600;margin:14px 0 9px}.oum-node-message{min-height:1.4em;margin:6px 0}.oum-node-message[data-state="failed"]{color:#c0392b}
				.oum-node-all{margin-top:13px}.oum-node-all>summary,.oum-protected>summary{cursor:pointer;font-weight:600}.oum-node-all>summary{padding:4px 0}.oum-node-all[open]>summary{margin-bottom:10px}
				.oum-protected{margin-bottom:14px}.oum-protected>summary{font-size:1.15rem}.oum-protected[open]>summary{margin-bottom:14px}.oum-protected-content{border-top:1px solid #d8dde5;padding-top:2px}
				@media(max-width:850px){.oum-cards{grid-template-columns:1fr 1fr}}@media(max-width:700px){.oum-cards,.oum-sources{grid-template-columns:1fr}.oum-clients .optional{display:none}}
			`),
			E('h2', {}, 'OUM'),
			E('div', { 'class': 'oum-cards' }, [
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Интернет'), E('strong', { id: 'wan-state' }, ''), E('div', { id: 'wan-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Клиенты'), E('strong', { id: 'client-count' }, '0'), E('div', { id: 'wifi-detail', 'class': 'oum-muted' }, '') ]),
				E('div', { 'class': 'oum-card' }, [ E('small', {}, 'Температура'), E('strong', { id: 'thermal-state' }, '—'), E('div', { 'class': 'oum-muted' }, 'Максимум по датчикам') ]),
				E('div', { 'class': 'oum-card' }, [
					E('small', {}, 'VPN-профиль'),
					E('div', { 'class': 'oum-vpn-card-row' }, [
						E('strong', { id: 'active-source' }, sourceNames[dashboard.active_source] || dashboard.active_source),
						E('button', { 'class': 'btn cbi-button', id: 'vpn-toggle' }, '')
					]),
					E('div', { 'class': 'oum-card-message oum-muted', id: 'vpn-control-message' }, '')
				])
			]),
			E('div', { 'class': 'oum-panels' }, [
				E('section', { 'class': 'oum-panel' }, [
					E('h3', {}, 'Подключённые устройства'),
					E('table', { 'class': 'oum-clients' }, [
						E('thead', {}, E('tr', {}, [ E('th', {}, 'Имя'), E('th', {}, 'IP-адрес'), E('th', {}, 'Подключение'), E('th', { 'class': 'optional' }, 'MAC'), E('th', {}, 'Маршрутизация') ])),
						E('tbody', { id: 'client-list' })
					]),
					E('div', { 'class': 'oum-policy-message oum-muted', id: 'policy-message' }, 'Режим применяется к выбранному устройству и сохраняется после перезагрузки.')
				]),
				E('section', { 'class': 'oum-panel', id: 'node-panel', hidden: '' }, [
					E('div', { 'class': 'oum-node-head' }, [
						E('h3', {}, 'VPN-нода'),
						E('button', { 'class': 'btn cbi-button', id: 'measure-nodes' }, 'Обновить ping')
					]),
					E('div', { 'class': 'oum-current-node', id: 'current-node' }, 'Нет активной ноды'),
					E('div', { 'class': 'oum-node-message oum-muted', id: 'node-message' }),
					E('div', { 'class': 'oum-node-title' }, 'Быстрый доступ'),
					E('div', { 'class': 'oum-node-list', id: 'node-list' }),
					E('details', { 'class': 'oum-node-all' }, [
						E('summary', { id: 'all-nodes-summary' }, 'Все ноды'),
						E('div', { 'class': 'oum-node-list', id: 'all-node-list' })
					])
				])
			]),
			E('details', {
				'class': 'oum-panel oum-protected',
				open: status.pending_source !== 'none' && status.active_source === 'none' ? '' : null
			}, [
				E('summary', {}, 'Защищённое подключение'),
				E('div', { 'class': 'oum-protected-content' }, [
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
			])
		]);

		const jobNode = root.querySelector('#job-status');
		const button = root.querySelector('#import-source');
		const urlInput = root.querySelector('#subscription-input');
		const configInput = root.querySelector('#config-input');
		const label = root.querySelector('#source-label');
		const nodePanel = root.querySelector('#node-panel');
		const nodeList = root.querySelector('#node-list');
		const allNodeList = root.querySelector('#all-node-list');
		const nodeMessage = root.querySelector('#node-message');
		const measureButton = root.querySelector('#measure-nodes');
		const vpnToggle = root.querySelector('#vpn-toggle');
		const vpnControlMessage = root.querySelector('#vpn-control-message');
		const policyMessage = root.querySelector('#policy-message');
		let vpnEnabled = dashboard.vpn_enabled === true;
		let vpnWatchTimer = null;

		const updateDashboard = (fresh) => {
			root.querySelector('#wan-state').textContent = fresh.wan?.up ? 'Подключён' : 'Нет соединения';
			root.querySelector('#wan-detail').textContent = fresh.wan?.ipv4 ? `${fresh.wan.ipv4} · ${String(fresh.wan.proto || '').toUpperCase()}` : String(fresh.wan?.proto || '').toUpperCase();
			root.querySelector('#client-count').textContent = String(fresh.clients?.length || 0);
			const ssids = Array.from(new Set((fresh.wifi || []).map((item) => item.ssid)));
			root.querySelector('#wifi-detail').textContent = ssids.length ? ssids.join(' · ') : 'Wi-Fi выключен';
			root.querySelector('#thermal-state').textContent = fresh.thermal?.maximum != null ? `${Math.round(fresh.thermal.maximum)} °C` : 'Нет данных';
			root.querySelector('#active-source').textContent = sourceNames[fresh.active_source] || fresh.active_source;
			vpnEnabled = fresh.vpn_enabled === true;
			vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
			vpnToggle.disabled = fresh.active_source === 'none' || (vpnEnabled && fresh.vpn_ready !== true);
			vpnControlMessage.textContent = !vpnEnabled ? 'VPN выключен' :
				(fresh.vpn_ready === true ? 'VPN работает' : 'VPN запускается…');
			const body = root.querySelector('#client-list');
			body.replaceChildren(...(fresh.clients || []).map((client) => E('tr', {}, [
				E('td', {}, client.name), E('td', {}, client.ip),
				E('td', {}, client.medium === 'wifi' ? 'Wi-Fi' : 'Кабель'),
				E('td', { 'class': 'optional' }, client.mac),
				E('td', {}, policySelect(client))
			])));
			if (!fresh.clients?.length)
				body.appendChild(E('tr', {}, E('td', { colspan: 5, 'class': 'oum-muted' }, 'Нет активных DHCP-клиентов')));
		};

		const updateNodes = (fresh) => {
			nodePanel.hidden = !fresh.available;
			if (!fresh.available) return;
			const makeNode = (node, isCurrent) => E('div', { 'class': 'oum-node' }, [
				E('span', {}, node.name),
				E('span', { 'class': 'oum-delay' }, node.delay > 0 ? `${node.delay} ms` : 'offline'),
				E('button', {
					'class': 'btn cbi-button', 'data-node': isCurrent ? null : node.name,
					disabled: isCurrent ? '' : null
				}, isCurrent ? 'Активна' : 'Выбрать')
			]);
			const current = (fresh.nodes || []).find((node) => node.name === fresh.current);
			root.querySelector('#current-node').textContent = current ?
				`${current.name} · ${current.delay > 0 ? `${current.delay} ms` : 'ping не измерен'}` : (fresh.current || 'Не выбрана');
			nodeList.replaceChildren(...preferredNodes(fresh).map((node) => makeNode(node, false)));
			if (!nodeList.children.length)
				nodeList.appendChild(E('div', { 'class': 'oum-muted' }, 'Других нод в профиле нет.'));
			const all = sortedNodes(fresh.nodes);
			root.querySelector('#all-nodes-summary').textContent = `Все ноды (${all.length})`;
			allNodeList.replaceChildren(...all.map((node) => makeNode(node, node.name === fresh.current)));
		};

		const showNodeMessage = (message, failed) => {
			nodeMessage.textContent = message || '';
			nodeMessage.dataset.state = failed ? 'failed' : 'idle';
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
				Promise.all([ callStatus(), callNodeStatus() ]).then(([fresh, nodes]) => {
					root.querySelector('#active-source').textContent = sourceNames[fresh.active_source] || fresh.active_source;
					updateNodes(nodes);
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
			if (!payload) {
				showJob({ state: 'failed', message: 'Введите данные подключения.' });
				return;
			}
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

		measureButton.addEventListener('click', (ev) => {
			ev.preventDefault();
			measureButton.disabled = true;
			measureButton.textContent = 'Измеряем…';
			callMeasureNodeDelays().then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось измерить ping.');
				return callNodeStatus();
			}).then((nodes) => {
				updateNodes(nodes);
				showNodeMessage('Ping нод обновлён.', false);
			}).catch((err) => showNodeMessage(err.message, true)).finally(() => {
				measureButton.disabled = false;
				measureButton.textContent = 'Обновить ping';
			});
		});

		vpnToggle.addEventListener('click', (ev) => {
			ev.preventDefault();
			vpnToggle.disabled = true;
			vpnControlMessage.textContent = vpnEnabled ? 'Отключаем VPN…' : 'Запускаем VPN…';
			callSetVpnEnabled(!vpnEnabled).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось изменить состояние VPN.');
				vpnEnabled = result.enabled === true;
				vpnToggle.textContent = vpnEnabled ? 'Отключить' : 'Включить';
				vpnControlMessage.textContent = result.message || 'Состояние изменено.';
				let attempts = 0;
				const wanted = vpnEnabled;
				const watch = () => callDashboardStatus().then((fresh) => {
					updateDashboard(fresh);
					const ready = wanted ? fresh.vpn_ready === true : fresh.vpn_ready !== true;
					if (!ready)
						vpnToggle.disabled = true;
					if (!ready && attempts++ < 45)
						vpnWatchTimer = window.setTimeout(watch, 1000);
					else if (!ready) {
						vpnControlMessage.textContent = 'Сервис не подтвердил готовность.';
						vpnToggle.disabled = false;
					}
				}).catch((err) => {
					vpnControlMessage.textContent = err.message;
					vpnToggle.disabled = false;
				});
				if (vpnWatchTimer) window.clearTimeout(vpnWatchTimer);
				return watch();
			}).catch((err) => {
				vpnControlMessage.textContent = err.message;
				vpnToggle.disabled = false;
			});
		});

		root.querySelector('#client-list').addEventListener('change', (ev) => {
			const target = ev.target.closest('[data-mac]');
			if (!target) return;
			target.disabled = true;
			policyMessage.dataset.state = 'idle';
			policyMessage.textContent = 'Сохраняем режим и обновляем маршрутизацию…';
			callSetDevicePolicy(target.dataset.mac, target.value).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось изменить маршрутизацию.');
				policyMessage.textContent = result.message || 'Настройка сохранена.';
			}).catch((err) => {
				policyMessage.dataset.state = 'failed';
				policyMessage.textContent = err.message;
				return callDashboardStatus().then(updateDashboard);
			}).finally(() => { target.disabled = false; });
		});

		nodePanel.addEventListener('click', (ev) => {
			const target = ev.target.closest('[data-node]');
			if (!target) return;
			target.disabled = true;
			callSelectNode(target.dataset.node).then((result) => {
				if (!result.ok) throw new Error(result.message || 'Не удалось переключить ноду.');
				return callNodeStatus();
			}).then((nodes) => {
				updateNodes(nodes);
				showNodeMessage('Нода переключена.', false);
			}).catch((err) => showNodeMessage(err.message, true)).finally(() => { target.disabled = false; });
		});

		updateInput();
		updateDashboard(dashboard);
		updateNodes(initialNodes);
		poll.add(() => Promise.all([ callDashboardStatus(), callNodeStatus() ]).then(([fresh, nodes]) => {
			updateDashboard(fresh);
			updateNodes(nodes);
		}), 10);
		if (initialJob.state === 'running') watchJob(); else showJob(initialJob);
		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
