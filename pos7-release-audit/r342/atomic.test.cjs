'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let html=fs.readFileSync(process.argv[2]||'R340/index.html','utf8');
let code=html.match(/<script id="pos7-r212-batch-inventory">([\s\S]*?)<\/script>/)[1];
code=code.replace('window.POS7_R213={preview,load,check:isSafe};','window.POS7_R213={preview,load,check:isSafe,step,recover,reconcileAtomicBatch};');
function create(n,options={}){
 const dev='tablet-device-12345'; const store=new Map();
 const prods=Array.from({length:n},(_,i)=>({id:'p'+i,barcode:String(8000000000000+i),stock:i+1,stock_revision:0}));
 const cloud=Object.fromEntries(prods.map(p=>[p.id,{...p}]));
 const cmds=prods.map((p,i)=>({event_id:'event'+i,status:'pending',payload:{product_id:p.id,barcode:p.barcode,batch_id:'BATCH-X',source:'owner_phone_inventory',requires_tablet_validation:true,baseline_qty:p.stock,counted_qty:p.stock+10,stock_revision:0}}));
 const job={version:342,batch:'BATCH-X',ids:cmds.map(x=>x.event_id),approved:[],issues:[],state:'running',ownerConfirmedCount:true,confirmed:Object.fromEntries(cmds.map(x=>[x.event_id,{barcode:x.payload.barcode,count:x.payload.counted_qty}]))};
 store.set('POS7_TRIAL188_CLEAN',JSON.stringify({products:prods.map(x=>({...x}))}));
 store.set('POS7_R212_BATCH_PROGRESS_V1',JSON.stringify(job));
 store.set('POS7_CLOUD_DEVICE_V1',dev);
 let commits=0, prepares=0, reconciles=[],reloads=0,renders=0;
 const context={window:{POS7_R341_normalizeBarcode:(barcode)=>{const raw=String(barcode??'').trim();return /^[0-9]+$/.test(raw)?raw.replace(/^0+(?=\d)/,''):raw;},POS7_R340_local:(products,id,barcode)=>products.filter(p=>p.barcode===barcode),POS7_R188_preflightInventory:()=>({ok:true}),POS7_R166_reconcileCommittedInventory:async(event,payload)=>{
    reconciles.push(event);
    const durable=JSON.parse(store.get('POS7_TRIAL188_CLEAN'));
    const product=durable.products.find(p=>p.id===payload.product_id);
    product.stock=payload.counted_qty;product.stock_revision++;
    durable.pos7InventoryApplied=durable.pos7InventoryApplied||{};
    durable.pos7InventoryApplied[event]={eventId:event,productId:product.id,after:product.stock};
    durable.inventoryAdjustments=[...(durable.inventoryAdjustments||[]),{cloudEventId:event,after:product.stock}];
    store.set('POS7_TRIAL188_CLEAN',JSON.stringify(durable));
    context.window.POS7_R166_RELOAD_REQUIRED=true;
    return{status:'local_reconciled_reload_required'};
  },location:{reload:()=>reloads++}},
  renderStock:()=>renders++,renderProducts:()=>renders++,renderHome:()=>renders++,document:{readyState:'loading',addEventListener(){},getElementById:()=>({textContent:''})},
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,String(val))},sessionStorage:{getItem:()=>null,removeItem(){}},state:{products:prods},console};
 context.window.P7Cloud={session:{},req:async uri=>{
  if(uri.includes('pos7_owner_commands')){
   if(uri.includes('event_id=eq.'))return [cmds.find(c=>c.event_id===decodeURIComponent(uri.split('event_id=eq.')[1].split('&')[0]))].filter(Boolean);
   return cmds.filter(x=>x.status==='pending');
  }
  if(uri.includes('pos7_owner_snapshot'))return[{revision:500,publisher_device:dev,sections:{products:cloud}}];
  if(uri.includes('pos7_inventory_gate_r152'))return[{enabled:true,approved_device:dev}];
  throw Error('unknown GET '+uri);
 },rpc:async(name,args)=>{
  if(name==='pos7_inventory_prepare_r340'){
   prepares++;const c=cmds.find(x=>x.event_id===args.p_event_id);
   const p=cloud[c.payload.product_id];c.payload={...c.payload,baseline_qty:p.stock,stock_revision:p.stock_revision};
   return{status:'prepared',payload:c.payload,product:p};
  }
  if(name==='pos7_inventory_commit_batch_atomic_r341'){
   commits++;
   if(options.rejectCommit)throw Error('transport_down');
   if(options.blocked)throw Error('inventory_snapshot_conflict');
   assert.equal(args.p_verified_tablet_stock,true);
   assert.equal(args.p_ids.length,n);
   for(const c of cmds){c.status='processed';c.result={status:'committed',commit_protocol:'r155',event_id:c.event_id,after:c.payload.counted_qty};}
   return{status:'committed',count:n,items:cmds.map(c=>({event_id:c.event_id}))};
  }
  throw Error('unknown RPC '+name);
 }};
 vm.createContext(context);vm.runInContext(code,context);
 return{context,store,cmds,run:()=>context.window.POS7_R213.step(),recover:()=>context.window.POS7_R213.recover(),metrics:()=>({commits,prepares,reconciles,reloads,renders}),job:()=>JSON.parse(store.get('POS7_R212_BATCH_PROGRESS_V1'))};
}
(async()=>{
 for(const n of [5,10,20]){
  const t=create(n);await t.run();const m=t.metrics();
  assert.equal(m.commits,1);assert.equal(m.prepares,n);assert.equal(m.reconciles.length,n);
  assert.equal(m.reloads,0,'safe soft refresh must avoid full page reload');assert.equal(m.renders,3);assert.equal(t.job().state,'complete');assert.equal(t.job().approved.length,n);assert.equal(t.context.window.POS7_R166_RELOAD_REQUIRED,false);
  await t.recover();assert.equal(t.metrics().commits,1,'retry must not commit again');
 }
 const blocked=create(5,{blocked:true});await blocked.run();assert.equal(blocked.job().state,'committing');assert.equal(blocked.metrics().reconciles.length,0);
 const pending=create(5,{rejectCommit:true});await pending.run();assert.equal(pending.job().state,'committing');await pending.recover();assert.equal(pending.job().state,'paused');assert.equal(pending.metrics().commits,1);
 console.log('PASS R342: 5/10/20 items use one atomic RPC; confirmed reconciliation, idempotent recovery, no local apply on rejected/unknown commit');
})().catch(e=>{console.error(e);process.exitCode=1});