'use strict';
'require baseclass';
'require ui';

var MODE_ICONS = {
	status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
	system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
	services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
	network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
	vpn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

return baseclass.extend({
	__init__: function() {
		ui.menu.load().then(L.bind(this.render, this));
	},

	render: function(tree) {
		var node = tree;
		var url = '';

		this.renderModeMenu(tree);

		if (L.env.dispatchpath.length >= 3) {
			for (var i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url += (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}
	},

	renderTabMenu: function(tree, url, level) {
		var container = document.querySelector('#tabmenu');
		var ul = E('ul', { 'class': 'tabs' });
		var children = ui.menu.getChildren(tree);
		var activeNode = null;

		children.forEach(function(child) {
			var active = L.env.dispatchpath[3 + (level || 0)] === child.name;
			ul.appendChild(E('li', { 'class': active ? 'active' : '' }, [
				E('a', { href: L.url(url, child.name) }, [ _(child.title) ])
			]));
			if (active) activeNode = child;
		});

		if (!ul.children.length) return E([]);
		container.appendChild(ul);
		container.style.display = '';
		if (activeNode) this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);
		return ul;
	},

	renderMainMenu: function(tree, url, level) {
		var nested = !!level;
		var ul = nested ? E('ul', { 'class': 'dropdown-menu' }) : document.querySelector('#topmenu');
		var children = ui.menu.getChildren(tree);
		var activeName = L.env.dispatchpath[(level || 0) + 1];

		if (!children.length || level > 1) return E([]);

		children.forEach(L.bind(function(child) {
			if (!nested && child.name === 'logout') return;
			var submenu = this.renderMainMenu(child, url + '/' + child.name, (level || 0) + 1);
			var hasChildren = !!submenu.firstElementChild;
			var active = child.name === activeName;
			var link = E('a', { href: hasChildren ? '#' : L.url(url, child.name) }, [ _(child.title) ]);
			var li = E('li', { 'class': (hasChildren ? 'dropdown ' : '') + (active ? 'active open' : '') }, [ link, submenu ]);

			if (!nested && hasChildren) {
				if (MODE_ICONS[child.name]) {
					var ico = E('span', { 'class': 'oum-mode-ico', 'aria-hidden': 'true' });
					ico.innerHTML = MODE_ICONS[child.name];
					link.insertBefore(ico, link.firstChild);
				}
				link.addEventListener('click', function(event) {
					event.preventDefault();
					var willOpen = !li.classList.contains('open');
					var sibs = ul.querySelectorAll(':scope > li.dropdown.open');
					for (var i = 0; i < sibs.length; i++)
						if (sibs[i] !== li) sibs[i].classList.remove('open');
					li.classList.toggle('open', willOpen);
				});
			}

			ul.appendChild(li);
		}, this));

		ul.style.display = '';
		return ul;
	},

	renderModeMenu: function(tree) {
		var ul = document.querySelector('#modemenu');
		var children = ui.menu.getChildren(tree);

		children.forEach(L.bind(function(child, index) {
			var active = L.env.requestpath.length ? child.name === L.env.requestpath[0] : index === 0;
			ul.appendChild(E('li', { 'class': active ? 'active' : '' }, [
				E('a', { href: L.url(child.name) }, [ _(child.title) ])
			]));
			if (active) this.renderMainMenu(child, child.name, 0);
		}, this));

		if (ul.children.length > 1) ul.style.display = '';
	}
});
