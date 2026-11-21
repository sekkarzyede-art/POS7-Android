#!/usr/bin/env python3
"""R301: Standalone offline-only backup-recovery test APK; cannot replace installed POS7."""
from pathlib import Path
import subprocess,re
subprocess.run(['python3','pos7-release-audit/r299/build_offline_restore_candidate.py'],check=True)
app=Path('r296-android/tab1/POS7_Tablet')
gradle=app/'app/build.gradle';g=gradle.read_text()
old="applicationId 'com.sokkarzeyedeh.pos7'"
assert g.count(old)==1
g=g.replace(old,"applicationId 'com.sokkarzeyedeh.pos7.recoverytest'")
gradle.write_text(g)
manifest=app/'app/src/main/AndroidManifest.xml'
m=manifest.read_text()
internet='<uses-permission android:name="android.permission.INTERNET" />'
assert m.count(internet)==1
m=m.replace(internet,'')
assert 'android:label="متجر سكر زيادة"' in m
m=m.replace('android:label="متجر سكر زيادة"','android:label="POS7 فحص النسخة - دون إنترنت"')
manifest.write_text(m)
java=app/'app/src/main/java/com/sokkarzeyedeh/pos7/MainActivity.java'
assert 'settings.setBlockNetworkLoads(true);' in java.read_text()
assert 'android.permission.INTERNET' not in m
assert "applicationId 'com.sokkarzeyedeh.pos7.recoverytest'" in g

# R301 safety: persistent warning and read-only business screens.
# Prevent accidental local invoices/stock changes in a diagnostic application.
warning = """<style id="pos7-diagnostic-only">
#pos7-diagnostic-banner{position:fixed!important;top:0!important;right:0!important;
left:0!important;z-index:2147483647!important;background:#b42318!important;
color:white!important;font:700 18px Tahoma,sans-serif!important;text-align:center!important;
padding:12px 4px!important;pointer-events:none!important}
</style><div id="pos7-diagnostic-banner" dir="rtl">نسخة فحص تجريبية — دون إنترنت — يُمنع استخدامها للبيع أو الشراء</div>
<script>
document.addEventListener('click',function(e){
 const el=e.target&&e.target.closest&&e.target.closest('button,input,select,textarea,a,[onclick],[role=button]');
 if(el){e.preventDefault();e.stopImmediatePropagation();}
},true);
document.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation();},true);
</script>"""
for branch in ('tab1_R213','tab2_R215'):
 target=app/'app/src/main/assets'/('pos7_'+branch+'.html')
 html=target.read_text()
 # Many inline receipt templates contain literal </body>; append after original document instead.
 target.write_text(html+'\n'+warning)

print('R301 stand-alone TEST package verified. Cannot update or replace production POS7 APK.')
