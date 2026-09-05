'use strict';
'require baseclass';
'require ui';

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
				link.addEventListener('click', function(event) {
					event.preventDefault();
					li.classList.toggle('open');
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
