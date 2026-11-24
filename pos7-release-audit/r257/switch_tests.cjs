const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const h=fs.readFileSync(process.argv[2]||'app/src/main/assets/index.html','utf8');
const a=h.indexOf('function r257Canonical('),b=h.indexOf('const actions=',a);
assert(a>=0&&b>a);
const code=h.slice(a,b);
const event=(id,status='pending',owner='owner1',amount=50)=>({event_id:id,status,owner,event_type:'customer_payment',device_id:'device1',created_at:'2026-11-24T21:02:00Z',payload:{customer:'fixture',amount,currency:'USD'}});
function fixture({memory=[event('one')],saved=[event('one')],project='original',writeFail=false,readbackFail=false,unregisterFail=false,busy=false,activeSelector='',online=true,mutateStore=false}={}){
 const clone=v=>JSON.parse(JSON.stringify(v));
 const keys=new Map,local=new Map,alerts=[],messages=[],writes=[],unregistered=[];
 const prefix=()=>ctx.window.P7Multi.ref+'|';
 keys.set(project+'|queue:owner1',clone(saved));keys.set('second|queue:owner1',[event('two','queued','owner1',17)]);
 local.set(project+'|POS7_OWNER_SESSION','originalSession');
 local.set(project+'|pos7-r71-count:owner1','{"sku":8}');
 local.set(project+'|pos7-r256-queue:owner1','[{"fixture":true}]');
 const ctx={console,mode:'live',scope:'owner1',epoch:1,queue:clone(memory),syncBusy:busy,queueBusy:false,financialSubmitBusy:false,
 C:{session:{user:{id:'owner1'}},url:project,refreshing:null},s:{},ix:{},selection:{},orders:[],phoneNotifications:[],pendingPushOpen:null,
 navigator:{onLine:online},document:{querySelector:q=>q===activeSelector?{}:null,getElementById:()=>null},
 P7Store:{async get(k){let r=clone(keys.get(prefix()+k)||[]);if(readbackFail&&writes.length)r=[];return r},async put(k,v){if(writeFail)throw Error('disk failure');keys.set(prefix()+k,clone(v));writes.push(prefix()+k);if(mutateStore)ctx.window.P7Multi.ref='wrong'}},
 async unregisterPushDevice(){if(unregisterFail)throw Error('push failure');unregistered.push(prefix());},
 updateNotificationBadge(){},close(){},loginScreen(){},msg:t=>messages.push(t),notify:t=>messages.push(t)};
 ctx.window={P7Multi:{ref:project,label:project},P7Local:{getItem:k=>local.get(prefix()+k)??null,removeItem:k=>local.delete(prefix()+k)},Pos7Android:{clearPushOwner(){}},alert:t=>alerts.push(t),scrollTo(){}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,keys,local,alerts,messages,writes,unregistered,run:()=>vm.runInContext('logout()',ctx),merge:(a,b)=>{ctx.ma=a;ctx.mb=b;return vm.runInContext('r257MergeQueue(ma,mb,"owner1")',ctx)}};
}
let n=0;async function test(name,fn){await fn();n++;console.log('PASS',name)}
(async()=>{
 await test('pending $50 duplicate stored once; switch succeeds without tablet',async()=>{let f=fixture();await f.run();assert.equal(f.ctx.C.session,null);assert.equal(f.keys.get('original|queue:owner1').length,1);assert.equal(f.keys.get('original|queue:owner1')[0].payload.amount,50);assert.equal(f.keys.get('second|queue:owner1')[0].payload.amount,17);assert.equal(f.alerts.length,0);assert.equal(f.local.get('original|pos7-r71-count:owner1'),'{"sku":8}');assert.equal(f.local.get('original|pos7-r256-queue:owner1'),'[{"fixture":true}]');assert.equal(f.unregistered.length,1)});
 await test('queued unsent command retained',async()=>{let f=fixture({memory:[event('one','queued')],saved:[]});await f.run();assert.equal(f.ctx.C.session,null);assert.equal(f.keys.get('original|queue:owner1')[0].status,'queued')});
 await test('newer processed acknowledgement wins over pending copy',async()=>{let f=fixture({saved:[{...event('one','processed'),result:{ok:true}}]});await f.run();assert.equal(f.keys.get('original|queue:owner1')[0].status,'processed')});
 await test('rejected final status preserved',async()=>{let f=fixture({memory:[event('one','rejected')]});await f.run();assert.equal(f.keys.get('original|queue:owner1')[0].status,'rejected')});
 await test('unique IDs union without loss',async()=>{let f=fixture({saved:[event('one'),event('three','queued')]});await f.run();assert.equal(f.keys.get('original|queue:owner1').length,2)});
 await test('conflicting payload blocks switch without overwriting',async()=>{let f=fixture({saved:[event('one','pending','owner1',99)]});await f.run();assert(f.ctx.C.session);assert.equal(f.writes.length,0);assert.equal(f.keys.get('original|queue:owner1')[0].payload.amount,99)});
 await test('conflicting final statuses block switch',async()=>{let f=fixture({memory:[event('one','processed')],saved:[event('one','rejected')]});await f.run();assert(f.ctx.C.session);assert.equal(f.writes.length,0)});
 await test('foreign owner blocks switch',async()=>{let f=fixture({saved:[event('one','pending','other')]});await f.run();assert(f.ctx.C.session);assert.equal(f.writes.length,0)});
 await test('failed durable write preserves session',async()=>{let f=fixture({writeFail:true});await f.run();assert(f.ctx.C.session);assert.equal(f.unregistered.length,0)});
 await test('failed readback preserves session',async()=>{let f=fixture({readbackFail:true});await f.run();assert(f.ctx.C.session);assert.equal(f.unregistered.length,0)});
 await test('network notification unregister failure preserves session',async()=>{let f=fixture({unregisterFail:true});await f.run();assert(f.ctx.C.session);assert.equal(f.keys.get('original|queue:owner1').length,1)});
 await test('offline switch retains session and queue',async()=>{let f=fixture({online:false});await f.run();assert(f.ctx.C.session);assert.equal(f.keys.get('original|queue:owner1').length,1)});
 await test('active financial sync blocks only during operation',async()=>{let f=fixture({busy:true});await f.run();assert(f.ctx.C.session);f.ctx.syncBusy=false;await f.run();assert.equal(f.ctx.C.session,null)});
 await test('active local financial submit blocks',async()=>{let f=fixture();f.ctx.financialSubmitBusy=true;await f.run();assert(f.ctx.C.session);assert.equal(f.writes.length,0)});
 await test('active inventory send blocks',async()=>{let f=fixture({activeSelector:'#r71-transfer:disabled'});await f.run();assert(f.ctx.C.session);assert.equal(f.unregistered.length,0)});
 await test('active image upload blocks',async()=>{let f=fixture({activeSelector:'#pos134-sync:disabled'});await f.run();assert(f.ctx.C.session);assert.equal(f.unregistered.length,0)});
 await test('reentrant logout performs one durable write',async()=>{let f=fixture();await Promise.all([f.run(),f.run()]);assert.equal(f.writes.length,1);assert.equal(f.unregistered.length,1)});
 await test('project changed mid-save aborts logout',async()=>{let f=fixture({mutateStore:true});await f.run();assert(f.ctx.C.session);assert.equal(f.unregistered.length,0);assert.equal(f.keys.get('second|queue:owner1')[0].payload.amount,17)});
 await test('actual store-scoped keys and return-to-account queue reload retained',()=>{assert(h.includes("window.P7StoreScopeKey=function(k){return active==='original'?String(k):'store2:rmskuolsiqbzxuakofpb|'+String(k)}"));assert(h.includes("queue=await P7Store.get('queue:'+scope)||[]"));assert(h.includes("await refresh()"));assert(h.includes("resolution=ignore-duplicates,return=representation"));assert(h.includes("if(window.POS7R257SwitchBusy||queueBusy||"));assert(h.includes("if(window.POS7R257SwitchBusy||financialSubmitBusy)"));assert(h.includes("if(window.POS7R257SwitchBusy||busy||window.POS7R255ResetBusy)return;"))});
 console.log(n+'/19 R257 switch tests PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
