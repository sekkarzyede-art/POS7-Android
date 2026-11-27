const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const [base,candidate]=process.argv.slice(2).map(p=>fs.readFileSync(p,'utf8'));
const block=(h,id)=>h.split('<script id="'+id+'">')[1].split('</script>')[0];
const fixture={customers:{A:0,B:0},openingBalanceEntries:[{partyType:'customer',partyName:'A',amountUSD:10,date:'2025-01-01'}],sales:[{customer:'A',totalUSD:20,date:'2025-01-04'},{customer:'B',totalUSD:5,date:'2025-01-04'}],salesReturns:[{customer:'A',r365:true,totalUSD:40,date:'2025-01-06'}],customerPayments:[{customer:'A',amountUSD:4,date:'2025-01-05'}],returnVouchers:[{kind:'return_payment',customer:'A',amountUSD:3,date:'2025-01-09'}]};
function testBalances(html){
 const s=block(html,'pos7-v396-customer-statement-date-range');
 const body=s.slice(s.indexOf('function openingItems'),s.indexOf('function renderLedger'));
 const w={};
 vm.runInNewContext(body,{state:fixture,window:w,N:x=>Number(x)||0});
 return w;
}
const old=testBalances(base),now=testBalances(candidate);
const names=['A','B','none'];
assert.deepEqual(now.pos389WithBalanceIndex(()=>names.map(now.pos398CustomerStatementBalanceUSD)),names.map(old.pos398CustomerStatementBalanceUSD));
assert.equal(now.pos398CustomerStatementBalanceUSD('A'),-11);
const calls=[],notes=[],bridge={getSelectedBluetoothPrinterAddress:()=> 'TEST'};
let syncing=true;
const context=vm.createContext({window:{Pos7Android:bridge,pos408PrintVoucher:async(v)=>{calls.push(v.ref);return true},pos789SyncIsBusy:()=>syncing},toast:x=>notes.push(x),setTimeout:fn=>{syncing=false;queueMicrotask(fn)}});
const js=block(candidate,'pos7-r389-voucher-performance').split('const pos389Home')[0];
vm.runInContext(js,context);
(async()=>{
 await vm.runInContext("pos389Print({ref:'PAY-1'});pos389Print({ref:'PAY-1'});pos389Print({ref:'RCV-1'});pos389Queue",context);
 assert.deepEqual(calls,['PAY-1','RCV-1']);
 bridge.getSelectedBluetoothPrinterAddress=()=> '';
 vm.runInContext("pos389Print({ref:'PAY-2'})",context);
 assert.equal(calls.length,2);
 assert.equal(await vm.runInContext('pos389WaitPayment({open:true})',context),true);
 assert.equal(context.window.pos389QuickWaiting,0);
 assert.equal(await vm.runInContext('pos389WaitPayment({open:false})',context),false);
 assert(candidate.includes("device:'TAB1',durationSeconds"));
 console.log('R389 scoped balance parity, print deduplication and quick payment wait passed');
})().catch(e=>{console.error(e);process.exitCode=1});
