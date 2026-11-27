const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const h=fs.readFileSync(process.argv[2],'utf8');
let a=h.indexOf('/* POS7 R352'),b=h.indexOf('/* R354: integrated',a);
vm.runInThisContext(h.slice(a,b));
a=h.indexOf('function pos7R384PrepareBackup');b=h.indexOf('function pos7R354OpenBackup',a);
vm.runInThisContext(h.slice(a,b));
a=h.indexOf('function pos7R353BarcodeKey');b=h.indexOf('function pos7R100PrepareStockRevisions',a);
vm.runInThisContext(h.slice(a,b));
global.nv=x=>Number(x)||0;
const p=(id,barcode,stock)=>({id,barcode,stock,name:barcode,cost:2,piecesPerBox:30,stock_revision:1});
const data={products:[p(1794065603603,'٨٠٠٠٥٠٠١٢١٤٤٣',4),p(1791754111401,'08000500121443',1),p(1791754307184,'7622400001710',0.5),p(1791754445965,'07622400001710',0)],sales:[{number:'S1',items:[{id:1791754111401,barcode:'08000500121443',qty:0.5,cost:2,sell:4}]}],purchases:[{number:'P1',items:[{barcode:'08000500121443',qty:1.25,cost:2}]}],salesReturns:[],recordRevisions:[],doubleEntryJournal:[]};
const fixture={app:'POS7',data},original=JSON.stringify(fixture);
const prepare=(b,yes)=>pos7R387Prepare(b,POS7DataDoctorR351.run(b),yes);
const pending=prepare(fixture,false),done=prepare(fixture,true);
assert.equal(JSON.stringify(fixture),original);
assert.equal(pending.report.barcodeMerges.length,1);
assert.equal(done.report.barcodeMerges.length,2);
assert.equal(done.report.inventoryValueBefore-done.report.inventoryValueAfter,2);
assert.equal(done.candidate.data.sales[0].items[0].id,1794065603603);
assert.equal(done.candidate.data.sales[0].items[0].qty,0.5);
assert.equal(done.candidate.data.purchases[0].items[0].id,1794065603603);
global.state=done.candidate.data;
assert.equal(pos7R387ProductForLine(state.purchases[0].items[0]).stock,4);
assert.equal(prepare(done.candidate,true).report.barcodeMerges.length,0);
const unknown=JSON.parse(original);unknown.data.unrecognized={productId:1791754111401};
assert.equal(prepare(unknown,true).report.barcodeMerges.length,1);
const collision=JSON.parse(original);collision.data.products[1].piecesPerBox=24;
assert.equal(prepare(collision,true).report.barcodeMerges.length,1);
const store=new Map([['DB','previous']]);let fail=true,reloads=0;
Object.assign(global,{window:{POS7_R322_NATIVE_STORE:{status:()=>({active:true})},Pos7Android:{pos387SaveRestoreSafety:()=>true}},KEY:'DB',saleCart:[],purchaseCart:[],editingSaleId:null,editingPurchaseId:null,validBackup:()=>true,toast:()=>{},confirm:()=>true,makeBackupObject:()=>({app:'POS7',data:state}),location:{reload(){reloads++}},localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(k==='DB'&&fail)throw Error('disk full');store.set(k,v)},removeItem:k=>store.delete(k)}});
assert.equal(pos7R387CommitLocal(done.candidate),false);
assert.equal(store.get('DB'),'previous');
assert(!store.has('POS7_RESTORE_PENDING_R305'));
fail=false;
assert.equal(pos7R387CommitLocal(done.candidate),true);
assert.equal(reloads,1);
assert.equal(JSON.parse(store.get('DB')).pos7R387LocalRestore,true);
assert.equal(store.get('POS7_RESTORE_PENDING_R305'),'yes');
assert(state.products.every(p=>p.stock_revision===null&&p.stock_revision_untrusted));
if(process.argv[3]){
 const live=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),out=prepare(live,true);
 const {report:r}=out;
 assert.equal(live.data.products.length,4418);
 console.log(JSON.stringify({merges:r.barcodeMerges.map(x=>({code:x.code,refs:x.referencePaths.length,requiresCount:x.requiresCount})),review:r.barcodeReview.map(x=>[x.code,x.reason]),remaining:r.remaining,before:r.inventoryValueBefore,after:r.inventoryValueAfter,local:r.readyForLocalRestore}));
 assert.equal(r.remaining.invalidIds,0);
 assert.equal(r.remaining.duplicateIdGroups,0);
 assert(r.readyForLocalRestore);
 assert.deepEqual(live.data.doubleEntryJournal,out.candidate.data.doubleEntryJournal);
 assert.deepEqual(live.data.pos7InventoryApplied,out.candidate.data.pos7InventoryApplied);
 for(const k of ['sales','purchases','salesReturns','purchaseReturns','customerPayments','supplierPayments','recordRevisions']){
  const scrub=x=>JSON.parse(JSON.stringify(x),(key,v)=>['id','productId','product_id'].includes(key)?undefined:v);
  assert.deepEqual(scrub(live.data[k]),scrub(out.candidate.data[k]),k);
 }
 const fork=out.candidate.data.recordRevisions.flatMap(x=>x.snapshot?.items||[]).find(i=>/فوركو/.test(i.name||''));
 if(fork){global.state=out.candidate.data;assert.equal(pos7R387ProductForLine(fork)?.barcode,fork.barcode);}
}
console.log('R387 local restore, identity and retention assertions passed');
