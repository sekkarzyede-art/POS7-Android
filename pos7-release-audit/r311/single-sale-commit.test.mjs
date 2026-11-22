import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const extract=id=>{
 const token='<script id="'+id+'">';
 assert.equal(html.split(token).length,2,'script missing or duplicate '+id);
 return html.split(token)[1].split('</script>')[0];
};
const r310=extract('pos7-r310-purchase-single-commit');
const r311=extract('pos7-r311-sale-single-commit');
const save=html.match(/function pos7R102SaveStateDirect\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(save,'base durable save function');
assert.ok(save[0].includes('if(window.pos310DeferSave?.())return;'));
assert.ok(r310.includes('if(window.pos311SaleActive?.())return window.pos311DeferSaleSave();'));
assert.ok(html.includes("(window.pos311SaleActive?.()?pos7R102SaveStateDirect():localStorage.setItem(KEY,JSON.stringify(state)))"));
assert.ok(html.includes("if(window.pos311SaleActive?.())return false;"));
assert.ok(html.includes("if(saved&&!window.pos311SaleActive?.())"));
assert.ok(html.includes("if(!window.pos311SaleActive?.())checkpoint()"));
assert.ok(html.includes("window.pos311CheckpointSaleBasket=function(){checkpoint()}"));
assert.ok(html.includes("المتجر الثاني — قاعدة مستقلة • 485.7.229-r311-tab2"));
assert.ok(html.includes("window.pos310Installed=true"));
assert.ok(html.includes("window.pos309HomeBatchActive=()=>depth>0;"));
assert.ok(html.includes("POS7_RESTORE_PENDING_R305"));

function setup(mode='cash'){
 const key='POS7_TRIAL188_CLEAN',store={};let writes=0,drafts=0;
 let messages=[];
 const elements=new Map();
 function el(id){
  if(!elements.has(id))elements.set(id,{value:'original-'+id,textContent:'original-'+id,
      innerHTML:'old-'+id});
  return elements.get(id);
 }
 const app={
  KEY:key,
  state:{products:[{id:1,stock:9,stock_revision:3}],sales:[],
    customers:{test:0},cash:{},doubleEntryJournal:[]},
  saleCart:[{id:1,qty:1,sell:7,cost:3}],
  salePayment:'cash',salePaymentType:mode==='credit'?'credit':'cash',editingSaleId:null,
  editingPurchaseId:null,purchaseCart:[],purchasePayment:'cash',purchaseSource:'daily',
  POS7_R166_RELOAD_REQUIRED:false,POS7_R167_RECONCILIATION_PENDING:false,POS7_R212_BATCH_ACTIVE:false,
  pos7R100PrepareStockRevisions(){},
  renderHome(){},renderProducts(){},renderCart(){},renderPurchaseCart(){},
  toast(x){messages.push(String(x))},
  console:{warn(){},error(){}},
  document:{getElementById:el},
  pos408GetSettings(){return {autoPrint:mode==='autoprint'}},
  savePurchase(){return false;},
  saveSale(){
    if(mode==='noinvoice')return undefined;
    this.state.products[0].stock--;
    this.state.customers.test+=7;
    for(let i=0;i<3;i++){
      this.pos7R102SaveStateDirect();
      if(mode==='throw'&&i===1)throw Error('simulated_sale_exception');
    }
    if(mode==='reject')return false;
    this.state.sales.push({id:555,number:'SAL-555',customer:'test',
      items:[{id:1,qty:1}],total:7,paid:7,debt:0});
    if(mode!=='missingjournal')this.state.doubleEntryJournal.push({
      sourceKey:'sale:555',balanced:true,posted:true,totalDebitUSD:7,totalCreditUSD:7});
    if(mode==='earlywrite')this.localStorage.setItem(key,JSON.stringify(this.state));
    this.pos7R102SaveStateDirect();
    this.saleCart=[];
    return undefined;
  }
 };
 app.localStorage={
  getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null},
  setItem(k,v){if(k===key){if(mode==='diskfail')throw Error('disk full');writes++;}
    store[k]=v;},
  removeItem(k){delete store[k]}
 };
 store[key]=JSON.stringify(app.state);
 app.window=app;
 vm.runInNewContext(save[0],app);
 vm.runInNewContext(r310,app);
 vm.runInNewContext(r311,app);
 app.pos311CheckpointSaleBasket=()=>{drafts++};
 return {app,store,key,get writes(){return writes},get drafts(){return drafts},messages};
}
for(const mode of ['cash','credit']){
 const t=setup(mode);
 t.app.saveSale();
 assert.equal(t.writes,1,mode+' exactly one durable state write');
 assert.equal(t.app.pos311Last.status,'committed');
 assert.equal(t.app.pos311Last.deferred,4);
 assert.equal(t.app.pos311Last.durableWrites,1);
 assert.equal(t.app.state.sales.length,1);
 assert.equal(t.app.state.products[0].stock,8);
 assert.equal(t.app.state.doubleEntryJournal.length,1);
 assert.equal(JSON.parse(t.store[t.key]).sales.length,1);
 assert.equal(t.drafts,1,'basket checkpoint after final outcome');
 assert.equal(t.app.pos311SaleActive(),false);
}
for(const mode of ['throw','reject','missingjournal','diskfail']){
 const t=setup(mode),before=JSON.stringify(t.app.state);
 assert.equal(t.app.saveSale(),false,mode+' rejected');
 assert.equal(t.writes,0,mode+' does not store partial invoice');
 assert.equal(JSON.stringify(t.app.state),before,mode+' rolls back invoice, stock, customer, ledger');
 assert.equal(t.app.saleCart.length,1,mode+' basket restored');
 assert.equal(t.app.pos311SaleActive(),false);
 assert.equal(t.drafts,1,'draft checkpoint after rollback');
}
{
 const t=setup('noinvoice'),before=JSON.stringify(t.app.state);
 assert.equal(t.app.saveSale(),undefined);
 assert.equal(t.writes,0);
 assert.equal(JSON.stringify(t.app.state),before);
}
for(const mode of ['autoprint','edit']){
 const t=setup(mode);
 if(mode==='edit')t.app.editingSaleId=777;
 t.app.saveSale();
 assert.equal(t.writes,4,mode+' retains R309 four-write legacy mode');
}
{
 const t=setup('earlywrite');
 t.app.saveSale();
 assert.equal(t.writes,2);
 assert.equal(t.app.pos311Last.status,'committed_extra_write');
 assert.equal(JSON.parse(t.store[t.key]).sales.length,1);
}
console.log('R311 passed: cash/credit one-write, journal/inventory/customer durable, rollback on throw/refusal/journal/disk, legacy edit/print, draft recovery and early-write safety fallback.');
