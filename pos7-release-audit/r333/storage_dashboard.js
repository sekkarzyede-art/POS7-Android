/* R333: read-only Android storage capacity and POS7 native JSON file size.
 * Never mutates data. Existing R331 maintenance controls remain available.
 */
(function(){
'use strict';
const ID='pos7R333StorageStats';
const bytes=n=> {
 if(typeof n!=='number'||!Number.isFinite(n)||n<0)return 'غير متاح';
 if(n===0)return '0 B';
 const units=['B','KB','MB','GB','TB'];
 const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),units.length-1);
 return (n/Math.pow(1024,i)).toFixed(i===0?0:2)+' '+units[i];
};
function cell(label,value,detail){
 const d=document.createElement('div');
 d.style.cssText='min-width:145px;flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:11px;background:#f8fafc';
 const l=document.createElement('div');l.textContent=label;
 l.style.cssText='font:13px Arial;color:#475569';
 const v=document.createElement('div');v.textContent=value;
 v.style.cssText='font:bold 21px Arial;color:#0f172a;margin:7px 0';
 d.appendChild(l);d.appendChild(v);
 if(detail){const s=document.createElement('div');s.textContent=detail;s.style.cssText='font:11px Arial;color:#64748b';d.appendChild(s)}
 return d;
}
function mount(){
 const settings=document.getElementById('saleSettingsPage');
 const parent=document.getElementById('pos7R331StorageSettings');
 if(!settings||!parent)return false;
 if(document.getElementById(ID))return true;
 const panel=document.createElement('div');
 panel.id=ID;panel.dir='rtl';
 panel.style.cssText='margin:14px 0 0;padding:12px;border:1px solid #94a3b8;border-radius:12px;background:white;';
 const title=document.createElement('h4');title.textContent='📊 حالة مساحة التخزين';
 title.style.cssText='margin:0 0 8px;font:bold 17px Arial;color:#0f172a';
 const desc=document.createElement('p');
 desc.textContent='المساحة الداخلية المتاحة للتطبيق، والحجم الفعلي لملف قاعدة بيانات POS7. هذه قراءة فقط.';
 desc.style.cssText='font:12px Arial;color:#475569;line-height:1.7;margin:4px 0 12px';
 const values=document.createElement('div');values.id=ID+'Values';
 values.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
 const refresh=document.createElement('button');refresh.type='button';
 refresh.id='pos7R333Refresh';refresh.textContent='↻ تحديث حالة التخزين';
 refresh.style.cssText='padding:10px 14px;margin-top:12px;border:1px solid #2563eb;border-radius:8px;background:#eff6ff;color:#1e40af;font:bold 14px Arial';
 const note=document.createElement('div');note.id=ID+'Note';
 note.style.cssText='font:12px Arial;color:#64748b;margin-top:10px;line-height:1.7';
 refresh.onclick=update;
 panel.appendChild(title);panel.appendChild(desc);
 panel.appendChild(values);panel.appendChild(refresh);panel.appendChild(note);
 // Keep it in the R331 maintenance section, never in the sale invoice overlay.
 parent.insertBefore(panel,document.getElementById('pos7R331StorageActions')||null);
 update();
 return true;
}
function update(){
 const target=document.getElementById(ID+'Values'),note=document.getElementById(ID+'Note');
 if(!target||!note)return;
 target.replaceChildren();
 const bridge=window.Pos7Android;
 if(!bridge||typeof bridge.pos333StorageStats!=='function'){
  target.appendChild(cell('مساحة أندرويد','غير متاح'));
  note.textContent='هذا المؤشر يتطلب APK R333 على التاب. متصفح HTML التجريبي لا يعرض مساحة جهازك.';
  return;
 }
 try{
  const st=JSON.parse(bridge.pos333StorageStats());
  if(st.error||!Number.isFinite(st.totalBytes)||!Number.isFinite(st.freeBytes)||
     st.totalBytes<=0||st.freeBytes<0||st.freeBytes>st.totalBytes)
   throw Error(st.error||'قراءة المساحة غير صالحة');
  target.appendChild(cell('المساحة الإجمالية',bytes(st.totalBytes),'قسم بيانات أندرويد الداخلي'));
  target.appendChild(cell('المساحة الفارغة',bytes(st.freeBytes),'المتاح حاليًا لتطبيقات الجهاز'));
  target.appendChild(cell('قاعدة بيانات POS7',bytes(st.pos7DatabaseBytes),'ملف الحالة الرئيسي المحفوظ فعليًا'));
  const cap=st.pos7DatabaseLimitBytes;
  const capDescription=cap>0?'الحد الحالي لملف قاعدة POS7 المفرد: '+bytes(cap)+'. ':'';
  const lowSpace=st.freeBytes<200*1024*1024;
  note.textContent=capDescription+
    'هذه المساحة مشتركة بين التطبيقات، وليست محجوزة للبرنامج. '+
    (lowSpace?'تنبيه: المساحة الحرة أقل من 200 MB؛ احتفظ بنسخة احتياطية خارجية.':'')+
    ' آخر تحديث: '+new Date().toLocaleTimeString('ar-LB');
 }catch(e){
  target.appendChild(cell('إحصاءات التخزين','تعذرت القراءة'));
  note.textContent='لم تتغير أي بيانات. السبب: '+String(e&&e.message||e);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
else mount();
if(window.MutationObserver){
 const observer=new MutationObserver(function(){if(!document.getElementById(ID))mount()});
 observer.observe(document.documentElement,{childList:true,subtree:true});
}
window.POS7_R333_STORAGE_DASHBOARD={refresh:update,mount:mount};
})();