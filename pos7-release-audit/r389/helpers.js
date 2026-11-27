let pos389Queue=Promise.resolve();
const pos389Queued=new Set();
function pos389Print(data){
 const key=String(data.ref);
 if(pos389Queued.has(key))return;
 let address='';
 try{address=window.Pos7Android?.getSelectedBluetoothPrinterAddress?.()||'';}catch(e){}
 if(!address){toast('تم حفظ السند. اختر طابعة Bluetooth للطباعة المباشرة.');return;}
 pos389Queued.add(key);
 pos389Queue=pos389Queue.then(async()=>{
  if(!await window.pos408PrintVoucher(data,'bluetooth'))toast('السند محفوظ. تحقّق من الورقة والطابعة قبل إعادة الطباعة.');
 }).catch(()=>toast('السند محفوظ وتعذّر إرسال الطباعة.')).finally(()=>pos389Queued.delete(key));
}
async function pos389WaitPayment(dialog){
 if(!window.pos789SyncIsBusy?.())return dialog.open;
 const until=Date.now()+30000;
 window.pos389QuickWaiting=(window.pos389QuickWaiting||0)+1;
 try{
  toast('الدفعة بانتظار انتهاء المزامنة الحالية…');
  while(dialog.open&&Date.now()<until){
   await new Promise(resolve=>setTimeout(resolve,150));
   if(!window.pos789SyncIsBusy?.())return dialog.open;
  }
  if(dialog.open)toast('لم تُسجّل الدفعة بعد. المزامنة تحتاج وقتًا أطول.');
  return false;
 }finally{window.pos389QuickWaiting--;}
}
