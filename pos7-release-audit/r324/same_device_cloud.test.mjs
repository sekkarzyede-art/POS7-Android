import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root='r305-android/tab2/POS7_Tablet/app/src/main/assets/';
const html=fs.readFileSync(root+'index.html','utf8');
const original=fs.readFileSync(root+'restore_transfer.js','utf8');
const js=fs.readFileSync(root+'same_device_r324.js','utf8');
const gradle=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/build.gradle','utf8');
assert.ok(gradle.includes("versionName '485.7.229-r324-tab2'"));
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r324-tab2'));
assert.ok(html.includes('<script src="local_restore_r323.js"></script>'));
assert.ok(html.includes('<script src="same_device_r324.js"></script>'));
assert.ok(html.includes("if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;"));
assert.ok(original.includes('pos7_restore_same_device_r324'));
assert.ok(original.includes('pos7_restore_same_device_status_r324'));
assert.ok(original.includes("if (localStorage.getItem(markerKey) &&"));
assert.ok(!js.includes('POS7_R174_SMART_CAS_SERVER_VERIFIED'));
assert.ok(!js.includes('POS7_TRANSFER_COMPLETED_R305'));
assert.ok(!js.includes("localStorage.setItem('POS7_RESTORE_PENDING_R305'"));
assert.ok(js.includes('if(!verified?.ok||!verified.same_device'));
assert.ok(js.indexOf('if(!verified?.ok||!verified.same_device')<js.indexOf('return finish(req,verified)'));

async function simulate(opts={}){
 const main=JSON.stringify({products:[{id:1,stock:33}],sales:[{id:'SAL-000912',total:700.3}],purchases:[]});
 const store=new Map([
  ['POS7_TRIAL188_CLEAN',main],['POS7_RESTORE_PENDING_R305','yes'],
  ['POS7_RESTORE_LOCAL_ONLY_R323','yes'],
  ['POS7_CLOUD_DEVICE_V1','TAB2-DEVICE-ABC'],
  ['POS7_TRANSFER_REQUEST_R305','legacy_pending']
 ]);
 if(opts.noLocal)store.delete('POS7_RESTORE_LOCAL_ONLY_R323');
 const changes=[],calls=[],alerts=[],confirms=[];
 const localStorage={
  getItem(k){return store.get(k)??null},
  setItem(k,v){changes.push(['set',k]);store.set(k,String(v))},
  removeItem(k){changes.push(['remove',k]);store.delete(k)}
 };
 let reloads=0;
 const cloud={
  session:{access_token:'owner-token'},
  async req(url){calls.push(['GET',url]);return [{publisher_device:opts.publisher||'TAB2-DEVICE-ABC',revision:3594}]},
  async rpc(name,args){
   calls.push(['RPC',name]);
   if(opts.rpcFailure)throw Error('offline');
   if(name==='pos7_restore_same_device_r324')
    return {ok:true,publisher_device:'TAB2-DEVICE-ABC',
      approved_device:'TAB2-DEVICE-ABC',revision:3595,catalog_count:1};
   if(name==='pos7_restore_same_device_status_r324')
    return {ok:opts.verify!==false,same_device:true,revision:3595,
     fingerprint:'matching',expected_fingerprint:'matching'};
   throw Error('unexpected RPC '+name);
  }
 };
 const ctx={
  document:{readyState:'loading',addEventListener(){},
    getElementById(){return null},documentElement:{}},
  localStorage,
  window:{P7Cloud:cloud,P7TabletTest:{cashierBusy(){return false},isBusy(){return false}},
   pos7BuildOwnerSnapshot:async()=>({sections:{products:{'1':{id:'1',name:'A',stock:33}},
    sales:{},purchases:{}}})},
  confirm:msg=>{confirms.push(msg);return opts.cancel?false:true},
  alert:x=>alerts.push(String(x)),
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000324'},
  location:{reload(){reloads++}},console,MutationObserver:class{observe(){}},
  JSON,Number,Object,String,Error,Promise
 };
 vm.runInNewContext(js,ctx,{timeout:5000});
 await ctx.window.POS7_R324_SAME_DEVICE.align();
 return {store,main,changes,calls,alerts,confirms,reloads};
}
let ok=await simulate();
assert.equal(ok.store.get('POS7_TRIAL188_CLEAN'),ok.main);
assert.equal(ok.store.has('POS7_RESTORE_PENDING_R305'),false,
 'unblocks ONLY AFTER verified matching snapshot and permissions');
assert.equal(ok.store.has('POS7_TRANSFER_REQUEST_R305'),false);
assert.equal(ok.store.has('POS7_SAME_DEVICE_REQUEST_R324'),false);
assert.equal(ok.store.get('POS7_CLOUD_DEVICE_V1'),'TAB2-DEVICE-ABC');
assert.equal(ok.reloads,1);
assert.deepEqual(ok.calls.filter(x=>x[0]==='RPC').map(x=>x[1]),
 ['pos7_restore_same_device_r324','pos7_restore_same_device_status_r324']);
assert.equal(ok.confirms.length,1,'explicit user confirmation required');

let bad=await simulate({publisher:'OTHER-DEVICE'});
assert.equal(bad.calls.filter(x=>x[0]==='RPC').length,0,
 'mismatched device never sends write');
assert.equal(bad.store.get('POS7_RESTORE_PENDING_R305'),'yes');
assert.equal(bad.reloads,0);

let offline=await simulate({rpcFailure:true});
assert.equal(offline.store.get('POS7_RESTORE_PENDING_R305'),'yes');
assert.equal(offline.store.get('POS7_TRIAL188_CLEAN'),offline.main);
assert.equal(offline.reloads,0);

let failedVerification=await simulate({verify:false});
assert.equal(failedVerification.store.get('POS7_RESTORE_PENDING_R305'),'yes');
assert.equal(failedVerification.reloads,0);

let cancelled=await simulate({cancel:true});
assert.equal(cancelled.calls.filter(x=>x[0]==='RPC').length,0);
assert.equal(cancelled.store.get('POS7_RESTORE_PENDING_R305'),'yes');

let notApproved=await simulate({noLocal:true});
assert.equal(notApproved.calls.length,0);
assert.equal(notApproved.store.get('POS7_RESTORE_PENDING_R305'),'yes');
console.log('R324 PASS: same-device only; explicit confirmation; no cloud writes on mismatch, cancel, offline; guard removed only after RPC verified; financial state untouched');
