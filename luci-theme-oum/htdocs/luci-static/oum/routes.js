/* Preserve native table nodes, sorting and polling; contain horizontal scroll. */
(() => {
 if (document.body.dataset.page !== 'admin-status-routesj') return;
 const main = document.getElementById('maincontent');
 function wrap() {
  for (const table of main.querySelectorAll('.cbi-section[data-tab] > table')) {
   const box = document.createElement('div'); box.className = 'oum-route-scroll';
   box.tabIndex = 0; box.setAttribute('role', 'region');
   box.setAttribute('aria-label', table.previousElementSibling?.textContent || 'Routing');
   table.before(box); box.append(table);
  }
 }
 new MutationObserver(wrap).observe(main, {childList:true, subtree:true}); wrap();
})();
