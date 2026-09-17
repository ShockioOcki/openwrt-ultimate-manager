/* Native popovers keep field help above dialogs without moving the form. */
(() => {
 if (!document.body.classList.contains('theme-oum')) return;
 let serial = 0;
 function enhance() {
  document.querySelectorAll('#maincontent .cbi-value-description, #modal_overlay .cbi-value-description').forEach(description => {
   if (description.closest('.oum-field-help') || !description.textContent.trim() || description.querySelector('.alert-message,.error,.warning,[role="alert"]')) return;
   const help = document.createElement('div'); help.className = 'oum-field-help';
   const button = document.createElement('button'); button.type = 'button'; button.className = 'oum-help-trigger';
   button.textContent = '?'; button.setAttribute('aria-label', document.documentElement.lang.startsWith('ru') ? 'Пояснение к полю' : 'Field explanation');
   const row = description.closest('.cbi-value');
   const title = row?.querySelector(':scope > .cbi-value-title');
   description.before(help); help.append(button, description);
   if (title && getComputedStyle(title).display !== 'none') {
    title.append(button); help.classList.add('oum-help-inline');
    button.classList.add('oum-help-at-title');
   }
   description.id ||= 'oum-help-' + (++serial);
   description.setAttribute('popover', 'auto');
   button.setAttribute('aria-controls', description.id); button.setAttribute('aria-expanded', 'false');
   function position() {
    const anchor = button.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    description.style.setProperty('width', Math.min(300, width - 24) + 'px', 'important');
    description.style.setProperty('max-height', Math.max(80, height - 24) + 'px', 'important');
    const box = description.getBoundingClientRect();
    const x = Math.max(left + 12, Math.min(anchor.left, left + width - box.width - 12));
    const above = anchor.top - box.height - 8;
    const y = above >= top + 12 ? above : Math.min(anchor.bottom + 8, top + height - box.height - 12);
    description.style.setProperty('left', x + 'px', 'important');
    description.style.setProperty('top', Math.max(top + 12, y) + 'px', 'important');
   }
   // LuCI labels have click handlers which toggle their associated widget.
   // Handle the popover here so neither bubbling nor label activation reaches it.
   button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    description.togglePopover();
   });
   description.addEventListener('toggle', () => {
    const open = description.matches(':popover-open'); button.setAttribute('aria-expanded', String(open));
    if (open) position();
   });
  });
 }
 function closeOnMove(e) {
  document.querySelectorAll('.oum-field-help > :popover-open').forEach(p => {
   if (!p.contains(e.target)) p.hidePopover();
  });
 }
 window.addEventListener('resize', closeOnMove);
 document.addEventListener('scroll', closeOnMove, true);
 new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true}); enhance();
})();
