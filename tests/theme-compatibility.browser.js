// Run with playwright-cli -s=<authenticated session> run-code --filename=tests/theme-compatibility.browser.js
async (page) => {
 const results = [];
 for (const width of [1440, 390]) {
  await page.setViewportSize({width, height: 1000});
  const result = await page.evaluate(() => {
   const main = document.querySelector('#maincontent');
   const originalPage = document.body.dataset.page;
   document.body.dataset.page = 'admin-services-compatibility-fixture';
   const fixture = document.createElement('section');
   fixture.innerHTML = '<div class="cbi-value hidden"><label class="cbi-value-title">Hidden</label><div class="cbi-value-field">Hidden field</div></div><div class="cbi-section" data-tab="inactive">Inactive</div><div hidden>Hidden attribute</div><div class="cbi-value"><output><div style="width:100%">Custom application panel</div></output><input type="hidden"></div><table class="table"><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
   main.append(fixture);
   try {
    const display = selector => getComputedStyle(fixture.querySelector(selector)).display;
    return {
     hiddenField: display('.hidden') === 'none',
     hiddenAttribute: display('[hidden]') === 'none',
     inactiveTab: display('[data-tab]') === 'none',
     panelWidth: fixture.querySelector('output').getBoundingClientRect().width >= fixture.clientWidth - 2,
     nativeTable: display('tr') === 'table-row' && display('td') === 'table-cell'
    };
   } finally { fixture.remove(); document.body.dataset.page = originalPage; }
  });
  results.push({width, ...result});
  if (Object.values(result).some(value => !value)) throw new Error(JSON.stringify(results));
 }
 console.log(JSON.stringify(results));
}
