const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
assert.match(html,/<div class="r369-tools">[^\n]+استعلام ودفعة سريعة<\/button><button[^>]+id="pos397DailyCash"/);
assert.match(html,/#pos397DailyCash\{position:static/);
const js=html.match(/<script id="pos397-daily-cash">([\s\S]*?)<\/script>/)[1];
const nodes=[];
function element(tag){
 return {tag,children:[],appendChild(n){this.children.push(n);nodes.push(n)},classList:{contains:()=>true},
 setAttribute(){},showModal(){this.open=true},addEventListener(e,fn){this[e]=fn},
 remove(){nodes.splice(nodes.indexOf(this),1)},focus(){},close(){this.open=false;this.onClose?.()}};
}
let jobs=[],permission=true;
const document={body:element('body'),createElement:element,getElementById:id=>id==='home'?home:nodes.find(n=>n.id===id)};
const home=element('section'),state={mcLedger:[{account:'cashier_usd',amount:50,date:new Date().toISOString(),ref:'SAL-000401'}]};
const context={document,state,pos391Private:false,pos391Blocked(){},toast(){},window:{v250Can:()=>permission,pos397SendCashReceipt:async r=>jobs.push(r)}};
vm.runInNewContext(js,context);
context.window.pos397PrintDailyCash();
const dialog=document.getElementById('pos399CashPreview');
assert.equal(dialog.open,true);
assert.equal(jobs.length,0);
assert.ok(nodes.some(n=>n.textContent==='صافي النقد اليوم'));
assert.ok(nodes.some(n=>n.textContent==='+$50.00'));
const print=nodes.find(n=>n.textContent?.includes('Bluetooth'));
(async()=>{
 state.mcLedger[0].amount=90;
 permission=false;await print.onclick();assert.equal(jobs.length,0);
 permission=true;await print.onclick();assert.equal(jobs.length,1);
 assert.equal(jobs[0].balance,5000);
 assert.equal(print.disabled,false);
 assert.ok(nodes.some(n=>n.textContent==='إغلاق ×'));
 console.log('Inline shortcut, preview before printing, permissions, and identical printed snapshot verified');
})().catch(e=>{console.error(e);process.exitCode=1});
