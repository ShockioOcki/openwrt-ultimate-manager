/* Presentation only: retain native filters, listeners and log updates. */
(() => {
 if (!['admin-status-logs-syslog','admin-status-logs-dmesg'].includes(document.body.dataset.page)) return;
 const main = document.getElementById('maincontent');
 function enhance() {
  const area = document.getElementById('syslog');
  if (!area || area.dataset.oumLog) return;
  area.dataset.oumLog = 'true'; area.wrap = 'soft';
  const ru = document.documentElement.lang.startsWith('ru');
 const content = document.getElementById('content_syslog');
  const isDmesg = document.body.dataset.page === 'admin-status-logs-dmesg';
  if (isDmesg) {
   const tools = document.createElement('div'); tools.className = 'oum-log-tools';
   for (const [id,end] of [['scrollUpButton',false],['scrollDownButton',true]]) {
    const button = document.getElementById(id); if (!button) continue;
    button.type='button'; button.textContent = end ? 'В конец' : 'В начало';
    button.addEventListener('click', e=>{e.preventDefault();e.stopImmediatePropagation();area.scrollTop=end?area.scrollHeight:0;},true);
    tools.append(button);
   }
   area.before(tools);
   content.querySelectorAll('div[style*="padding-bottom"]').forEach(p=>p.remove());
   return;
  }
  const filters = document.createElement('div'); filters.className = 'oum-log-filters';
  const ids = ['logFacilitySelect','logSeveritySelect','logTextFilter','logMaxRows'];
  const inverses = ['invertLogFacilitySearch','invertLogSeveritySearch','invertLogTextSearch'];
  const titles = ru ? ['Источник','Уровень','Поиск по тексту','Максимум строк'] : ['Facility','Severity','Text search','Maximum rows'];
  const old = new Set();
  ids.forEach((id,i) => {
   const input = document.getElementById(id); if (!input) return;
   old.add(input.parentElement);
   const group = document.createElement('div'); group.className = 'oum-log-filter';
   const label = content.querySelector('label[for="'+id+'"]');
   label.textContent = titles[i]; group.append(label,input);
   const inverse = document.getElementById(inverses[i]);
   if (inverse) {
    const exclude = content.querySelector('label[for="'+inverse.id+'"]');
    exclude.textContent = ru ? 'Исключить' : 'Exclude';
    exclude.className = 'oum-log-exclude'; exclude.prepend(inverse); group.append(exclude);
   }
   filters.append(group);
  });
  content.prepend(filters);
  for (const node of old) if (node && !node.querySelector('input,select,button,textarea')) node.remove();
  const tools = document.createElement('div'); tools.className = 'oum-log-tools';
  for (const [id,end] of [['scrollUpButton',false],['scrollDownButton',true]]) {
   const button = document.getElementById(id); if (!button) continue;
   const parent = button.parentElement;
   button.type = 'button'; button.textContent = ru ? (end?'В конец':'В начало') : (end?'To end':'To start');
   button.addEventListener('click', e => {e.preventDefault();e.stopImmediatePropagation();area.scrollTop=end?area.scrollHeight:0;},true);
   tools.append(button); if (!parent.querySelector('input,select,button,textarea')) parent.remove();
  }
  area.before(tools);
 }
 new MutationObserver(enhance).observe(main,{childList:true,subtree:true}); enhance();
})();
