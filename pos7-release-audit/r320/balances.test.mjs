import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const tag='<script id="pos7-v265-canonical-balances-usd">';
assert.equal(html.split(tag).length,2);
const src=html.split(tag)[1].split('</script>')[0];
assert.ok(src.includes('if(changed)try{persist()}catch(e){}'));
assert.ok(!src.includes("state.suppliers[n]=sBal(n)});try{persist()"));
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r323-tab2'));
assert.ok(html.includes('POS7_RESTORE_PENDING_R305'));
assert.ok(html.includes('window.pos310Installed=true'));
assert.ok(!html.includes('window.pos311SaleActive'));

function simulate(raw){
 const state=structuredClone(raw);const timeouts=[];let writes=0,redraws=0;
 const ctx={state,console,JSON,Date,Math,Number,String,Set,
   window:null,setTimeout:(fn)=>{timeouts.push(fn);return timeouts.length},
   persist:()=>{writes++;},renderHome:()=>{redraws++;},
   renderCustomers:()=>{},renderSuppliers:()=>{},
   document:{getElementById:()=>null},esc:x=>String(x),
   openCustomerDetails:()=>{},openSupplierDetails:()=>{},
   showCustomerMenuReport:()=>{},selectedCustomer:null,selectedSupplier:null
 };
 ctx.window=ctx;
 vm.runInNewContext(src,ctx,{timeout:4000});
 assert.equal(timeouts.length,1,'existing delayed synchronization remains');
 timeouts[0]();
 assert.equal(redraws,1,'home render not altered by R320');
 return {state,writes,ctx};
}
const baseline={customers:{Ali:50},suppliers:{Seller:40},sales:[{customer:'Ali',date:'2026-11-20',total:50,currency:'USD',debt:50}],customerPayments:[],purchases:[{supplier:'Seller',date:'2026-11-20',currency:'USD',total:40,debt:40}],supplierPayments:[]};
const a=simulate(baseline);
assert.equal(a.writes,0,'no-op opening balances must not persist entire store');
assert.equal(a.state.customers.Ali,50);
assert.equal(a.state.suppliers.Seller,40);
const adjusted=structuredClone(baseline);adjusted.customers.Ali=77; adjusted.suppliers.Seller=8;
const b=simulate(adjusted);
assert.equal(b.writes,1,'changed balances still persist once');
assert.equal(b.state.customers.Ali,50);
assert.equal(b.state.suppliers.Seller,40);
const mixed=structuredClone(baseline);mixed.customers.Ali={openingBalanceUSD:3};mixed.suppliers.Seller={openingBalanceUSD:4};
const c=simulate(mixed);
assert.equal(c.writes,0,'already structured opening balance objects not overwritten');
assert.equal(c.state.customers.Ali.openingBalanceUSD,3);
const fromInvoice=structuredClone(baseline);fromInvoice.suppliers={};fromInvoice.purchases.push({supplier:'New',total:19,debt:19,currency:'USD'});
const d=simulate(fromInvoice);
assert.equal(d.writes,1,'new supplier cached balance is persisted');
assert.equal(d.state.suppliers.New,19);
const cancelled=structuredClone(baseline);cancelled.sales.push({customer:'Ali',total:999,debt:999,cancelled:true});
assert.equal(simulate(cancelled).writes,0,'cancelled invoice excluded, no unnecessary save');
console.log('R320 PASS: unchanged balances skip write, real balance corrections persist, objects preserved, new supplier initialized, cancelled invoices ignored');
