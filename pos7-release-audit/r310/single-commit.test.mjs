import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const h=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const label='<script id="pos7-r310-purchase-single-commit">';
assert.equal(h.split(label).length,2);
const script=h.split(label)[1].split('</script>')[0];
const direct=h.match(/function pos7R102SaveStateDirect\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(direct);
assert.ok(direct[0].includes('if(window.pos310DeferSave?.())return;'));
assert.ok(h.includes('window.pos310PurchaseActive?.()?pos7R102SaveStateDirect():localStorage.setItem(KEY,JSON.stringify(state))'));
assert.ok(h.includes('if(window.pos310PurchaseActive?.())return false;'));
assert.ok(h.includes('POS7_RESTORE_PENDING_R305'));
assert.ok(h.includes('window.pos309HomeBatchActive=()=>depth>0;'));
assert.ok(h.includes('window.pako.deflate(value,{level:1});'));
assert.ok(h.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r317-tab2'));

function setup(mode='success'){
 let writes=0;
 const app={
  KEY:'POS7_TRIAL188_CLEAN',
  state:{products:[{id:1,stock:5,stock_revision:1}],purchases:[],suppliers:{},doubleEntryJournal:[]},
  purchaseCart:[{id:1,qty:2}],purchasePayment:'cash',purchaseSource:'main',editingPurchaseId:null,
  localStorage:{setItem(){writes++},getItem(){return null}},
  pos7R100PrepareStockRevisions(){},
  renderPurchaseCart(){},renderHome(){},toast(){},
  pos408GetSettings(){return {autoPrint:mode==='autoprint'}},
  savePurchase(){
   if(mode==='noinvoice')return undefined;
   this.state.products[0].stock=7;
   this.state.suppliers.A=7;
   for(let i=0;i<10;i++){
    this.pos7R102SaveStateDirect();
    if(mode==='throw'&&i===4)throw Error('simulated-mid-save-error');
   }
   if(mode==='false')return false;
   this.state.purchases.push({id:10,number:'PUR-0010'});
   if(mode!=='missingjournal')this.state.doubleEntryJournal.push({
    sourceKey:'purchase:10',balanced:true,posted:true,totalDebitUSD:10,totalCreditUSD:10});
  },
 };
 app.window=app;
 vm.runInNewContext(direct[0],app);
 vm.runInNewContext(script,app);
 return {app,get writes(){return writes}};
}
let t=setup();t.app.savePurchase();
assert.equal(t.writes,1);
assert.equal(t.app.pos310Last.status,'committed');
assert.equal(t.app.pos310Last.deferred,10);
assert.equal(t.app.state.products[0].stock,7);
assert.equal(t.app.state.purchases.length,1);
assert.equal(t.app.state.doubleEntryJournal.length,1);
for(const mode of ['throw','false','missingjournal']){
 t=setup(mode);const original=JSON.stringify(t.app.state);
 assert.equal(t.app.savePurchase(),false,mode+' rejected');
 assert.equal(t.writes,0,mode+' no partial writes');
 assert.equal(JSON.stringify(t.app.state),original,mode+' state restored');
 assert.equal(t.app.purchaseCart.length,1,mode+' draft restored');
 assert.equal(t.app.pos310PurchaseActive(),false);
}
t=setup('noinvoice');assert.equal(t.app.savePurchase(),undefined);assert.equal(t.writes,0);
t=setup('autoprint');t.app.savePurchase();assert.equal(t.writes,10,'auto print uses legacy save');
t=setup();t.app.editingPurchaseId='old';t.app.savePurchase();
assert.equal(t.writes,10,'invoice edits use legacy save');
console.log('R310 PASS: one write after ten attempts; journal, inventory, supplier, rollback, no invoice and fallbacks');
