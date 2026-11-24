const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2]||'R340/index.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const part=html.match(/<script id="pos7-r166-local-reconciliation">([\s\S]*?)<\/script>/)[1];
let local={products:[{id:'local',barcode:'885',stock:-24,stock_revision:6}],sales:[{id:'sale1',total:40}]};let data=JSON.stringify(local);let ack,cp,cloud;
const ctx={window:{POS7_R213_COUNT_CORRECTION_ACTIVE:true},localStorage:{getItem:()=>data,setItem:(k,v)=>data=v},console};
ctx.window.P7Cloud={session:{},req:async url=>url.includes('commands')?[{status:'processed',payload:cp,result:ack}]:[{sections:{products:{cloud}}}]};vm.createContext(ctx);vm.runInContext(part,ctx);
async function count(event,after){
 const before=JSON.parse(data).products[0];cp={product_id:'cloud',barcode:'885',baseline_qty:-23,counted_qty:after,stock_revision:5};ack={commit_protocol:'r155',status:'committed',event_id:event,product_id:'cloud',barcode:'885',before:-23,after,stock_revision:6,stock_changed:true,snapshot_revision:3792};cloud={id:'cloud',barcode:'885',stock:after,stock_revision:6};ctx.window.POS7_R340_guard={eventId:event,localId:'local',stock:before.stock,revision:before.stock_revision};return ctx.window.POS7_R166_reconcileCommittedInventory(event,cp);
}
(async()=>{
 await count('11111111-1111-4111-8111-111111111111',10);let d=JSON.parse(data);assert.equal(d.products[0].stock,10);assert.equal(d.inventoryAdjustments[0].difference,34);assert.equal(d.inventoryAdjustments[0].productId,'local');assert.equal(d.sales[0].total,40);
 await ctx.window.POS7_R166_reconcileCommittedInventory('11111111-1111-4111-8111-111111111111',cp);assert.equal(JSON.parse(data).inventoryAdjustments.length,1);
 await count('22222222-2222-4222-8222-222222222222',7);d=JSON.parse(data);assert.equal(d.products[0].stock,7);assert.equal(d.inventoryAdjustments.length,2);
 assert.equal(ctx.window.POS7_R340_local([{id:1,barcode:'x'},{id:2,barcode:'x'}],1,'x').length,0);
 ctx.window.POS7_R340_guard.stock=999;d.pos7InventoryApplied={};data=JSON.stringify(d);await assert.rejects(ctx.window.POS7_R166_reconcileCommittedInventory('22222222-2222-4222-8222-222222222222',cp),/local_changed_since_confirmation/);
 console.log('PASS: syntax; stale quantity; unique barcode with changed ID; repeat count new request; idempotent retry; duplicate barcode; concurrent stock change; sales preserved');
})().catch(e=>{console.error(e);process.exit(1)});
