from pathlib import Path
import hashlib,sys
p=Path(sys.argv[1]);s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='22e8050cf9db681f466757bc0ce3a98f929f3094eedca1327c70658bddafb19b'
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:120],s.count(a));s=s.replace(a,b,1)
rep("const download=(name,v)=>{if(typeof window.P7Download==='function')window.P7Download(name,v);else{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(v)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}};",'''let exporting=false;
 const download=(name,v)=>{
  if(exporting)return;
  const json=JSON.stringify(v,null,2);
  if(window.Pos7Android&&typeof window.Pos7Android.saveBackupJson==='function'){
   const previous=window.pos7OnBackupSaveResult;
   const callback=function(ok,message){
    if(window.pos7OnBackupSaveResult===callback)window.pos7OnBackupSaveResult=previous;
    exporting=false;status.textContent=ok?'تم حفظ ملف الفحص أو النسخة المرشحة: '+name:(message||'لم يتم حفظ الملف.');
   };
   exporting=true;window.pos7OnBackupSaveResult=callback;
   try{status.textContent='اختر مكان حفظ الملف…';window.Pos7Android.saveBackupJson(name,json);}
   catch(e){callback(false,'تعذر حفظ الملف: '+e.message);}
   return;
  }
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  status.textContent='تم طلب تنزيل الملف؛ تحقق من مجلد التنزيلات.';
 };''')
rep("btn('تحميل تقرير الفحص',()=>download('POS7_R354_backup_audit.json',report()));",'''btn('تحميل تقرير الفحص',()=>download('POS7_R383_backup_audit.json',report()));
 const reportText=add('textarea','');reportText.hidden=true;reportText.readOnly=true;reportText.dir='ltr';reportText.style.cssText='width:100%;min-height:180px;box-sizing:border-box';
 btn('نسخ تقرير الفحص',async()=>{
  const json=JSON.stringify({version:'R383',...report()},null,2);
  let ok=false;try{await navigator.clipboard.writeText(json);ok=true}catch(e){}
  if(!ok){reportText.hidden=false;reportText.value=json;reportText.focus();reportText.select();try{ok=document.execCommand('copy')}catch(e){}}
  if(ok){reportText.hidden=true;status.textContent='تم نسخ تقرير الفحص.';}
  else status.textContent='حدد النص الظاهر وانسخه يدوياً.';
 });
 btn('مشاركة تقرير الفحص',()=>{
  if(typeof window.Pos7Android?.shareBackupJson!=='function'){status.textContent='المشاركة الأصلية غير متاحة؛ استخدم نسخ التقرير.';return}
  try{window.Pos7Android.shareBackupJson('POS7_R383_backup_audit.json',JSON.stringify(report(),null,2));status.textContent='تم طلب مشاركة الملف؛ اختر التطبيق المناسب.';}catch(e){status.textContent='تعذرت المشاركة: '+e.message;}
 });''')
rep("btn('إغلاق',()=>dialog.remove());document.body.append(dialog);return true;","btn('إغلاق',()=>{if(exporting){status.textContent='أكمل نافذة حفظ الملف أو ألغها أولاً.';return}dialog.remove()});document.body.append(dialog);return true;")
rep("if(!externalSelected&&!list.length)ok=pos340StoreBackups([b]);","if(!externalSelected)ok=pos340StoreBackups([b,...list]);")
rep("if(!externalSelected&&list.length)toast('النسخة المحلية القديمة محفوظة؛ حدّد مجلد النسخ الخارجية لحفظ نسخ حديثة');","if(!externalSelected&&!ok){setBackupMeta({lastExternalError:'لم تُحفظ نسخة محلية جديدة؛ النسخ السابقة محفوظة. اختر مجلداً خارجياً.'});toast('لم تُحفظ نسخة محلية جديدة؛ النسخ السابقة محفوظة.');}")
rep("toast('تمت النسخة الاحتياطية التلقائية '+slot);","toast('تمت محاولة النسخ التلقائي '+slot+'؛ راجع حالة الحفظ');")
rep("const VERSION='R382', MAX=250;","const VERSION='R383', MAX=250;")
rep("make('h3','تشخيص الأداء المتقدم — R382');","make('h3','تشخيص الأداء المتقدم — R383');")
rep('485.7.229-r382-tab2','485.7.229-r383-tab2')
assert 'pos7R354ExternalIdentityReviewRequired===true||t.duplicateIdGroupsBefore' in s
assert 'jdcolkgzwqpwbfvcrdje' not in s
p.write_text(s)
print(hashlib.sha256(s.encode()).hexdigest())
