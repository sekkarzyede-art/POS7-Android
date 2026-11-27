(function(){
 'use strict';
 const cashAccounts=new Set(['cashier_usd','cashier_lbp','main_usd','main_lbp']);
 const positiveRate=(...values)=>values.map(Number).find(v=>Number.isFinite(v)&&v>0);
 function movementLabel(title,ref){
  if(/عكس|إلغاء|معدلة|تعديل|تسوية|مرتجع|إرجاع/.test(title))return title.split(' — ')[0];
  if(/فاتورة بيع|باقي مُعاد للزبون/.test(title)||/^SAL-/i.test(ref))return 'ف بيع';
  if(/فاتورة شراء|مبلغ مُعاد من المورد/.test(title)||/^PUR-/i.test(ref))return 'ف شراء';
  if(/سند قبض|قبض من الزبون/.test(title))return 'قبض زبون';
  if(/سند صرف/.test(title))return 'سند صرف مورد';
  return title.split(' — ')[0]||'حركة صندوق';
 }
 function snapshot(book,now){
  const end=+now,start=+new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const displayDay=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(now);
  const displayTime=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
  const rateByRef=new Map();
  for(const docs of [book.sales,book.purchases,book.customerPayments,book.supplierPayments,book.expenses,book.returnVouchers]){
   for(const doc of docs||[]){
    if(!doc)continue;
    const rate=positiveRate(doc.fxRate,doc.exchangeRate,doc.rate);
    if(!rate)continue;
    for(const ref of [doc.number,doc.ref,doc.recordNo,doc.voucherNo]){
     if(ref&&!rateByRef.has(String(ref)))rateByRef.set(String(ref),rate);
    }
   }
  }
  const groups=new Map();
  let estimated=false;
  for(const [index,row] of (book.mcLedger||[]).entries()){
   if(!row||!cashAccounts.has(row.account)||!row.date)continue;
   const stamp=+new Date(row.date),amount=Number(row.amount);
   if(!Number.isFinite(stamp)||stamp<start||stamp>end||!Number.isFinite(amount)||!amount)continue;
   const ref=String(row.ref||'').trim(),party=String(row.party||'').trim(),title=String(row.title||'').trim();
   const label=movementLabel(title,ref);
   let usd=amount;
   if(row.account.endsWith('_lbp')){
    const refInTitle=title.match(/\b(?:SAL|PUR)-\d+\b/i)?.[0];
    const historical=positiveRate(row.fxRate,row.exchangeRate,rateByRef.get(ref),rateByRef.get(ref.replace(/-REV$/i,'')),rateByRef.get(refInTitle));
    if(!historical)estimated=true;
    usd=amount/(historical||positiveRate(book.fxRate)||90000);
   }
   const direction=amount>0?1:-1;
   const key=ref?JSON.stringify([ref,stamp,label,party,direction]):index;
   const entry=groups.get(key)||{stamp,label,party,ref:ref.replace(/^(?:SAL|PUR)-0*(\d+)$/i,'$1'),usd:0};
   entry.usd+=usd;
   groups.set(key,entry);
  }
  const rows=Array.from(groups.values()).sort((a,b)=>a.stamp-b.stamp).map(row=>({...row,cents:Math.round(Math.abs(row.usd)*100)*Math.sign(row.usd)}));
  let incoming=0,outgoing=0;
  for(const row of rows){if(row.cents>0)incoming+=row.cents;else outgoing-=row.cents;}
  return {displayDay,displayTime,rows,incoming,outgoing,balance:incoming-outgoing,estimated};
 }
 window.pos397DailyCashSnapshot=snapshot;
 window.pos397PrintDailyCash=function(){
  if(!document.getElementById('home')?.classList.contains('active'))return;
  if(pos391Private)return pos391Blocked();
  if(!window.v250Can?.('cash'))return toast('لا توجد صلاحية لعرض حركة الصندوق');
  const now=new Date(),report=snapshot(state,now);
  return window.pos397SendCashReceipt(report);
 };
})();
