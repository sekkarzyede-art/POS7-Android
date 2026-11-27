const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=readFileSync(process.argv[2],'utf8');
const source=html.match(/<script id="pos396-report-preview">([\s\S]*?)<\/script>/)[1];
const callbacks={};
const frame={addEventListener(k,fn){callbacks[k]=fn},removeAttribute(k){delete this[k]},contentDocument:{querySelector:()=>true}};
const close={};
const print={};
const title={};
const dialog={
 querySelector(s){return {'iframe':frame,'#pos396Close':close,'#pos396Print':print,'#pos396ReportTitle':title}[s]},
 setAttribute(){},
 addEventListener(k,fn){callbacks[k]=fn},
 showModal(){this.open=true},
 close(){this.open=false;callbacks.close()},
};
let focused=false, job;
const environment={
 document:{createElement(tag){return tag==='dialog'?dialog:{get outerHTML(){return '<h2>'+this.textContent+'</h2>'}}},
 body:{appendChild(e){assert.equal(e,dialog)}},activeElement:{isConnected:true,focus(){focused=true}}},
 Pos7Android:{printReportHtml(...args){job=args}},
};
environment.window=environment;
vm.runInNewContext(source,environment);
const removed=[];
const root={innerHTML:'<table></table>',cloneNode(){return {
 tagName:'DIV',innerHTML:this.innerHTML,querySelectorAll(selector){assert.match(selector,/button/);return [{remove(){removed.push(true)}}]}
}}};
for(const heading of ['حركة الصندوق','حركة البيع','حركة المتجر']){
 environment.pos396PreviewReport(root,heading);
 assert.equal(dialog.open,true);
 assert.equal(print.disabled,true);
 callbacks.load();
 assert.equal(print.disabled,false);
 print.onclick();
 assert.equal(job[1],heading);
 assert.match(job[0],/<table>/);
 assert.doesNotMatch(job[0],/إغلاق/);
 close.onclick();
 assert.equal(dialog.open,false);
 assert.equal(frame.srcdoc,undefined);
}
assert.equal(removed.length,3);
assert.equal(focused,true);
assert.doesNotMatch(html,/onclick="(?:pos713WhatsApp|pos742ShareProductMovement|pos286ShareCashReport|pos286PrintCashReport)\(\)"/);
assert.match(html,/id="pos741ReportPrint"/);
assert.match(html,/if\(page.id==='cashMovement286'\)return window.pos286PrintCashReport\(\)/);
console.log('Shared preview, print job, close and report entry points verified');
