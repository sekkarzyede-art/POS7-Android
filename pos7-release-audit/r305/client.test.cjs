const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const script=fs.readFileSync(require('node:path').join(__dirname,'restore_transfer.js'),'utf8');
async function scenario(dropResponse){
 const storage=new Map([['POS7_RESTORE_PENDING_R305','yes'],['POS7_CLOUD_DEVICE_V1','tablet-new']]);
 let button,requests=[],reloads=0,alerts=[],first=true;
 const cloud={session:{},req:async()=>[{revision:7,publisher_device:'tablet-new'}],rpc:async(name,args)=>{
  requests.push(JSON.stringify(args));
  if(dropResponse&&first){first=false;throw Error('network_timeout');}
  return {ok:true};
 }};
 const context={window:{P7Cloud:cloud,P7TabletTest:{cashierBusy:()=>false,isBusy:()=>false},pos7BuildOwnerSnapshot:async()=>({sections:{products:{test:{stock:15}}}})},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 document:{documentElement:{},getElementById:id=>id==='p57Now'?{after:b=>{button=b;}}:null,createElement:()=>({})},
 MutationObserver:class{observe(){}},confirm:()=>true,alert:x=>alerts.push(x),
 crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},location:{reload:()=>reloads++}};
 vm.runInNewContext(script,context);
 await assert.rejects(cloud.rpc('pos7_owner_publish',{}),/اعتمد/);
 await button.onclick();
 if(dropResponse){
  assert.equal(storage.get('POS7_RESTORE_PENDING_R305'),'yes');
  await button.onclick();
  assert.equal(requests[0],requests[1]);
 }
 assert.equal(storage.has('POS7_RESTORE_PENDING_R305'),false);
 assert.equal(storage.get('POS7_TRANSFER_COMPLETED_R305'),'tablet-new');
 assert.equal(reloads,1);
}
(async()=>{await scenario(false);await scenario(true);console.log('PASS normal transfer and retry after lost response preserve the request and require server publisher confirmation')})().catch(e=>{console.error(e);process.exitCode=1});
