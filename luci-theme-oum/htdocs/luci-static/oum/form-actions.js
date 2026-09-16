/* Keep confirmation last in visual and keyboard order; retain native handlers. */
(() => {
 const main = document.getElementById('maincontent');
 if (!main) return;
 function align() {
  for (const actions of main.querySelectorAll('.cbi-page-actions')) {
   const save = [...actions.children].find(n => n.classList.contains('cbi-button-save'));
   const reset = [...actions.children].find(n => n.classList.contains('cbi-button-reset'));
   if (save && reset && reset.nextElementSibling !== save) actions.insertBefore(reset, save);
   const apply = [...actions.children].find(n => n.classList.contains('cbi-button-apply'));
   if (apply && actions.lastElementChild !== apply) actions.append(apply);
  }
 }
 new MutationObserver(align).observe(main, {childList: true, subtree: true});
 align();
})();
