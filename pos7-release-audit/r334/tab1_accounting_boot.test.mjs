import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('r321-android/tab1/POS7_Tablet/app/src/main/assets/index.html','utf8');
function script(tag){
  assert.equal(html.split(tag).length,2,'unique script anchor: '+tag);
  return html.split(tag)[1].split('</script>')[0];
}
const v105='/* POS7 v105 —'+script('<script>\n/* POS7 v105 —');
const v165=script('<script id="pos7-v165-unified-accounting-journal">');
const clone=x=>JSON.parse(JSON.stringify(x));

assert.ok(v105.includes('if(pos319RepairDirty)persist();'));
assert.ok(v105.includes('pos319RepairDirty=true;'));
assert.ok(!v105.includes('  persist();\n})();'));
assert.ok(v165.includes('if(pos319JournalMissing||state.accountingJournalSeq!==pos319SeqRaw||pos319NewRows>0)'));
assert.ok(v165.includes('pos319ForeignKeys.has(fk)'));
assert.ok(v165.includes('pos319LedgerRefs.has(String(ref))'));
assert.ok(v165.includes("persist=function(){try{sync()}catch(e){console.error('POS7 v165 journal sync',e)}return basePersist.apply(this,arguments)}"));
assert.ok(html.includes('POS7_R174_SMART_CAS_SERVER_VERIFIED'));
assert.ok(html.includes('window.pos310Installed=true'));
assert.ok(!html.includes('window.pos311SaleActive'));

function run105(initial){
 const state=clone(initial);const posted=[];let saves=0;
 const ctx={
   state,window:null,console,Date,Math,JSON,Set,
   nv:x=>Number(x||0),persist:()=>{saves++;},
   mcPost:(parts,sign,ref,title,party,date)=>{posted.push({parts,sign,ref,title,party,date});},
   saveSupplierPayment:()=>{},savePurchase:()=>{},cancelPurchaseEdit:()=>{},
   renderSupplierStatement:()=>{},cashboxRows:()=>[]
 };
 ctx.window=ctx;
 vm.runInNewContext(v105,ctx,{timeout:4000});
 return {state,posted,saves};
}
let a=run105({supplierPayments:[],voucherReversals:[]});
assert.equal(a.saves,0,'v105 clean startup must not persist');
assert.equal(a.posted.length,0,'v105 clean startup must not post');
let b=run105({supplierPayments:[{id:1,ref:'SP-1',supplier:'S',amount:27,account:'main_usd',currency:'USD',date:'2026-11-20T00:00:00Z',cancelled:false,mcPosted:false}],voucherReversals:[]});
assert.equal(b.saves,1,'v105 actual supplier migration must persist');
assert.equal(b.posted.length,1);
assert.equal(b.posted[0].sign,-1);
assert.equal(b.state.supplierPayments[0].mcPosted,true);
assert.equal(run105(b.state).saves,0,'already migrated voucher remains idempotent');
let c=run105({supplierPayments:[{id:2,ref:'SP-OLD',supplier:'S2',amount:15,cancelled:true,mcPosted:false,date:'2026-11-12T00:00:00Z'}],voucherReversals:[]});
assert.equal(c.saves,1,'v105 actual cancellation reversal must persist');
assert.equal(c.state.voucherReversals.length,1);
assert.equal(c.state.voucherReversals[0].historicalRepair,true);
assert.equal(run105(c.state).saves,0,'cancelled repair must not duplicate');

function run165(initial){
 const state=clone(initial);const calls=[];let persistCalls=0;
 const ctx={state,window:null,console,Date,Math,JSON,Map,Set,Number,String,
   KEY:'POS7_TRIAL188_CLEAN',
   localStorage:{setItem:(key,val)=>{calls.push({key,len:val.length})}},
   persist:()=>{persistCalls++;},
   mcPost:(parts,sign,ref,title,party,date)=>{
     state.mcLedger=state.mcLedger||[];
     const x={id:'NEW-'+state.mcLedger.length,ref,title,party,date,account:parts[0]?.account,amount:(parts[0]?.amount||0)*sign,currency:parts[0]?.currency};
     state.mcLedger.push(x);
     return x;
   }
 };
 ctx.window=ctx;
 vm.runInNewContext(v165,ctx,{timeout:4000});
 return {state,ctx,calls,get persistCalls(){return persistCalls}};
}
const old={accountingJournal:[{foreignKey:'mcLedger:A',entryNo:'JE-000000001'}],accountingJournalSeq:1,mcLedger:[{id:'A',ref:'POSTED',account:'main_usd',currency:'USD',amount:22,date:'2026-11-20T00:00:00Z'}],expenses:[{id:5,ref:'POSTED',account:'main_usd',amount:22}]};
const stable=run165(old);
assert.equal(stable.calls.length,0,'v165 clean journal must not serialize/write');
assert.equal(stable.state.accountingJournal.length,1,'v165 no duplicates for existing reference');
stable.ctx.pos165SyncJournal();
assert.equal(stable.state.accountingJournal.length,1,'v165 repeat sync idempotent');
stable.ctx.persist();
assert.equal(stable.persistCalls,1,'v165 persist wrapper retained');

const migrated=run165({mcLedger:[{id:'B',ref:'BILL-B',amount:-50,account:'main_lbp',currency:'LBP',date:'2026-11-20T00:00:00Z'}],expenses:[{id:'E',ref:'BILL-B',amount:50}]});
assert.equal(migrated.calls.length,1,'v165 actual journal migration must write');
assert.equal(migrated.state.accountingJournal.length,1,'legacy expense already backed by ledger is not duplicated');
assert.equal(migrated.state.accountingJournal[0].foreignKey,'mcLedger:B');
assert.equal(migrated.state.accountingJournal[0].signedAmount,-50);
migrated.ctx.pos165SyncJournal();
assert.equal(migrated.state.accountingJournal.length,1,'migration idempotent');
const seqBefore=migrated.state.accountingJournalSeq;
migrated.ctx.mcPost([{account:'main_usd',currency:'USD',amount:25}],1,'NEXT','دفعة جديدة','زبون','2026-11-22T00:00:00Z');
assert.equal(migrated.state.accountingJournal.length,2,'mcPost must immediately add journal row');
assert.equal(migrated.state.accountingJournalSeq,seqBefore+1);
migrated.ctx.pos165SyncJournal();
assert.equal(migrated.state.accountingJournal.length,2,'mcPost row not duplicated during resync');
migrated.state.expenses.push({id:'E2',ref:'NEW-EXP',amount:11,account:'main_usd'});
migrated.ctx.persist();
assert.equal(migrated.state.accountingJournal.filter(x=>x.foreignKey==='expense:E2').length,1,'persistent operations still journaled');

const transfer=run165({accountingJournal:[],accountingJournalSeq:0,mcLedger:[],cashTransfers:[{id:14,ref:'T14',direction:'toMain',amount:800,date:'2026-11-21T10:00:00Z'}]});
assert.equal(transfer.calls.length,1);
assert.deepEqual(Array.from(transfer.state.accountingJournal.map(x=>x.foreignKey)),['cashTransfer:14:OUT','cashTransfer:14:IN']);
assert.equal(transfer.state.accountingJournal.reduce((n,x)=>n+x.signedAmount,0),0,'transfer remains balanced');
console.log('R319 PASS: no-op boot no writes; supplier repairs saved once; journal migrations, strict foreign keys and new cash movements preserved');
