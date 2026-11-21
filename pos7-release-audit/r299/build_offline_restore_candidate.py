#!/usr/bin/env python3
"""R299: offline-only functional local restore, neither cloud nor publisher transfer."""
from pathlib import Path
import subprocess,shutil
subprocess.run(['python3','pos7-release-audit/r298/build_backup_preflight_candidate.py'],check=True)
app=Path('r296-android/tab1/POS7_Tablet')
assets=app/'app/src/main/assets'
shutil.copyfile('pos7-release-audit/r299/offline_restore.js',assets/'offline_restore.js')
java=app/'app/src/main/java/com/sokkarzeyedeh/pos7/MainActivity.java'
source=java.read_text()
needle='settings.setDomStorageEnabled(true);'
assert source.count(needle)==1
source=source.replace(needle,needle+'\n        // R299: unconditional offline-only quarantine; no WebView Supabase access.\n        settings.setBlockNetworkLoads(true);')
java.write_text(source)
startup='''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>سكر زيادة — استعادة محلية فقط</title>
<style>body{font:17px system-ui,Tahoma;background:#f4f7fb;color:#193c5a;padding:5vw}
main{max-width:710px;margin:auto;background:#fff;padding:25px;border-radius:16px}
input,select,button{font:inherit;padding:13px;margin:6px 0}button{background:#165ca2;color:#fff;border:0;border-radius:11px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:15px;background:#edf3f9}.warn{color:#a5321c}</style>
<main><h1>سكر زيادة — استعادة نسخة احتياطية</h1>
<p class="warn">وضع محلي فقط: اتصال الإنترنت والنشر السحابي مغلقان على مستوى Android. لا تستخدم هذا المصدر التجريبي بدل التطبيق المثبت.</p>
<label for="branch">المتجر</label>
<select id="branch"><option value="">اختر</option><option value="tab1">المتجر الأول</option><option value="tab2">المتجر الثاني</option></select>
<p><label for="file">ملف نسخة POS7 JSON</label><input type="file" id="file" accept=".json,application/json"></p>
<button id="inspect">فحص الملف</button>
<button id="restore" disabled>استعادة البيانات محليًا فقط</button>
<button id="open" disabled>فتح البرنامج دون اتصال</button>
<pre id="status" role="status">لم يتم اختيار ملف</pre></main>
<script src="backup_preflight.js"></script>
<script src="offline_restore.js"></script>
<script>
(()=>{'use strict';
const $=id=>document.getElementById(id);
let content='',branch='',verified=false,restored='';
const show=t=>$('status').textContent=t;
$('inspect').onclick=()=>{
 const f=$('file').files[0];branch=$('branch').value;
 verified=false;$('restore').disabled=true;
 if(!f||!branch){show('اختر المتجر وملف النسخة');return;}
 if(f.size>Pos7BackupPreflight.MAX_BYTES){show('حجم الملف كبير جدًا');return;}
 const reader=new FileReader();
 reader.onerror=()=>show('تعذر قراءة الملف');
 reader.onload=()=>{
  content=String(reader.result||'');
  const r=Pos7BackupPreflight.inspect(content,branch);
  const nativeOk=typeof window.Pos7NativeBranch==='object' && window.Pos7NativeBranch.canPublish()===false;
  verified=r.ok&&nativeOk;
  $('restore').disabled=!verified;
  show('الملف: '+(r.ok?'بنية صحيحة':'مرفوض')+'\\nأخطاء: '+r.errors.join(', ')+'\\nتحذيرات: '+r.warnings.join(', ')+
       '\\nعدد الأصناف: '+(r.counts?.products??'?')+'\\nعدد فواتير البيع: '+(r.counts?.sales??'?')+
       '\\nوضع النشر: محظور');
 };
 reader.readAsText(f);
};
$('restore').onclick=()=>{
 if(!verified||branch!==$('branch').value)return show('أعد فحص الملف');
 if(!confirm('تأكيد الاستعادة المحلية فقط؟ لن يسمح البرنامج بالنشر أو المزامنة، ولا يستبدل بيانات قديمة غير فارغة.'))return;
 try{
  const result=Pos7OfflineRestore.recover(content,branch,localStorage,{nativeOfflineGate:true});
  restored=result.branch;
  $('open').disabled=false;
  $('restore').disabled=true;
  show('تمت استعادة البيانات في ذاكرة هذا التاب محليًا. النشر والمزامنة محظوران. افتح البرنامج للعمل المحلي فقط.');
 }catch(e){show('فشلت الاستعادة دون ترخيص النشر: '+(e.message||e));}
};
$('open').onclick=()=>{
 if(restored!=='tab1'&&restored!=='tab2')return;
 if(!confirm('سيفتح برنامج المتجر بوضع محلي فقط، دون اتصال أو مزامنة.'))return;
 window.location.href=restored==='tab1'?'pos7_tab1_R213.html':'pos7_tab2_R215.html';
};
})();
</script></html>'''
assets.joinpath('index.html').write_text(startup,encoding='utf-8')
print('Offline WebView network loads disabled before local restoration or opening legacy business view.')
