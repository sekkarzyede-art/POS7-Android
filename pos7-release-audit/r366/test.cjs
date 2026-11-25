const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(process.argv[2]||'POS7_Tab2_R366_Returns.html','utf8');
const script=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1];
let saves=0,fail=false;
const context={console,Date,Map,Set,Number,String,Math,JSON,Error,Object,window:null,document:{getElementById(){return null},querySelector(){return null}},localStorage:{getItem(){return '1'}},
 toast(){},mcTransfer:null,pos222Exchange:null,pos7R102SaveStateDirect(){if(fail)throw Error('disk full');saves++},mcBalance(account){return context.state.mcLedger.filter(x=>x.account===account).reduce((s,x)=>s+x.amount,0)},
 state:{},POS7_CHART_OF_ACCOUNTS:[],v250Can:()=>true,pos265InvoiceDebtUSD:x=>x.debtUSD??(x.currency==='LBP'?x.debt/x.fxRate:x.debt)};
context.window=context;vm.createContext(context);
vm.runInContext(script('pos7-v204-strict-double-entry'),context);
vm.runInContext(script('pos7-r361-wallet-transfer'),context);
vm.runInContext(html.slice(html.indexOf('function pos98AllRefs()'),html.indexOf('function pos98Log(')),context);
context.mcPost=function(parts,sign,ref,title,party,date){for(const p of parts)context.state.mcLedger.push({...p,amount:p.amount*sign,ref,title,party,date});};
vm.runInContext(script('pos7-r365-returns-engine'),context);
function reset(){
 saves=0;fail=false;
 const item={id:1,barcode:'001',name:'ببسي',qty:5,sell:10,cost:8};
 context.state={docSequences:{},fxRate:90000,products:[{id:1,barcode:'001',name:'ببسي',stock:10}],sales:[{id:1,number:'SAL-1',customer:'أحمد',date:'2026-11-01',currency:'USD',debt:5,total:100,paid:95,items:[item]}],
 purchases:[{id:2,number:'PUR-1',supplier:'مورد',date:'2026-11-01',currency:'USD',debt:0,total:100,paid:100,items:[item]}],customers:{أحمد:5},suppliers:{مورد:0},mcLedger:[{account:'cashier_usd',amount:100},{account:'main_usd',amount:100}],doubleEntryJournal:[]};
}
const engine=context.POS7R365;
function item(sale=true,qty=1){return {invoice:(sale?context.state.sales:context.state.purchases)[0],index:0,qty,damaged:false}}
function commit(sale=true,choice='cash',account='cashier_usd',token='t',items=[item(sale)]){
 return engine.commit(sale,items,new Map([[items[0].invoice.id,choice]]),account,90000,token);
}
reset();let result=commit();assert.equal(result[0].debtReduction,5);assert.equal(result[0].cashRefund,5);assert.equal(context.state.products[0].stock,11);assert.equal(context.mcBalance('cashier_usd'),95);assert.equal(saves,1);assert.equal(context.state.doubleEntryJournal.length,2);assert.equal(engine.debts(true,'أحمد').get('1'),0);commit();assert.equal(saves,1);assert.equal(context.state.salesReturns.length,1);
reset();context.state.sales[0].debt=100;result=commit();assert.equal(result[0].cashRefund,0);assert.equal(context.state.returnVouchers.length,0);assert.equal(engine.debts(true,'أحمد').get('1'),9000);
reset();context.state.sales[0].debt=100;context.state.customerPayments=[{customer:'أحمد',amountUSD:100,date:'2026-11-02'}];result=commit();assert.equal(result[0].debtReduction,0);assert.equal(result[0].cashRefund,10);
reset();result=commit(true,'credit');assert.equal(result[0].creditAmountUSD,5);assert.equal(context.mcBalance('cashier_usd'),100);
reset();result=commit(false,'cash','main_usd');assert.equal(context.state.products[0].stock,9);assert.equal(context.mcBalance('main_usd'),108);assert.equal(result[0].cashRefund,8);
reset();context.state.purchases[0].debt=50;result=commit(false,'credit','main_usd');assert.equal(result[0].debtReduction,8);
reset();const before=JSON.stringify(context.state);fail=true;assert.equal(commit(),null);assert.equal(JSON.stringify(context.state),before);fail=false;assert(commit());assert.equal(saves,1);
reset();context.state.mcLedger=[];assert.equal(commit(),null);assert.equal(context.state.salesReturns,undefined);
reset();context.state.products[0].stock=0;assert.equal(commit(false,'cash','main_usd'),null);
reset();result=commit(true,'cash','cashier_usd','t',[{...item(),damaged:true}]);assert.equal(context.state.products[0].stock,10);assert.equal(result[0].profitLossUSD,10);
reset();context.state.sales[0].discount=5;context.state.sales[0].grossTotal=50;result=commit();assert.equal(result[0].total,9);
reset();context.state.salesReturns=[{id:3,invoiceId:1,total:40,items:[{id:1,qty:4}],debtReductionAppliedToInvoice:true}];assert.equal(engine.quantity(true,context.state.sales[0],0),1);assert.equal(commit(true,'cash','cashier_usd','t',[item(true,2)]),null);
reset();context.state.sales[0].currency='LBP';context.state.sales[0].fxRate=90000;context.state.sales[0].items[0].sell=900000;context.state.sales[0].items[0].cost=720000;context.state.sales[0].debt=450000;context.state.sales[0].total=9000000;result=commit();assert.equal(result[0].total,10);assert.equal(result[0].debtReduction,5);
reset();context.state.mcLedger.push({account:'cashier_lbp',amount:9000000});result=commit(true,'cash','cashier_lbp');assert.equal(context.mcBalance('cashier_lbp'),8550000);
for(const s of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/application\/json/.test(s[1])||!s[2].trim())continue;new vm.Script(s[2]);}
assert(!html.includes('SRT-TEST'));assert(!html.includes('اعتماد تجريبي داخل هذه الجلسة'));
console.log('14 return scenarios and all inline script syntax passed');
vm.runInContext(script('pos7-v396-customer-statement-date-range'),context);
reset();commit();assert.equal(context.pos398CustomerStatementBalanceUSD('أحمد'),0);
reset();commit(true,'credit');assert.equal(context.pos398CustomerStatementBalanceUSD('أحمد'),-5);
reset();context.state.sales[0].debt=100;context.state.sales[0].paid=0;context.state.customerPayments=[{customer:'أحمد',amountUSD:100,date:'2026-11-02'}];commit();assert.equal(context.pos398CustomerStatementBalanceUSD('أحمد'),0);
context.pos387BalanceUSD=()=>context.state.purchases.reduce((s,x)=>s+(x.debt||0),0);
context.pos265SupplierBalanceUSD=context.pos387BalanceUSD;
vm.runInContext(script('pos7-r365-returns-integration'),context);
reset();commit(false,'credit','main_usd');assert.equal(context.pos265SupplierBalanceUSD('مورد'),-8);
reset();commit(false,'cash','main_usd');assert.equal(context.pos265SupplierBalanceUSD('مورد'),0);
reset();context.state.purchases[0].debt=50;commit(false,'cash','main_usd');assert.equal(context.pos265SupplierBalanceUSD('مورد'),42);
console.log('Customer and supplier balances verified for credit, cash and later payments');
reset();let first=commit(true,'credit','cashier_usd','one');let second=commit(true,'credit','cashier_usd','two');assert.equal(second[0].number,'SRT-000002');assert.notEqual(first[0].id,second[0].id);
console.log('Sequential return numbers verified');
reset();first=commit(true,'credit','cashier_usd','one');context.state.salesReturns[0].cancelled=true;second=commit(true,'credit','cashier_usd','two');assert.equal(second[0].number,'SRT-000002');
console.log('Cancelled historical numbers remain reserved');

// Real shared document numbering: ordinary, return, cancelled and stale sequence values.
reset();context.state.supplierPayments=[{id:10,ref:'PAY-000042',cancelled:true}];
context.state.returnVouchers=[{id:'old',number:'PAY-000060',cancelled:true}];
result=commit();assert.equal(result[0].voucherNumber,'PAY-000061');assert.equal(context.pos98NextRef('supplierPayment'),'PAY-000062');
assert.equal(context.state.mcLedger.filter(x=>x.ref==='PAY-000061').length,1);
assert(context.state.returnVouchers.at(-1).reason.includes('SAL-1'));
assert(context.state.mcLedger.at(-1).title.includes('سند صرف'));
reset();context.state.customerPayments=[{ref:'RCV-000100',customer:'آخر',amountUSD:1}];result=commit(false,'cash','main_usd');assert.equal(result[0].voucherNumber,'RCV-000101');
// Excess automatically pays out even with no explicit settlement choice.
reset();result=engine.commit(true,[item()],new Map(),'cashier_usd',90000,'auto');assert.equal(result[0].cashRefund,5);
// Current customer balance across two source invoices, not invoice-local debt.
reset();context.state.sales[0].debt=0;context.state.sales[0].paid=100;
context.state.sales.push({...context.state.sales[0],id:2,number:'SAL-2',debt:6,paid:94});
result=commit();assert.equal(result[0].debtReduction,6);assert.equal(result[0].cashRefund,4);assert.equal(engine.debts(true,'أحمد').get('2'),0);assert.equal(context.pos398CustomerStatementBalanceUSD('أحمد'),0);
// Two returned invoices in one transaction consume outstanding balance once.
reset();context.state.sales.push({...context.state.sales[0],id:2,number:'SAL-2',debt:0,paid:100});
result=engine.commit(true,[item(),{invoice:context.state.sales[1],index:0,qty:1}],new Map(),'cashier_usd',90000,'batch');
assert.equal(result.reduce((s,x)=>s+x.debtReduction,0),5);assert.equal(result.reduce((s,x)=>s+x.cashRefund,0),15);
assert.equal(new Set(context.state.returnVouchers.map(x=>x.id)).size,2);
console.log('Shared voucher sequence, single cash effect, auto excess, account-wide and batch allocation passed');
