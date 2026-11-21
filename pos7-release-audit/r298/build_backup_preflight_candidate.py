#!/usr/bin/env python3
"""R298: Rebuild merged Android staging source from R213/R215 with read-only backup file checker.
No data restoration. No cloud writes. No APK for installation.
"""
from pathlib import Path
import subprocess,shutil
root=Path('r296-android/tab1/POS7_Tablet')
subprocess.run(['python3','pos7-release-audit/r296/make_unified_compile_candidate.py'],check=True)
assets=root/'app/src/main/assets'
shutil.copyfile('pos7-release-audit/r298/backup_preflight.js',assets/'backup_preflight.js')
assets.joinpath('index.html').write_text('''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سكر زيادة — فحص نسخة التاب</title>
<style>body{font:18px system-ui,Tahoma,sans-serif;background:#f4f7fb;color:#17304b;padding:5vw}
main{max-width:690px;margin:auto;background:white;padding:26px;border-radius:20px}
button,input{font:inherit;margin:8px 0;padding:14px}button{background:#1555aa;color:white;border:0;border-radius:12px}
button:disabled{background:#8797ac}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f6fb;padding:14px}
.note{color:#b44325}</style>
<main><h1>سكر زيادة</h1>
<p>R298 — فحص نسخة احتياطية من دون استعادة أو نشر. هذا البرنامج ليس إصدارًا للتثبيت.</p>
<p class="note">لا تستخدم هذه المرحلة بدل التطبيق المثبت حاليًا. استعادة البيانات والبيع والنشر محظورة.</p>
<label for="branch">اختر سحابة المتجر</label>
<select id="branch"><option value="">اختر</option><option value="tab1">المتجر الأول</option><option value="tab2">المتجر الثاني</option></select>
<p><label for="backup">ملف النسخة الاحتياطية POS7 (JSON)</label></p>
<input id="backup" type="file" accept=".json,application/json">
<button id="inspect" type="button">فحص الملف فقط</button>
<pre id="result" role="status">لم يتم اختيار ملف.</pre></main>
<script src="backup_preflight.js"></script>
<script>
(function(){
 const $=id=>document.getElementById(id);
 function show(lines){$('result').textContent=lines.join('\\n');}
 $('inspect').addEventListener('click',function(){
  const branch=$('branch').value,file=$('backup').files[0];
  if(!branch||!file){show(['اختر المتجر وملف النسخة الاحتياطية.']);return;}
  if(file.size>Pos7BackupPreflight.MAX_BYTES){show(['الملف أكبر من الحجم المسموح.']);return;}
  const reader=new FileReader();
  reader.onerror=()=>show(['تعذر قراءة الملف.']);
  reader.onload=function(){
   const r=Pos7BackupPreflight.inspect(String(reader.result||''),branch);
   const lines=[r.ok?'فحص بنية الملف ناجح.':'فحص بنية الملف فشل.',
    'تاريخ النسخة: '+(r.createdAt||'غير معروف'),
    'المتجر المختار: '+branch,
    'الأخطاء: '+(r.errors.length?r.errors.join(', '):'لا يوجد'),
    'ملاحظات: '+r.warnings.join(', '),
    'عدد الأصناف: '+(r.counts?.products??'?'),
    'عدد فواتير البيع: '+(r.counts?.sales??'?'),
    'عدد فواتير الشراء: '+(r.counts?.purchases??'?'),
    'الاستعادة: محظورة — يلزم فحص السحابة',
    'النشر: محظور — يلزم إثبات اعتماد الجهاز'];
   show(lines);
  };
  reader.readAsText(file);
 });
})();
</script></html>''',encoding='utf-8')
print('R298 read-only HTML backup check integrated; no localStorage writes, no RPC, no publishing.')
