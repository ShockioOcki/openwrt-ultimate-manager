/* Run with an authenticated, disposable browser session:
 * playwright-cli -s=... run-code --filename=tests/theme_ux.browser.js
 * No network configuration is saved or applied. Pending changes below are UI-only.
 */
async page => {
 const expect=(value,message)=>{if(!value)throw Error(message);};
 const origin=await page.evaluate(()=>location.origin);
 const results=[];
 await page.goto(origin+'/cgi-bin/luci/admin/network/network');
 await page.locator('#cbi-network-interface .oum-list-tools').waitFor();
 await page.setViewportSize({width:390,height:900});
 const search=page.locator('#cbi-network-interface input[type=search]');
 await search.fill('wan');
 let names=await page.locator('#cbi-network-interface tr[data-sid]:visible').evaluateAll(rows=>rows.map(r=>r.dataset.sid));
 expect(names.length>0&&names.every(n=>n.includes('wan')),'Interface search must filter visible rows');
 await search.fill('no-such-interface-983720');
 expect(await page.locator('#cbi-network-interface .oum-search-empty').isVisible(),'Empty search needs an explanation');
 await page.locator('#cbi-network-interface .oum-list-tools button').click();
 expect((await search.inputValue())==='','Search reset must clear query');
 const actions=page.locator('#cbi-network-wan .oum-row-actions');
 await actions.locator('summary').click();
 expect(await actions.locator('.reconnect').isVisible(),'Restart must remain accessible');
 expect(await actions.locator('.down').isVisible(),'Stop must remain accessible');
 await actions.locator('summary').click();
 await page.setViewportSize({width:1440,height:900});
 await page.waitForFunction(()=>!document.querySelector('#cbi-network-wan details.oum-row-actions'));
 expect(await page.locator('#cbi-network-wan .reconnect').isVisible(),'Desktop must retain original actions after resizing');
 results.push('search, empty state, reset, responsive actions');

 await page.selectOption('#oum-theme-select','auto');
 await page.emulateMedia({colorScheme:'dark'});
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.emulateMedia({colorScheme:'light'});
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 expect(await page.evaluate(()=>localStorage.getItem('oum-theme-mode'))==='auto','System mode must remain selected');
 await page.selectOption('#oum-theme-select','light');
 results.push('system theme preference follows OS changes');

 await page.setViewportSize({width:390,height:900});
 await page.locator('.oum-bottom-nav [data-luci-section=network]').click();
 expect(await page.locator('#oum-luci-section-menu').isVisible(),'Network navigation must open');
 await page.locator('#oum-luci-section-menu .oum-mobile-menu-close').click();
 expect(await page.locator('.oum-bottom-nav [data-luci-section=network]').evaluate(n=>n===document.activeElement),'Navigation must restore focus');
 results.push('mobile navigation opens and restores focus');

 await page.evaluate(async()=>{const ui=await L.require('ui');window.__oumSavedChanges=ui.changes.changes;ui.changes.renderChangeIndicator({wireless:[['set','default_radio0','key','PRIVATE_TEST_VALUE']]});});
 await page.locator('#oum-changes-strip button').click();
 const review=page.locator('.oum-change-review');await review.waitFor();
 expect(!(await review.innerText()).includes('PRIVATE_TEST_VALUE'),'Review must not disclose secrets');
 expect((await review.innerText()).includes('wireless'),'Review must name affected config');
 await review.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.evaluate(async()=>{const ui=await L.require('ui');ui.changes.renderChangeIndicator(window.__oumSavedChanges||{});delete window.__oumSavedChanges;});
 results.push('pending changes use real structure and mask values');

 await page.goto(origin+'/cgi-bin/luci/admin/network/wireless');
 const opener=page.locator('#cbi-wireless-default_radio0 .cbi-button-action');await opener.click();
 const modal=page.locator('.oum-form-editor');await modal.waitFor();
 const ssid=modal.locator('[data-name=ssid] input[type=text]');
 const old=await ssid.inputValue();await ssid.fill(old+'-test');
 await modal.locator(':scope > .button-row > button').first().click();
 expect(await modal.locator('.oum-discard-prompt').isVisible(),'Dirty editor must ask before discarding');
 await modal.getByRole('button',{name:'Продолжить редактирование'}).click();
 expect((await ssid.inputValue())===old+'-test','Continue editing must preserve input');
 await modal.locator(':scope > .button-row > button').first().click();
 await modal.getByRole('button',{name:'Не сохранять',exact:true}).click();
 await page.waitForFunction(()=>!document.body.classList.contains('modal-overlay-active'));
 expect(await opener.evaluate(n=>document.activeElement===n),'Editor must restore opener focus');
 await opener.click();await modal.waitFor();
 expect((await modal.locator('[data-name=ssid] input[type=text]').inputValue())===old,'Discard must leave config unchanged');
 await modal.locator(':scope > .button-row > button').first().click();
 results.push('dirty guard, preserved input, discard, focus restoration');

 await page.goto(origin+'/cgi-bin/luci/oum/settings');
 await page.locator('.oum-settings-workspace').waitFor();
 await page.setViewportSize({width:1440,height:900});
 expect(await page.locator('.oum-mobile-settings-hub').isVisible(),'Settings hub must work on desktop');
 await page.locator('.oum-mobile-settings-launcher').first().click();
 expect(await page.locator('.oum-settings-sheet:not([hidden])').isVisible(),'Settings editor must open');
 await page.locator('.oum-settings-sheet-close').click();
 expect(await page.locator('.oum-mobile-settings-launcher').first().evaluate(n=>document.activeElement===n),'OUM editor restores focus');
 results.push('OUM desktop settings hub and editor');
 return results;
}
