import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const tag='<script id="pos7-r314-boot-profiler">';
assert.equal(html.split(tag).length,2);
const source=html.split(tag)[1].split('</script>')[0];
assert.ok(source.includes('instrumentDOMContentLoaded'));
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r323-tab2'));
assert.ok(html.includes('window.pos310Installed=true'));
assert.ok(!html.includes('window.pos311SaleActive'));
let tick=0;
const registered=[];
const current={id:'pos7-test-init'};
const document={
 currentScript:current,scripts:[current],readyState:'loading',
 addEventListener(type,fn,options){registered.push({type,fn,options})},
 removeEventListener(type,fn){let i=registered.findIndex(x=>x.type===type&&x.fn===fn);if(i>=0)registered.splice(i,1)},
 getElementById(){return null}
};
const perf={now:()=>tick,getEntriesByType:()=>[]};
const context={document,window:null,performance:perf,console,navigator:{userAgent:'test'},
 PerformanceObserver:class{observe(){}},Storage:class{},Date,JSON,Math,WeakMap,
};
context.window=context;
context.addEventListener=()=>{};
vm.runInNewContext(source,context);
let n=0;const callback=function(){tick+=23333;n++};
document.addEventListener('DOMContentLoaded',callback,{once:true});
assert.ok(registered.some(x=>x.type==='DOMContentLoaded'));
let entry=registered.at(-1);entry.fn.call(document,{type:'DOMContentLoaded'});
assert.equal(n,1);
let report=context.POS7_BOOT_DIAG_R314.report();
assert.equal(report.domReadyHandlers.maxMs,23333);
assert.equal(report.domReadyHandlers.slowest[0].source,'pos7-test-init');
assert.equal(report.domReadyHandlers.slowest[0].calls,1);
assert.equal(report.domReadyHandlers.slowest[0].totalMs,23333);
assert.ok(!report.domReadyHandlers.slowest[0].callbackPreview.includes('private'));
document.addEventListener('DOMContentLoaded',function(){throw new Error('test-error')});
const last=registered.at(-1);
assert.throws(()=>last.fn.call(document,{}),/test-error/);
report=context.POS7_BOOT_DIAG_R314.report();
assert.equal(report.domReadyHandlers.called,2,'exceptions still recorded');
document.removeEventListener('DOMContentLoaded',callback);
assert.ok(!registered.some(x=>x.fn===entry.fn),'removeEventListener uses registered wrapped listener');
console.log('R315 PASS: 23.3 second handler attributed; source, errors, callback removal, stable R312 sales and R310 purchase');
