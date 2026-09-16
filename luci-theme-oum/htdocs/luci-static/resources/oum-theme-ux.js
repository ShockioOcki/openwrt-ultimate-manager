/* OUM interaction layer: native LuCI actions remain the source of truth. */
(function() {
 'use strict';
 if (!window.L || !document.body.classList.contains('theme-oum')) return;
 L.require('ui').then(function(ui) {
  const page = document.body.dataset.page || '';
  const nativePage = /^(admin-(network|status|system)-|admin$)/.test(page) || page === '';
  const formPage = /^admin-network-(network|wireless|dhcp|dns|routes|firewall)/.test(page);
  if (nativePage) document.body.classList.add('oum-native-workspace');
  const mobile = window.matchMedia('(max-width: 900px)');
  let observer, scheduled = false, activeMap = null, editor = null, returnFocus = null;
  let baseline = '', edited = false, bypassCancel = false;
  const searches = new Map();
  const searchValues = new Map();
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text)n.textContent=text; return n; };
  const button = (text, handler, cls) => { const n=el('button',cls || 'btn cbi-button',text); n.type='button'; n.addEventListener('click',handler); return n; };
  const visible = n => !!(n && n.isConnected && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
  const fields = root => Array.from(root.querySelectorAll('input,select,textarea')).filter(n=>!['hidden','button','submit'].includes(n.type));
  const fingerprint = root => JSON.stringify(fields(root).map(n=>[n.name || n.id,n.type,n.type==='checkbox'||n.type==='radio'?n.checked:n.value]));
  const dirty = () => !!(activeMap && edited && fingerprint(activeMap)!==baseline);
  const cancelButton = modal => modal.querySelector(':scope > .button-row > button.btn.cbi-button:not(.cbi-button-positive):not(.cbi-button-negative):not(.cbi-button-save)');

  function cancelPrompt(trigger) {
   if (!editor || editor.querySelector('.oum-discard-prompt')) return;
   const box=el('div','oum-discard-prompt'); box.setAttribute('role','alert');
   box.append(el('strong','','Изменения в форме ещё не сохранены.'));
   box.append(button('Продолжить редактирование',()=>{box.remove();trigger.focus();}));
   box.append(button('Не сохранять',()=>{bypassCancel=true;trigger.click();bypassCancel=false;},'btn cbi-button cbi-button-negative'));
   editor.insertBefore(box,editor.querySelector('.button-row'));
   box.querySelector('button').focus();
  }

  document.addEventListener('click',event=>{
   const target=event.target.closest('button,a');
   if (!target) return;
   if (!target.closest('#modal_overlay')) returnFocus=target;
   if (editor && target===cancelButton(editor) && !bypassCancel && dirty()) {
    event.preventDefault();event.stopImmediatePropagation();cancelPrompt(target);
   }
  },true);
  document.addEventListener('input',event=>{if(activeMap && activeMap.contains(event.target)) edited=true;},true);
  document.addEventListener('change',event=>{if(activeMap && activeMap.contains(event.target)) edited=true;},true);
  window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});

  function editors() {
   const modal=document.querySelector('body.modal-overlay-active #modal_overlay > .modal.cbi-modal');
   const map=modal && modal.querySelector(':scope > .cbi-map:not(.hidden)');
   if (map && formPage) {
    modal.classList.add('oum-form-editor');
    const h=modal.querySelector('h4');if(h){h.id='oum-editor-title';modal.setAttribute('aria-labelledby',h.id);}
    if(map!==activeMap){activeMap=map;editor=modal;baseline=fingerprint(map);edited=false;}
    for(const row of map.querySelectorAll('.cbi-value:has(> .cbi-value-title)')) row.classList.add('oum-form-row');
   } else if (activeMap) {
    activeMap=null;editor=null;edited=false;
    if(visible(returnFocus) && !document.body.classList.contains('modal-overlay-active')) returnFocus.focus({preventScroll:true});
   }
   const editorActive=!!(map && formPage);
   if(document.body.classList.contains('oum-editor-active')!==editorActive)document.body.classList.toggle('oum-editor-active',editorActive);
  }

  // Keep keyboard focus within the topmost editor or navigation sheet.
  document.addEventListener('keydown',event=>{
   if(event.key!=='Tab') return;
   const root=document.body.classList.contains('modal-overlay-active') ? document.querySelector('#modal_overlay > .modal') :
    document.querySelector('.oum-settings-sheet:not([hidden]),#oum-mobile-menu:not([hidden]),#oum-luci-section-menu');
   if(!visible(root)) return;
   const nodes=Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(visible);
   if(!nodes.length)return;
   const index=nodes.indexOf(document.activeElement);
   if(event.shiftKey && index<=0){event.preventDefault();nodes[nodes.length-1].focus();}
   else if(!event.shiftKey && (index===nodes.length-1 || index<0)){event.preventDefault();nodes[0].focus();}
  },true);

  function interfaceActions() {
   if(page!=='admin-network-network')return;
   document.querySelectorAll('#maincontent #cbi-network-interface .cbi-section-actions > div').forEach(group=>{
    let details=group.querySelector(':scope > details.oum-row-actions');
    if(!mobile.matches){
     if(details){Array.from(details.querySelectorAll('button')).forEach(n=>group.appendChild(n));details.remove();}
     return;
    }
    if(details)return;
    const secondary=Array.from(group.children).filter(n=>n.matches('button.reconnect,button.down,button.cbi-button-remove'));
    if(!secondary.length)return;
    details=el('details','oum-row-actions');
    const summary=el('summary','','Действия');summary.setAttribute('aria-label','Другие действия с интерфейсом');
    details.append(summary);const content=el('div','oum-row-action-list');secondary.forEach(n=>content.append(n));details.append(content);group.append(details);
   });
  }

  function attachSearch(table, key) {
   if(searches.has(table))return;
   const box=el('div','oum-list-tools');
   const input=el('input');input.type='search';input.placeholder='Имя, IP или MAC';input.setAttribute('aria-label','Поиск в списке');input.value=searchValues.get(key)||'';
   const count=el('span','oum-list-count');count.setAttribute('aria-live','polite');
   const reset=button('Сбросить',()=>{input.value='';searchValues.delete(key);apply();input.focus();});
   const empty=el('p','oum-search-empty','Совпадений нет. Измените запрос или сбросьте поиск.');empty.hidden=true;
   box.append(input,count,reset);table.before(box);table.after(empty);
   function apply(){
    const query=input.value.trim().toLocaleLowerCase();let total=0,shown=0;
    for(const row of table.querySelectorAll('tr')){
     if(row.querySelector('th')||row.closest('thead')||row.querySelector('td[colspan]'))continue;
     total++;
     const text=(row.textContent+' '+fields(row).filter(n=>n.type!=='password').map(n=>n.value).join(' ')).toLocaleLowerCase();
     const hit=!query||text.includes(query);row.classList.toggle('oum-search-hidden',!hit);if(hit)shown++;
    }
    setText(count,query?`${shown} из ${total}`:`Записей: ${total}`);reset.hidden=!query;empty.hidden=!query||shown>0;
   }
   input.addEventListener('input',()=>{searchValues.set(key,input.value);apply();});
   searches.set(table,{box,empty,apply});apply();
  }
  function lists(){
   if(!nativePage)return;
   document.querySelectorAll('#maincontent #cbi-network-interface table.cbi-section-table,#maincontent #cbi-dhcp-host table.cbi-section-table,#maincontent #status_leases,#maincontent #status_leases6').forEach((table,index)=>attachSearch(table,table.id||table.parentElement.id||String(index)));
   searches.forEach((state,table)=>{if(!table.isConnected){state.box.remove();state.empty.remove();searches.delete(table);}else state.apply();});
  }

  function showChanges(){
   const content=el('div','oum-change-summary');
   content.append(el('p','','Изменения сохранены в конфигурации, но ещё не применены к работающей сети. Значения скрыты, чтобы не показывать пароли и ключи.'));
   const changes=ui.changes.changes || {};
   const labels={set:'Изменение',add:'Добавление',remove:'Удаление',order:'Порядок','list-add':'Добавление в список','list-del':'Удаление из списка',rename:'Переименование'};
   Object.keys(changes).forEach(config=>{
    content.append(el('h5','',config));const list=el('ul');
    changes[config].forEach(change=>list.append(el('li','',`${labels[change[0]]||change[0]} · ${change[1]||''}${change.length>3?' · '+change[2]:''}`)));content.append(list);
   });
   const actions=el('div','button-row');
   actions.append(button('Закрыть',()=>ui.hideModal()));
   actions.append(button('Отменить изменения',()=>{
    const confirm=el('div');confirm.append(el('p','','Отменить все подготовленные изменения? Работающая конфигурация сохранится.'));
    const row=el('div','button-row');row.append(button('Назад',showChanges),button('Отменить изменения',()=>ui.changes.revert(),'btn cbi-button cbi-button-negative'));confirm.append(row);ui.showModal('Отмена изменений',[confirm]);
   }));
   actions.append(button('Применить с проверкой',()=>ui.changes.apply(true),'btn cbi-button cbi-button-positive'));
   ui.showModal('Неприменённые изменения',[content,actions],'oum-change-review');
  }
  function changes(){
   if(!nativePage)return;
   const indicator=document.querySelector('[data-indicator="uci-changes"]');
   const data=ui.changes.changes;
   const count=indicator && indicator.style.display!=='none' && data?Object.values(data).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0):0;
   let strip=document.querySelector('#oum-changes-strip');
   if(!count){if(strip)strip.remove();return;}
   if(!strip){strip=el('div','oum-changes-strip');strip.id='oum-changes-strip';strip.setAttribute('role','status');strip.append(el('span'),button('Посмотреть',showChanges));const main=document.querySelector('#maincontent');const actions=main.querySelector('.cbi-page-actions');if(actions)actions.before(strip);else main.append(strip);}
   setText(strip.querySelector('span'),`Неприменённых изменений: ${count}`);
   if(indicator && !indicator.dataset.oumReview){indicator.dataset.oumReview='true';indicator.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();showChanges();},true);}
  }

  function nativeForms(){
   if(!formPage)return;
   for(const row of document.querySelectorAll('#maincontent .cbi-value:has(> .cbi-value-title)'))row.classList.add('oum-form-row');
   for(const actions of document.querySelectorAll('#maincontent .cbi-page-actions')) {
    actions.classList.add('oum-page-actions');
    if(!actions.querySelector('.oum-save-note'))actions.prepend(el('span','oum-save-note','«Сохранить» подготовит изменения. «Сохранить и применить» включит их в работу.'));
   }
  }
  function menuState(){
   const sidebar=document.querySelector('#oum-system-sidebar');if(!sidebar||sidebar.dataset.oumScroll)return;
   sidebar.dataset.oumScroll='true';
   try{sidebar.scrollTop=Number(sessionStorage.getItem('oum-sidebar-scroll'))||0;}catch(_){}
   sidebar.addEventListener('scroll',()=>{try{sessionStorage.setItem('oum-sidebar-scroll',String(sidebar.scrollTop));}catch(_){}},{passive:true});
   document.querySelectorAll('#topmenu li.active > a').forEach(a=>a.setAttribute('aria-current','page'));
  }
  function scan(){
   scheduled=false;observer.disconnect();
   try{editors();nativeForms();interfaceActions();lists();changes();menuState();}
   finally{observer.observe(document.body,{childList:true,subtree:true});}
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
  observer=new MutationObserver(schedule);
  const bodyObserver=new MutationObserver(schedule);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  mobile.addEventListener('change',schedule);document.addEventListener('luci-loaded',schedule);document.addEventListener('uci-loaded',schedule);
  scan();
  window.addEventListener('pageshow',()=>{bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});schedule();});
  window.addEventListener('pagehide',()=>{observer.disconnect();bodyObserver.disconnect();});
 }).catch(error=>console.warn('OUM theme enhancements unavailable:',error.message));
})();
