from pathlib import Path
import hashlib,sys
p=Path(sys.argv[1]);raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()=='0307d17448900cdc5c276296a8263d05690209f2d8e913196b2d49555bebd2e8'
h=raw.decode('utf8')
def one(a,b):
 global h
 assert h.count(a)==1,(a,h.count(a));h=h.replace(a,b,1)
one('async function sync(auto=false,afterCommit=false){\n','async function sync(auto=false,afterCommit=false){\n // R348: do not start a new background publication while inventory is reserving the idle slot. Existing publication finishes normally.\n if(window.POS7_R348_SYNC_RESERVED)return false;\n')
a=h.index('<script id="pos7-r212-batch-inventory">');b=h.index('</script>',a);part=h[a:b]
part=part.replace('window.P7TabletTest?.cashierBusy()','inventoryCashierBusy()')
marker='const tell=t=>{if(el(\'r212-status\'))el(\'r212-status\').textContent=t;};'
assert part.count(marker)==1
part=part.replace(marker,marker+'''
// R348: a saved/parked cart on another page is not a transaction in progress.
// Never discard a draft; calculator and actual purchase save remain protected.
function inventoryCashierBusy(){
 if(window.pos310PurchaseActive?.())return true;
 const api=window.P7TabletTest;
 if(!api?.cashierBusy?.())return false;
 if(typeof document.querySelector!=='function')return true;
 if(document.querySelector('#saleCalculatorModal.show,#purchaseCalculatorModal.show'))return true;
 const page=document.querySelector('.page.active');
 return !page||['sales','purchase'].includes(page.id);
}
function publisherBusy(){return !!window.P7TabletTest?.isBusy?.();}
async function waitPublisherIdle(timeoutMs=45000,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now()){
 const end=now()+timeoutMs;
 while(publisherBusy()){
  if(now()>=end)throw Error('المزامنة لم تنتهِ ضمن المهلة؛ الطلبات محفوظة ولم تُعتمد.');
  await pause(250);
 }
}
let approvalWaiting=false,previewWaiting=false;
''')
assert part.count('async function getCloud(batch=null){')==1
part=part.replace('async function getCloud(batch=null){','async function getCloud(batch=null,readOnly=false){')
part=part.replace(" if(window.P7TabletTest?.isBusy())throw Error('R345_wait_for_sync');"," if(!readOnly&&publisherBusy())await waitPublisherIdle();")
old='''async function preview(){
 if(busy)return;'''
new='''async function preview(){
 if(busy||approvalWaiting||previewWaiting)return;
 previewWaiting=true;'''
assert part.count(old)==1;part=part.replace(old,new)
part=part.replace("const host=el('r212-batches');if(!host)return;","const host=el('r212-batches');if(!host){previewWaiting=false;return;}")
old="""  let {rows,snapshot,device}=await getCloud();
  const repair=await repairCloudRevisions(snapshot,device);
  ({rows,snapshot,device}=await getCloud());
  const trust=await trustMatchingCatalog(snapshot,device);"""
new="""  let {rows,snapshot,device}=await getCloud(null,true);
  let repair={updated:0},trust={updated:0};
  // Read-only preview is always possible; revision writes reserve the publisher only when idle.
  if(!publisherBusy()&&!window.POS7_R348_SYNC_RESERVED&&!inventoryCashierBusy()&&!busy){
   window.POS7_R348_SYNC_RESERVED=true;
   try{
    repair=await repairCloudRevisions(snapshot,device);
    ({rows,snapshot,device}=await getCloud(null,true));
    if(!publisherBusy()&&!inventoryCashierBusy())trust=await trustMatchingCatalog(snapshot,device);
   }finally{window.POS7_R348_SYNC_RESERVED=false;}
  }"""
assert part.count(old)==1;part=part.replace(old,new)
old="""    const existing=load();if(busy){tell('جارٍ فحص الجرد');return;}"""
new="""    if(approvalWaiting||previewWaiting||busy){tell('جارٍ فحص الجرد');return;}
    approvalWaiting=true;btn.disabled=true;window.POS7_R348_SYNC_RESERVED=true;
    try{
    const existing=load();"""
assert part.count(old)==1;part=part.replace(old,new)
old="""    if(inventoryCashierBusy()||window.P7TabletTest?.isBusy()){tell('أكمل الفاتورة أو المزامنة الحالية أولًا');return;}"""
new="""    if(inventoryCashierBusy()){tell('توجد فاتورة نشطة أو حاسبة مفتوحة؛ أغلقها دون حذف المسودة.');return;}
    if(publisherBusy()){tell('جارٍ انتظار انتهاء المزامنة الحالية تلقائيًا؛ لا تضغط مجددًا.');await waitPublisherIdle();}
    if(inventoryCashierBusy()||busy||active(load())){tell('تغيّرت حالة العمل أثناء الانتظار؛ لم يُعتمد شيء.');return;}
    if(!window.P7Cloud?.session||localStorage.getItem('POS7_RESTORE_PENDING_R305')||window.POS7_R322_NATIVE_STORE?.status().error){tell('الاتصال أو التخزين غير جاهز؛ الطلبات محفوظة.');return;}"""
assert part.count(old)==1;part=part.replace(old,new)
old="""    }catch(e){tell('تعذر إعداد مرجع الجرد: '+str(e.message||e));}
   };"""
new="""    }catch(e){tell('تعذر إعداد مرجع الجرد: '+str(e.message||e));}
    }catch(e){tell(str(e.message||e));}finally{approvalWaiting=false;window.POS7_R348_SYNC_RESERVED=false;btn.disabled=false;}
   };"""
assert part.count(old)==1;part=part.replace(old,new)
old=""" }catch(e){host.textContent='تعذر الفحص: '+str(e.message||e)}
}"""
new=""" }catch(e){host.textContent='تعذر الفحص: '+str(e.message||e)}finally{previewWaiting=false;}
}"""
assert part.count(old)==1;part=part.replace(old,new)
# avoid old repair flag while publisher begins: reservation already applies in preview; other repair callers only preview.
# Cancel approval if user navigated from the actual inventory panel while waiting.
old="    if(!confirm('R342:"
new="    if(!el('r153-panel')||el('r153-panel').style.display==='none'){tell('أُغلقت نافذة الجرد؛ لم يُعتمد شيء.');return;}\n    if(!confirm('R342:"
assert part.count(old)==1;part=part.replace(old,new)
h=h[:a]+part+h[b:]
out=h.encode('utf8');assert hashlib.sha256(out).hexdigest()=='70c111b23ff28c8dc8fc4873e453b92ffcbbc34e3c307cf697356d8701ea0b79';p.write_bytes(out);print('R348 exact candidate verified')
