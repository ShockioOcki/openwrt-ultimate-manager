/* Only direct taps on the checkbox change its value. Help stays interactive. */
(() => {
 if (!document.body.classList.contains('theme-oum')) return;
 document.addEventListener('click', event => {
  if (event.target.closest('button,a,input')) return;
  const label = event.target.closest('label');
  if (!label || !label.closest('#maincontent,#modal_overlay')) return;
  if (label.control?.type === 'checkbox' || label.closest('.cbi-value[data-widget="CBI.FlagValue"]')?.querySelector('.cbi-checkbox')) { event.preventDefault(); event.stopImmediatePropagation(); }
 }, true);
})();
