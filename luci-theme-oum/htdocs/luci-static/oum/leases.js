/* Compact lease disclosure; leave polling rows and data intact. */
(() => {
 if(document.body.dataset.page!=='admin-network-dhcp') return;
 const expanded=new Set();
 function enhance(){
 document.querySelectorAll('#lease_status_table tr').forEach(row=>{
 const cells=row.querySelectorAll(':scope > td');
 if(cells.length!==6 || row.querySelector('.oum-lease-toggle')) return;
 const key=cells[1].textContent.trim()+'|'+cells[2].textContent.trim();
 const original=document.createElement('span');original.className='oum-lease-original';
 while(cells[0].firstChild) original.append(cells[0].firstChild);
 const button=document.createElement('button');button.type='button';button.className='oum-lease-toggle';
 const name=document.createElement('span');name.className='oum-lease-name';name.textContent=original.textContent;button.append(name);
 const arrow=document.createElement('span');arrow.className='oum-lease-arrow';arrow.setAttribute('aria-hidden','true');button.append(arrow);
 cells[0].append(original,button);row.classList.add('oum-lease-row');
 const set=open=>{row.classList.toggle('oum-lease-expanded',open);button.setAttribute('aria-expanded',String(open));if(open)expanded.add(key);else expanded.delete(key);};
 set(expanded.has(key));button.addEventListener('click',()=>set(!row.classList.contains('oum-lease-expanded')));
 });
 }
 const main=document.getElementById('maincontent');if(!main)return;
 new MutationObserver(enhance).observe(main,{childList:true,subtree:true});enhance();
})();
