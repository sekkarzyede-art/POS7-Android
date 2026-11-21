#!/usr/bin/env python3
"""R296: create an intentionally disabled two-branch Android compilation candidate.
Never place this candidate on production devices: no restore or cutover service is connected.
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import re

ROOT=Path("r296-android").resolve()
SOURCES={
 "tab1":"POS7_Tablet_v485.7.229_R213_Project.zip",
 "tab2":"POS7_المتجر_الثاني_TAB_R215_Android_Source.zip",
}
def extract(file,dest):
 with ZipFile(file) as z:
  for i in z.infolist():
   target=(dest/i.filename).resolve()
   if not target.is_relative_to(dest): raise RuntimeError("ZIP unsafe path")
  z.extractall(dest)
for b,f in SOURCES.items():
 extract(f, ROOT/b)
A=ROOT/"tab1"/"POS7_Tablet"
B=ROOT/"tab2"/"POS7_Tablet"
assets=A/"app/src/main/assets"
a=(assets/"index.html").read_bytes()
b=(B/"app/src/main/assets/index.html").read_bytes()
(assets/"pos7_tab1_R213.html").write_bytes(a)
(assets/"pos7_tab2_R215.html").write_bytes(b)
# Absolutely no content from the legacy R213/R215 JavaScript runs as a starting page.
(assets/"index.html").write_text("""<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سكر زيادة — التاب الموحد (اختبار غير قابل للتشغيل)</title>
<style>body{font:18px system-ui,Tahoma;padding:6vw;background:#f4f7fb;color:#17304b}
article{max-width:650px;margin:auto;background:white;padding:28px;border-radius:20px}
button{padding:18px;margin:8px;border:0;border-radius:12px;background:#1555aa;color:white;font-size:18px}</style>
<article><h1>سكر زيادة</h1><p>R296 — فحص دمج المصدرين فقط. البيع والمزامنة والنشر والاستعادة محظورة في هذه النسخة.</p>
<button onclick="choose('tab1')">المتجر الأول</button><button onclick="choose('tab2')">المتجر الثاني</button>
<p id="status">لم يبدأ الاتصال بالسحابة</p></article>
<script>function choose(b){
 const expected={tab1:'jdcolkgzwqpwbfvcrdje',tab2:'rmskuolsiqbzxuakofpb'}[b];
 let safe=false;try{safe=window.Pos7NativeBranch&&Pos7NativeBranch.canReadPreflight(b,expected)===true&&Pos7NativeBranch.canPublish()===false}catch(e){}
 document.getElementById('status').textContent=safe?'تم تحديد الفرع للفحص فقط — التشغيل محظور':'حارس Android غير متاح — التشغيل محظور';
}</script></html>""",encoding="utf-8")
pkg=A/"app/src/main/java/com/sokkarzeyedeh/pos7"
(pkg/"NativeBranchPolicy.java").write_text("""package com.sokkarzeyedeh.pos7;
public final class NativeBranchPolicy {
 private NativeBranchPolicy(){}
 public static boolean mayReadForPreflight(String nativeBranch, String b, String p){
  String expect = "tab1".equals(b)?"jdcolkgzwqpwbfvcrdje":"tab2".equals(b)?"rmskuolsiqbzxuakofpb":null;
  return expect!=null&&expect.equals(p)&&(nativeBranch==null||nativeBranch.isEmpty()||nativeBranch.equals(b));
 }
}""")
(pkg/"NativeBranchBridge.java").write_text("""package com.sokkarzeyedeh.pos7;
import android.content.Context;
import android.webkit.JavascriptInterface;
public final class NativeBranchBridge {
 private final Context context;
 public NativeBranchBridge(Context c){context=c.getApplicationContext();}
 @JavascriptInterface public boolean canReadPreflight(String b,String project){
  // No trusted migration of existing native identity has been completed.
  // Read-only comparison only; no publication is ever authorized.
  String stored=context.getSharedPreferences("pos7_native_identity_v1",0).getString("verified_branch","");
  return NativeBranchPolicy.mayReadForPreflight(stored,b,project);
 }
 @JavascriptInterface public boolean canPublish(){return false;}
}""")
main=pkg/"MainActivity.java"
j=main.read_text()
needle='webView.addJavascriptInterface(new AndroidPrintBridge(this), "Pos7Android");'
assert j.count(needle)==1
j=j.replace(needle,needle+'\n        webView.addJavascriptInterface(new NativeBranchBridge(this), "Pos7NativeBranch");')
main.write_text(j)
gradle=A/"app/build.gradle"
g=gradle.read_text()
assert "applicationId 'com.sokkarzeyedeh.pos7'" in g
g=re.sub(r"versionName\s+['\"][^'\"]+['\"]","versionName '485.7.229-r296-COMPILE-ONLY-NO-INSTALL'",g,count=1)
gradle.write_text(g)
print("R296 build candidate ready. R213 sha:",hashlib.sha256(a).hexdigest(),
 "R215 sha:",hashlib.sha256(b).hexdigest())
print("R296 hard blocked: business disabled and no Supabase publish, restore or cutover.")
