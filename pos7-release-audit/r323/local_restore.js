/* R323 Store2 local-only restore approval. This does NOT transfer publisher,
 * modify R174, call Supabase or clear POS7_RESTORE_PENDING_R305.
 * Cloud synchronization remains explicitly blocked by the R305 marker.
 */
(function(){
'use strict';
const RESTORE='POS7_RESTORE_PENDING_R305';
const LOCAL='POS7_RESTORE_LOCAL_ONLY_R323';
const REQUEST='POS7_TRANSFER_REQUEST_R305';
function isPending(){try{return !!localStorage.getItem(RESTORE)}catch(_){return false}}
function isApproved(){try{return localStorage.getItem(LOCAL)==='yes'}catch(_){return false}}
function info(){
 return {pending:isPending(),localOnly:isApproved(),
  cloudPublishingBlocked:isPending(),transferRequestPreserved:!!localStorage.getItem(REQUEST)};
}
function approveLocal(){
 if(!isPending()){
  alert('لا توجد نسخة احتياطية بانتظار الاعتماد المحلي. لم نغيّر أي شيء.');
  return false;
 }
 if(isApproved()){
  alert('هذه النسخة معتمدة محليًا بالفعل. المزامنة السحابية ما زالت موقوفة.');
  return true;
 }
 if(!confirm('سيتم اعتماد النسخة المستعادة على هذا التاب محليًا فقط.\n'
    +'لن نرفعها إلى Supabase، ولن نغيّر جهاز النشر أو الجرد، ولن نمسح بيانات السحابة.\n'
    +'ستبقى المزامنة السحابية متوقفة إلى أن تختار لاحقًا آلية مستقلة. هل تعتمد محليًا؟'))return false;
 try{
  // Durably mark user acknowledgement only. Do not mutate financial state,
  // restore guard, existing transfer token, owner identity or stock revisions.
  localStorage.setItem(LOCAL,'yes');
  if(localStorage.getItem(LOCAL)!=='yes')
   throw Error('تعذر التحقق من الاعتماد المحلي');
  if(!isPending())throw Error('علامة تعليق المزامنة غير موجودة، توقف لحماية البيانات');
  const label=document.getElementById('pos7LocalRestoreR323Status');
  if(label)label.textContent='✓ النسخة معتمدة على التاب الثاني محليًا فقط. السحابة والنشر والجرد دون تغيير؛ المزامنة متوقفة.';
  alert('تم اعتماد النسخة على التاب الثاني محليًا فقط.\nالمزامنة السحابية متوقفة؛ لم تُنقل صلاحيات النشر أو الجرد.');
  return true;
 }catch(e){
  alert('تعذر تسجيل الاعتماد المحلي؛ لم تُنقل أي صلاحية: '+String(e?.message||e));
  return false;
 }
}
function mount(){
 if(document.getElementById('pos7LocalRestoreR323'))return;
 const anchor=document.getElementById('pos7TransferR305')||document.getElementById('p57Now');
 if(!anchor)return;
 const holder=document.createElement('div');
 holder.id='pos7LocalRestoreR323';
 holder.style.cssText='display:flex;flex-direction:column;gap:8px;margin:10px 0;padding:10px;border:2px solid #0f766e;border-radius:10px;background:#f0fdfa;color:#134e4a;direction:rtl';
 const button=document.createElement('button');
 button.type='button';
 button.id='pos7LocalRestoreR323Button';
 button.textContent='✅ اعتماد النسخة محليًا فقط (دون نقل النشر أو الجرد)';
 button.style.cssText='padding:12px;font:bold 15px Arial;background:#0f766e;color:white;border:0;border-radius:9px;white-space:normal';
 button.onclick=approveLocal;
 const status=document.createElement('div');
 status.id='pos7LocalRestoreR323Status';
 status.style.cssText='font:13px Arial;line-height:1.6';
 status.textContent=isApproved()
   ?'✓ تم الاعتماد محليًا. النشر والجرد والسحابة دون تعديل؛ المزامنة متوقفة.'
   :isPending()
     ?'نسخة مستعادة بانتظار الاعتماد المحلي. لا تحتاج إلى اتصال Supabase.'
     :'لا توجد نسخة مستعادة معلقة للاعتماد المحلي.';
 holder.appendChild(button);holder.appendChild(status);
 anchor.after(holder);
}
window.POS7_R323_LOCAL_RESTORE={approve:approveLocal,status:info};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
else mount();
if(window.MutationObserver){
 const observer=new MutationObserver(mount);
 observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
