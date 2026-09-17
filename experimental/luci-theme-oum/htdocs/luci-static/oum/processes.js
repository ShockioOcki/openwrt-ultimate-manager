/* Keep LuCI rows and their signal handlers; add a touch disclosure. */
(() => {
 if (document.body.dataset.page !== 'admin-status-processes') return;
 const main = document.getElementById('maincontent');
 if (!main) return;
 const expanded = new Set();
 function enhance() {
  main.querySelectorAll('table tr').forEach(row => {
   const cells = row.querySelectorAll(':scope > td');
   if (cells.length !== 6 || row.querySelector('.oum-process-toggle')) return;
   const actions = cells[5].querySelectorAll('button');
   if (actions.length !== 3) return;
   const pid = cells[0].textContent.trim();
   const command = cells[2].textContent.trim();
   const key = pid + ':' + command;
   const toggle = document.createElement('button');
   toggle.type = 'button'; toggle.className = 'oum-process-toggle';
   const name = document.createElement('span'); name.className = 'oum-process-name'; name.textContent = command;
   const meta = document.createElement('span'); meta.className = 'oum-process-meta';
   meta.textContent = 'PID ' + pid + ' · ' + cells[1].textContent.trim() + ' · CPU ' + cells[3].textContent.trim() + ' · RAM ' + cells[4].textContent.trim();
   const chevron = document.createElement('span');
   chevron.className = 'oum-process-chevron'; chevron.setAttribute('aria-hidden','true');
   toggle.append(name, meta, chevron);
   cells[2].append(toggle);
   cells[5].id = 'oum-process-actions-' + pid;
   toggle.setAttribute('aria-controls', cells[5].id);
   const setOpen = open => {
    row.classList.toggle('oum-process-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) expanded.add(key); else expanded.delete(key);
   };
   setOpen(expanded.has(key));
   toggle.addEventListener('click', () => setOpen(!row.classList.contains('oum-process-open')));
   ['Перезапустить', 'Завершить', 'Принудительно завершить'].forEach((label, i) => { actions[i].textContent = label; });
   actions[0].title = 'Отправить SIGHUP. Реакция зависит от процесса; это не гарантирует перезапуск.';
   row.classList.add('oum-process-row');
  });
 }
 new MutationObserver(enhance).observe(main, {childList:true, subtree:true});
 enhance();
})();
