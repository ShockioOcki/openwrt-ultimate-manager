'use strict';
'require baseclass';
'require ui';

// This navigation belongs only to OUM. Native LuCI navigation belongs to Proton.
return baseclass.extend({
	__init__: function() {
		ui.menu.load().then(function(tree) {
			const menu = document.querySelector('#topmenu');
			if (!menu || !tree.children?.oum) return;
			const active = L.env.dispatchpath[1];
			menu.replaceChildren(...ui.menu.getChildren(tree.children.oum).filter(function(item) {
				return item.title && !item.firstchild_ineligible;
			}).map(function(item) {
				return E('li', { 'class': item.name === active ? 'active open' : '' }, [
					E('a', { href: L.url('oum', item.name), 'aria-current': item.name === active ? 'page' : null }, _(item.title))
				]);
			}));
			menu.style.display = '';
		});
	}
});
