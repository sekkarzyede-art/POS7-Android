import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const js=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/local_restore_r323.js','utf8');
const old=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/restore_transfer.js','utf8');
const gradle=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/build.gradle','utf8');
assert.ok(html.includes('<script src="local_restore_r323.js"></script>'));
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r323-tab2'));
assert.ok(gradle.includes("versionName '485.7.229-r323-tab2'"));
assert.ok(old.includes("if (localStorage.getItem(markerKey) && name !== 'pos7_restore_transfer_r305')"));
assert.ok(old.includes("if (!confirm('سيعتمد هذا المتجر بيانات النسخة المستعادة"));
assert.ok(js.includes("localStorage.setItem(LOCAL,'yes')"));
assert.ok(!js.includes('removeItem(RESTORE)'));
assert.ok(!js.includes("localStorage.setItem(RESTORE,"));
assert.ok(!js.includes("POS7_TRANSFER_COMPLETED_R305"));
assert.ok(!js.includes("POS7_R174_SMART_CAS_SERVER_VERIFIED"));
assert.ok(!js.includes("P7Cloud"));
assert.ok(!js.includes("pos7_owner_publish"));
assert.ok(html.includes('POS7_R174_SMART_CAS_SERVER_VERIFIED'));
assert.ok(html.includes('window.pos310Installed=true'));
assert.ok(!html.includes('window.pos311SaleActive'));

function simulate(pending=true,confirmResult=true){
 const original=JSON.stringify({products:[{id:1,stock:5}],sales:[{no:'SAL-000912',total:700.3}],purchases:[{no:'PUR-3'}]});
 const store=new Map([['POS7_TRIAL188_CLEAN',original],['POS7_CLOUD_DEVICE_V1','device-2'],['POS7_TRANSFER_REQUEST_R305','kept']]);
 if(pending)store.set('POS7_RESTORE_PENDING_R305','yes');
 let confirms=0,alerts=[],calls=[];
 const localStorage={
  getItem(k){return store.get(k)??null},
  setItem(k,v){calls.push(['set',k,String(v)]);store.set(k,String(v))},
  removeItem(k){calls.push(['remove',k]);store.delete(k)}
 };
 const document={readyState:'loading',addEventListener(){},
  getElementById(){return null},documentElement:{}};
 class MutationObserver {constructor(fn){}observe(){}}
 const ctx={window:{MutationObserver},document,localStorage,confirm:()=>{confirms++;return confirmResult},alert:x=>alerts.push(x),MutationObserver,console};
 vm.runInNewContext(js,ctx,{timeout:5000});
 const before=new Map(store);
 const status=ctx.window.POS7_R323_LOCAL_RESTORE.status();
 const ok=ctx.window.POS7_R323_LOCAL_RESTORE.approve();
 return {ok,before,store,calls,alerts,confirms,status,original};
}
let r=simulate();
assert.equal(r.ok,true);
assert.equal(r.store.get('POS7_RESTORE_PENDING_R305'),'yes','R305 cloud-publish guard remains');
assert.equal(r.store.get('POS7_RESTORE_LOCAL_ONLY_R323'),'yes');
assert.equal(r.store.get('POS7_TRIAL188_CLEAN'),r.original,'full customer/product/invoice state unchanged');
assert.equal(r.store.get('POS7_TRANSFER_REQUEST_R305'),'kept','pending cloud transfer request untouched');
assert.equal(r.store.get('POS7_CLOUD_DEVICE_V1'),'device-2');
assert.deepEqual(r.calls.map(x=>x[1]),['POS7_RESTORE_LOCAL_ONLY_R323'],'ONLY offline marker may change');
assert.equal(r.status.cloudPublishingBlocked,true);
let refused=simulate(true,false);
assert.equal(refused.ok,false);
assert.deepEqual(refused.calls,[]);
let noPending=simulate(false,true);
assert.equal(noPending.ok,false);
assert.deepEqual(noPending.calls,[]);
console.log('R323 PASS: approve local only, ZERO cloud calls, ZERO privilege changes, sync guard remains, state unchanged, cancel and missing restore fail safely');
