/* Presentation only; retain native init-script controls and listeners. */
(() => {
 if (document.body.dataset.page !== 'admin-system-startup') return;
 const main = document.getElementById('maincontent');
 if (!main) return;
 const expanded = new Set();
 function enhance() {
  main.querySelectorAll('[data-tab="init"] table tr').forEach(row => {
   const cells = row.querySelectorAll(':scope > td');
   if (cells.length !== 3 || row.querySelector('.oum-startup-toggle')) return;
   const buttons = cells[2].querySelectorAll('button');
   if (buttons.length !== 5) return;
   const name = cells[1].textContent.trim();
   const original = document.createElement('span'); original.className = 'oum-startup-original';
   while (cells[1].firstChild) original.append(cells[1].firstChild);
   const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'oum-startup-toggle';
   const title = document.createElement('span'); title.className = 'oum-startup-name'; title.textContent = name;
   const meta = document.createElement('span'); meta.className = 'oum-startup-priority';
   meta.textContent = (document.documentElement.lang.startsWith('ru') ? 'Приоритет: ' : 'Priority: ') + cells[0].textContent.trim();
   const arrow = document.createElement('span'); arrow.className = 'oum-startup-arrow'; arrow.setAttribute('aria-hidden', 'true');
   toggle.append(title, meta, arrow); cells[1].append(original, toggle);
   const panelId = 'oum-startup-' + name;
   cells[2].id = panelId; toggle.setAttribute('aria-controls', panelId);
   function setOpen(open) {
    row.classList.toggle('oum-startup-open', open); toggle.setAttribute('aria-expanded', String(open));
    if (open) expanded.add(name); else expanded.delete(name);
   }
   setOpen(expanded.has(name));
   toggle.addEventListener('click', () => setOpen(!row.classList.contains('oum-startup-open')));
   row.classList.add('oum-startup-row');
  });
 }
 new MutationObserver(enhance).observe(main, {childList:true, subtree:true}); enhance();
})();
