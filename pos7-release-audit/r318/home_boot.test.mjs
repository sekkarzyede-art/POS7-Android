import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const notPresent=[
 "renderCashboxPage();renderHome()},0);",
 "setTimeout(()=>{try{renderHome()}catch(_e){}},40);",
 "setTimeout(()=>{try{renderHome()}catch(e){};try{if(document.getElementById('reportsHub'))renderReportsHub()}catch(e){}},80);"
];
for(const x of notPresent)assert.ok(!html.includes(x),'old eager home timer still present');
assert.ok(html.includes('renderCashboxPage();/* R318: home on authorized page open */},0);'),'cashbox initializer stays intact');
assert.ok(html.includes("setTimeout(()=>{try{if(document.getElementById('reportsHub'))renderReportsHub()}catch(e){}},80);"),'reportsHub initialization retained');
assert.ok(html.includes("if(id==='home')renderHome();"),'home always renders on actual home open');
assert.ok(html.includes('document.addEventListener("DOMContentLoaded",restoreAuthorizedPage);'),'authorized startup routing is intact');
assert.ok(html.includes("window.__v250RawOpen(page);else home()"),'restored page router remains intact');
assert.ok(html.includes('window.pos310Installed=true'),'purchase durable write path unchanged');
assert.ok(!html.includes('window.pos311SaleActive'),'unstable sale batching is still absent');
assert.ok(html.includes('POS7_RESTORE_PENDING_R305'),'restore pending guard intact');
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r318-tab2'),'new release identity present');
console.log('R318 PASS: obsolete eager home timers removed, auth navigation and accounting safeguards retained');
