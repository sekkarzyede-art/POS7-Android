import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const head='<script id="pos7-r314-boot-profiler">';
assert.equal(html.split(head).length,2,'R314 early boot instrumentation unique');
assert.ok(html.indexOf(head)<html.indexOf('<script id="pos7-localstorage-compression-v1">'),'profiler begins before compressed storage');
assert.ok(html.indexOf('window.pos314HookStorage();')<html.indexOf("const KEY='POS7_TRIAL188_CLEAN'"),'storage hooks before initial state');
assert.ok(html.includes("window.POS7_BOOT_DIAG_R314.mark('splashHidden')"));
assert.ok(html.includes("window.POS7_BOOT_DIAG_R314.mark('uiReady')"));
assert.ok(html.includes("window.pos314HookFunctions();"));
assert.ok(html.includes('window.pako.deflate(value,{level:1});'));
assert.ok(html.includes('for(var i=0;i<storage.length;i++)keys.push(storage.key(i))'),'R312 migration preserved');
assert.ok(html.includes('POS7_RESTORE_PENDING_R305'));
assert.ok(html.includes('window.pos310Installed=true'));
assert.ok(!html.includes('window.pos311SaleActive'));
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r315-tab2'));
const code=html.split(head)[1].split('</script>')[0];
new vm.Script(code);
const listeners={};
const perf={now:(()=>{let n=10;return ()=>n+=4})(),getEntriesByType:()=>[]};
class Storage{constructor(){this.x=new Map()}getItem(k){return this.x.get(k)||null}setItem(k,v){this.x.set(k,String(v))}}
const localStorage=new Storage();
const ctx={console,performance:perf,Storage,localStorage,Date,JSON,Math,
 window:null,navigator:{userAgent:'mock'},document:{readyState:'loading',addEventListener:(n,fn)=>listeners[n]=fn},
 PerformanceObserver:class{constructor(fn){this.fn=fn}observe(){}},
 addEventListener(){},
};
ctx.window=ctx;ctx.window.addEventListener=()=>{};ctx.window.POS7_SPLASH_TIMING={hiddenAt:444,uiReadyAt:333,minimumMs:5000};
vm.runInNewContext(code,ctx);
assert.equal(typeof ctx.pos314HookStorage,'function');
assert.equal(typeof ctx.pos314HookFunctions,'function');
assert.equal(typeof ctx.POS7_BOOT_DIAG_R314.report,'function');
ctx.pos314HookStorage();
localStorage.setItem('a','example');
assert.equal(localStorage.getItem('a'),'example');
const out=ctx.POS7_BOOT_DIAG_R314.report();
assert.equal(out.storage.reads,1);
assert.equal(out.storage.writes,1);
assert.equal(out.splashHiddenMs,444);
assert.equal(out.splashReadyMs,333);
assert.equal(out.splashMinimumMs,5000);
assert.ok(!JSON.stringify(out).includes('example'),'report does not leak stored values');
console.log('R314 PASS: earliest profiler, storage accounting, splash milestones, safe R312 baseline and no data exfiltration');
