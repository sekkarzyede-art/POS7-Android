/* R324 Store2: same-device authoritative cloud reconciliation.
 * Manual user action only. No publication/permission transfer.
 * Requires local approval, owner session, exact current publisher/device identity,
 * server-side archived previous snapshot+catalog, revision CAS, and RPC verify
 * before removal of the existing R305 synchronization guard.
 */
(function(){
'use strict';
const RESTORE='POS7_RESTORE_PENDING_R305';
const LOCAL='POS7_RESTORE_LOCAL_ONLY_R323';
const REQUEST='POS7_SAME_DEVICE_REQUEST_R324';
const LEGACY='POS7_TRANSFER_REQUEST_R305';
let running=false;
function byId(id){return document.getElementById(id)}
function notify(msg){const e=byId('pos7R324Status');if(e)e.textContent=msg;}
function pending(){return localStorage.getItem(RESTORE)==='yes';}
function device(){return localStorage.getItem('POS7_CLOUD_DEVICE_V1')||'';}
function parse(x){try{return JSON.parse(x||'null')}catch(_){return null}}
async function align(){
 if(running)return;
 if(!pending())return alert('علامة الاستعادة غير موجودة. لا يوجد نقل سحابي مطلوب.');
 if(localStorage.getItem(LOCAL)!=='yes')
  return alert('اعتمد النسخة محليًا أولًا باستخدام زر R323.');
 const cloud=window.P7Cloud;
 if(!cloud||!cloud.session)return alert('يلزم تسجيل الدخول بمالك Supabase 2 وإتاحة الإنترنت أولًا.');
 if(!device())return alert('لم تُعرف هوية التاب 2؛ لم نغيّر شيئًا.');
 if(window.P7TabletTest&&(window.P7TabletTest.cashierBusy()||window.P7TabletTest.isBusy()))
  return alert('أكمل العملية الحالية قبل مطابقة السحابة.');
 running=true;
 try{
  notify('قراءة هوية جهاز النشر الحالي من سحابة المتجر الثاني...');
  const rows=await cloud.req('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=revision,publisher_device');
  if(!Array.isArray(rows)||rows.length!==1)throw Error('تعذر قراءة حالة المتجر الثاني');
  const row=rows[0];
  if(row.publisher_device!==device())
   throw Error('الجهاز الحالي لا يطابق هوية الناشر في Supabase 2؛ لن ننقل صلاحيات النشر تلقائيًا.');
  if(!Number.isSafeInteger(Number(row.revision)))
   throw Error('مراجعة السحابة غير صالحة');
  const existing=parse(localStorage.getItem(REQUEST));
  let req=existing;
  if(!req||req.p_device!==device()||!req.p_request_id||!Number.isSafeInteger(Number(req.p_expected))){
   req={p_request_id:crypto.randomUUID(),p_device:device(),p_expected:Number(row.revision)};
   localStorage.setItem(REQUEST,JSON.stringify(req));
  }
  if(req.p_expected!==Number(row.revision)){
   // Only a past successful request may be retried with old revision.
   notify('مراجعة السحابة تغيرت؛ نفحص نتيجة الطلب السابق قبل اتخاذ أي خطوة.');
   const prior=await cloud.rpc('pos7_restore_same_device_status_r324',{p_request_id:req.p_request_id});
   if(!prior?.ok)throw Error('تغيرت مراجعة السحابة ولم يتم تأكيد الطلب السابق. أوقفنا العملية لحماية البيانات.');
   if(!prior.same_device)throw Error('تغيرت صلاحيات الجهاز؛ أوقفنا العملية');
   return finish(req,prior);
  }
  const snapshot=await window.pos7BuildOwnerSnapshot(()=>
   !window.P7TabletTest||!window.P7TabletTest.cashierBusy());
  if(!snapshot||!snapshot.sections||!snapshot.sections.products)
   throw Error('تعذر تجهيز صورة بيانات التاب المستعادة');
  const count=Object.keys(snapshot.sections.products).length;
  if(count<1||count>10000)throw Error('عدد أصناف النسخة غير صالح');
  if(!confirm('هل تريد جعل بيانات سحابة المتجر الثاني مطابقة للتـاب 2؟\n'
   +'سيتم أرشفة حالة السحابة القديمة كاملةً، ثم اعتماد بيانات التاب المستعادة ('
   +count+' صنفًا) في السحابة وكتالوج الأصناف.\n'
   +'لن تُغيّر صلاحية النشر أو جهاز الجرد، ولن تُمس سحابة التاب 1.\n'
   +'إذا اختلف جهاز النشر أو وُجدت أوامر هاتف معلقة فستُرفض العملية تلقائيًا.'))return;
  notify('أرشفة النسخة السحابية القديمة واعتماد بيانات التاب الثاني...');
  const response=await cloud.rpc('pos7_restore_same_device_r324',{
   p_request_id:req.p_request_id,p_device:req.p_device,
   p_expected:req.p_expected,p_sections:snapshot.sections
  });
  if(!response?.ok)throw Error('الخادم لم يؤكد حفظ نسخة التاب');
  if(response.publisher_device!==device()||response.approved_device!==device())
   throw Error('الرد لا يطابق هوية جهاز النشر والجرد');
  notify('نراجع تطابق البيانات على Supabase 2 قبل إعادة المزامنة...');
  const verified=await cloud.rpc('pos7_restore_same_device_status_r324',{
    p_request_id:req.p_request_id
  });
  if(!verified?.ok||!verified.same_device||verified.revision!==response.revision
     ||verified.fingerprint!==verified.expected_fingerprint)
   throw Error('لم يكتمل إثبات التطابق؛ أبقينا المزامنة متوقفة');
  return finish(req,verified);
 }catch(err){
  const message=String(err?.message||err);
  notify('المزامنة ما زالت موقوفة بأمان: '+message);
  alert('تعذرت المطابقة الآمنة مع Supabase 2. لم ننقل أي صلاحية.\n'+message);
 }finally{running=false;}
}
function finish(request,verified){
 if(!verified?.ok||!verified.same_device||
    verified.fingerprint!==verified.expected_fingerprint)
  throw Error('التحقق من تطابق النسخة غير مكتمل');
 // Unblock ONLY after server has verified full snapshot+catalog and same device.
 localStorage.removeItem(RESTORE);
 if(localStorage.getItem(RESTORE))throw Error('تعذّر إلغاء تعليق المزامنة بعد نجاح المطابقة');
 localStorage.removeItem(LEGACY);
 localStorage.removeItem(REQUEST);
 notify('✓ نجحت المطابقة. بيانات Supabase 2 متوافقة مع هذا التاب، دون نقل صلاحيات.');
 alert('نجحت مطابقة سحابة المتجر الثاني مع بيانات التاب 2.\n'
 +'جهاز النشر والجرد لم يتغير. ستُستأنف المزامنة بعد إعادة تحميل الصفحة.');
 location.reload();
 return true;
}
function mount(){
 const old=byId('pos7TransferR305');
 if(old)old.style.display='none'; // Prevent accidental role-transfer workflow.
 if(byId('pos7R324Panel'))return;
 const anchor=byId('pos7LocalRestoreR323')||byId('p57Now');
 if(!anchor)return;
 const d=document.createElement('div');d.id='pos7R324Panel';d.dir='rtl';
 d.style.cssText='display:flex;flex-direction:column;gap:8px;margin:10px 0;padding:10px;border:2px solid #1e40af;border-radius:10px;background:#eff6ff;color:#1e3a8a;';
 const b=document.createElement('button');b.type='button';
 b.id='pos7R324Apply';
 b.textContent='☁️ مطابقة Supabase 2 مع التاب 2 (نفس الجهاز — دون نقل النشر)';
 b.style.cssText='padding:12px;background:#1d4ed8;color:white;border:0;border-radius:8px;font:bold 14px Arial;white-space:normal';
 b.onclick=align;
 const n=document.createElement('div');n.id='pos7R324Status';n.style.cssText='font:13px Arial;padding:8px';
 n.textContent=pending()?'ينبغي اعتماد النسخة محليًا أولًا؛ ثم الاتصال بحساب مالك Supabase 2.':'لا توجد نسخة معلقة للمطابقة.';
 d.appendChild(b);d.appendChild(n);anchor.after(d);
}
window.POS7_R324_SAME_DEVICE={align:align,status:()=>({
 pending:pending(),localApproved:localStorage.getItem(LOCAL)==='yes',
 currentDevice:device(),requestId:parse(localStorage.getItem(REQUEST))?.p_request_id||null
})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
else mount();
if(window.MutationObserver){
 const obs=new MutationObserver(mount);
 obs.observe(document.documentElement,{childList:true,subtree:true});
}
})();