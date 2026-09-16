/* Run via playwright-cli run-code in an authenticated disposable LuCI session.
 * Opens existing editors and changes DOM-only fixtures. Never saves configuration.
 */
async page => {
 const origin=await page.evaluate(()=>location.origin);
 await page.goto(origin+'/cgi-bin/luci/admin/network/wireless');
 const list=page.locator('#cbi-wireless-wifi-device');await list.waitFor();
 const results=[];
 await page.evaluate(()=>{window.__wirelessButtons=[...document.querySelectorAll('#cbi-wireless-wifi-device button')];});
 await page.waitForTimeout(6000);
 const retained=await page.evaluate(()=>window.__wirelessButtons.every((b,i)=>b===document.querySelectorAll('#cbi-wireless-wifi-device button')[i]));
 if(!retained)throw Error('Polling changed native action identities');
 results.push('polling preserves original buttons');
 for(const width of [360,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  const metrics=await list.evaluate(n=>({right:n.getBoundingClientRect().right,overflow:n.scrollWidth>n.clientWidth+1,buttons:[...n.querySelectorAll('button')].map(b=>({right:b.getBoundingClientRect().right,height:b.getBoundingClientRect().height}))}));
  if(metrics.right>width+1||metrics.overflow||metrics.buttons.some(b=>b.right>width+1||b.height<44))throw Error('Overflow or small action target at '+width);
  const edit=list.locator('tr:has(button.enable-disable) .cbi-button-action');
  for(let i=0;i<await edit.count();i++){
   await edit.nth(i).click();
   const modal=page.locator('#modal_overlay > .modal.cbi-modal');await modal.waitFor();
   if(!await modal.locator('[data-name=ssid]').isVisible())throw Error('Native Wi-Fi editor did not open');
   await modal.locator(':scope > .button-row > button').first().click();
   await page.waitForFunction(()=>!document.body.classList.contains('modal-overlay-active'));
  }
  results.push('native editors and 44px actions at '+width);
 }
 // Native unavailable/pending states must remain readable despite separator suppression.
 const fixtures=await list.evaluate(n=>{
  const radio=n.querySelector('tr:has(button.cbi-button-add) td[data-name="_stat"]');
  const saved=radio.innerHTML;
  radio.innerHTML='<div><em>Устройство не активно</em><a href="#">Есть неприменённые изменения</a></div>';
  const sizes=[...radio.querySelectorAll('em,a')].map(e=>parseFloat(getComputedStyle(e).fontSize));radio.innerHTML=saved;
  const stat=n.querySelector('tr:has(button.enable-disable) td[data-name="_stat"] > div > span');
  const original=stat.innerHTML;
  stat.append(document.createTextNode(' · Длинное имя сети с кириллицей '+ 'a'.repeat(64)));
  const fits=stat.getBoundingClientRect().right<=innerWidth+1&&n.scrollWidth<=n.clientWidth+1;
  stat.innerHTML=original;
  return {readable:sizes.every(v=>v>=14),fits};
 });
 if(!fixtures.readable||!fixtures.fits)throw Error('Unavailable or long-content fixture failed');
 results.push('unavailable, pending and long-name fixtures');
 await page.evaluate(()=>{delete window.__wirelessButtons;});
 return results;
}
