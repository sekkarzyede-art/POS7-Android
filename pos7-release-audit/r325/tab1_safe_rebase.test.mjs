import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root='r321-android/tab1/POS7_Tablet/';
const h=fs.readFileSync(root+'app/src/main/assets/index.html','utf8');
const js=fs.readFileSync('pos7-release-audit/r325/tab1_safe_rebase.js','utf8');
const sql=fs.readFileSync('pos7-release-audit/r325/tab1_authoritative_rebase.sql','utf8');
const gradle=fs.readFileSync(root+'app/build.gradle','utf8');
assert.ok(h.includes('id="pos7-r325-safe-sync"'));
assert.ok(h.includes('pos7-r322-native-state-storage'));
assert.ok(h.includes('POS7_R174_SMART_CAS_SERVER_VERIFIED'));
assert.ok(h.includes('pos7_inventory_commit_r155'));
assert.ok(gradle.includes("versionName '485.7.229-r328-tab1'"));
assert.ok(sql.includes('same_device_r325_receipts'));
assert.ok(sql.includes("event_type<>'inventory_count'"));
assert.ok(sql.includes('r325_product_revision_not_rebased'));
assert.ok(sql.includes('previous_catalog jsonb NOT NULL'));
assert.ok(!sql.includes("UPDATE public.pos7_inventory_gate_r152"));
assert.ok(!sql.includes("SET status='rejected'"));
assert.ok(!sql.includes("SET status='processed'"));
assert.ok(!js.includes("pos7_owner_rebind_device"));
assert.ok(!js.includes("pos7_owner_ack"));
const data={
 products:[
  {id:44,name:'A',barcode:'111',stock:-2,stock_revision:null,stock_revision_untrusted:true},
  {id:44,name:'B',barcode:'222',stock:9,stock_revision:null,stock_revision_untrusted:true},
  {id:90,name:'C',barcode:'333',stock:1,stock_revision:12,stock_revision_untrusted:false}
 ],
 sales:[{id:'SAL-000912',total:700.3}],purchases:[{id:'PUR-000156',total:91}],
 accountingJournal:[{id:1,amount:500}],mcLedger:[{amount:12}],customers:{'أبو ليلي':400}
};
function local(raw){
 const store=new Map([['POS7_TRIAL188_CLEAN',raw],['POS7_CLOUD_DEVICE_V1','trusted-device-1']]);
 return {store,getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)}};
}
async function simulate(options={}){
 const state=JSON.parse(JSON.stringify(data));
 const storage=local(JSON.stringify(state)),calls=[],alerts=[];
 if(options.existingRequest)storage.setItem('POS7_R325_REBASE_PENDING',JSON.stringify({
  request_id:'22222222-2222-4222-8222-222222222222',
  device:'trusted-device-1',expected:3719,product_count:3
 }));
 const normItems={};
 state.products.forEach(p=>normItems[p.id===44?'barcode:'+p.barcode:String(p.id)]={
   id:p.id===44?'barcode:'+p.barcode:String(p.id),
   name:p.name,barcode:p.barcode,stock:p.stock,
   stock_revision:p.stock_revision,stock_revision_untrusted:p.stock_revision_untrusted
 });
 let verifies=0,reloaded=false,cloudSections=null;
 const cloud={session:{access_token:'token'},
  async req(url){calls.push('read');if(url.includes('select=sections,revision'))return [{sections:cloudSections,revision:3720}];return [{publisher_device:options.wrongDevice?'another': 'trusted-device-1',revision:3719}]},
  async rpc(name,args){
   calls.push(name);
   if(options.offline)throw Error('connection failed');
   if(name==='pos7_restore_same_device_r325'){
     cloudSections=JSON.parse(JSON.stringify(args.p_sections));
     assert.equal(Object.keys(args.p_sections.products).length,3);
     for(const item of Object.values(args.p_sections.products)){
       assert.equal(item.stock_revision_untrusted,false);
       assert.ok(Number.isSafeInteger(item.stock_revision));
     }
     return {ok:true,publisher_device:'trusted-device-1',approved_device:'trusted-device-1',revision:3720};
   }
   if(name==='pos7_restore_same_device_status_r325'){
     verifies++;
     if(options.existingRequest && args.p_request_id==='22222222-2222-4222-8222-222222222222')return {ok:false,reason:options.ambiguousReceipt?'network_unknown':'receipt_missing'};
     return {ok:options.verify!==false,same_device:true,fingerprint:'match',
       expected_fingerprint:'match',catalog_count:3,revision:3720};
   }
   throw Error('unexpected '+name);
  }
 };
 const document={readyState:'loading',addEventListener(){},getElementById(){return null},documentElement:{}};
 const window={
  P7Cloud:cloud,
  P7TabletTest:{cashierBusy:()=>false,/* R327 regression: actual Tab1 exports cashierBusy only, no isBusy */},
  pos7BuildOwnerSnapshot:async()=>({sections:{
   products:JSON.parse(JSON.stringify(normItems)),sales:{},purchases:{},
   cash:{},cashLedger:{},customers:{},expenses:{},meta:{},payments:{},
   receipts:{},returns:{},suppliers:{},wallet:{},walletTx:{}
  }})
 };
 const ctx={document,window,state,localStorage:storage,
  navigator:{onLine:true},
  location:{reload(){reloaded=true}},
  alert:v=>alerts.push(String(v)),confirm:()=>options.cancel!==true,
  crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111325'},
  MutationObserver:class{observe(){}},
  console,JSON,Number,String,Array,Map,Set,Object,Error,Promise};
 vm.runInNewContext(js,ctx,{timeout:6000});
 await window.POS7_R325_SAFE_SYNC.run();
 return {storage,original:JSON.stringify(data),calls,alerts,reloaded,verifies,raw:storage.getItem('POS7_TRIAL188_CLEAN')};
}
let recovered=await simulate({existingRequest:true});
assert.equal(recovered.reloaded,true,'timed-out request is recovered only after missing receipt');
assert.ok(recovered.calls.includes('pos7_restore_same_device_status_r325'));
assert.ok(recovered.calls.includes('pos7_restore_same_device_r325'));
assert.equal(recovered.storage.getItem('POS7_R325_REBASE_PENDING'),null);
let unknown=await simulate({existingRequest:true,ambiguousReceipt:true});
assert.equal(unknown.reloaded,false,'ambiguous receipt must stop');
assert.equal(unknown.storage.getItem('POS7_R174_SMART_CAS_SERVER_VERIFIED'),null);
assert.ok(!unknown.calls.includes('pos7_restore_same_device_r325'),'unknown status cannot start a second write');
let ok=await simulate();
assert.equal(ok.reloaded,true,'server verification then reload');
assert.equal(ok.storage.getItem('POS7_R174_SMART_CAS_SERVER_VERIFIED'),'yes');
const next=JSON.parse(ok.raw);
assert.equal(next.products.length,3);
assert.deepEqual(next.products.map(p=>p.stock),[-2,9,1]);
assert.deepEqual(next.products.map(p=>p.stock_revision),[0,0,12]);
assert.deepEqual(next.products.map(p=>p.stock_revision_untrusted),[false,false,false]);
for(const k of ['sales','purchases','customers','accountingJournal','mcLedger'])
 assert.deepEqual(next[k],data[k],'finance remains unchanged: '+k);
assert.ok(ok.calls.includes('pos7_restore_same_device_r325'));
assert.ok(ok.calls.includes('pos7_restore_same_device_status_r325'));
assert.equal(ok.storage.getItem('POS7_R325_REBASE_PENDING'),null);

for(const options of [{wrongDevice:true},{offline:true},{verify:false},{cancel:true}]){
 const out=await simulate(options);
 assert.equal(out.raw,out.original,'failure never alters main state');
 assert.equal(out.storage.getItem('POS7_R174_SMART_CAS_SERVER_VERIFIED'),null,
  'failure keeps CAS guard blocked');
 assert.equal(out.reloaded,false);
 if(options.wrongDevice||options.cancel)assert.ok(!out.calls.includes('pos7_restore_same_device_r325'));
 if(options.offline||options.verify===false)assert.equal(out.storage.getItem('POS7_R325_REBASE_PENDING')!==null,true);
}
console.log('R325 PASS: 7 duplicate-id compatible product IDs, trusted revision rebase, fail-closed after RPC, same device only, never changes finance, quantity, or inventory queue');
