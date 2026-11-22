"""POS7 Tablet1 R321 quota recovery.
Builds ONLY tab1 from its latest known R213 source ZIP. Does not touch
the store 2, Supabase/R174, product IDs, invoices, accounting or inventory.
No local backup is removed unless Android reports SUCCESS saving that exact
backup as a separate external JSON file.
"""
from pathlib import Path
from zipfile import ZipFile
import re
src=Path("POS7_Tablet_v485.7.229_R213_Project.zip")
dst=Path("r321-android/tab1")
with ZipFile(src) as z:
    for item in z.infolist():
        if not (dst/item.filename).resolve().is_relative_to(dst.resolve()):
            raise RuntimeError("Unsafe archive member")
    z.extractall(dst)
app=dst/"POS7_Tablet"
hfile=app/"app/src/main/assets/index.html"
gradle=app/"app/build.gradle"
assert hfile.exists() and gradle.exists()
h=hfile.read_text(encoding="utf8")

def replace_once(old,new,label):
    global h
    n=h.count(old)
    if n!=1:raise RuntimeError(f"R321 safety fail {label}: anchor matches {n}")
    h=h.replace(old,new,1)

# Scheduled backup: if a real Android external folder is configured, use
# the existing native saveScheduledBackup; do NOT append two more full-store
# snapshots to the small WebView localStorage quota.
# If no external folder, keep a single fallback ONLY when none already exists;
# never overwrite or delete a previous snapshot automatically.
replace_once(
 "let b=makeBackupObject('auto-'+slot),list=getBackupList();\n list.unshift(b);\n let ok=pos340StoreBackups(list);",
 """let b=makeBackupObject('auto-'+slot);
 let list=getBackupList(), ok=false, externalSelected=false;
 try{externalSelected=!!pos183AndroidBackupInfo()?.selected}catch(_r321){}
 if(!externalSelected&&!list.length)ok=pos340StoreBackups([b]);
 /* R321: never overwrite existing backup snapshots or add full-state clones
    when Android external backup is configured. Native scheduled backup below
    remains unchanged and handles actual file save errors. */""",
 "scheduled full-store local duplication"
)

# Manual backup goes directly to Android's verified file save callback or
# existing browser download. Never generates another ~10MB local snapshot.
replace_once(
 "function manualBackupDownload(){let b=makeBackupObject('manual'),list=getBackupList();list.unshift(b);if(!pos340StoreBackups(list)){toast('لم تتسع مساحة النسخ المحلية؛ احفظ الملف خارج التطبيق')}setBackupMeta({lastLocal:b.createdAt});",
 "function manualBackupDownload(){let b=makeBackupObject('manual');try{setBackupMeta({lastLocal:b.createdAt})}catch(_r321){}",
 "manual backup external-only"
)
# Drive/WhatsApp continue the ORIGINAL external workflow; no new full local copy.
replace_once(
 "let list=getBackupList();list.unshift(b);pos340StoreBackups(list);renderBackupPage();toast('اختر Google Drive لحفظ النسخة')",
 "/* R321: external Drive export; no duplicate full local snapshot */renderBackupPage();toast('اختر Google Drive لحفظ النسخة')",
 "Drive full-store duplication"
)
replace_once(
 "let list=getBackupList();list.unshift(b);pos340StoreBackups(list);renderBackupPage()",
 "/* R321: external WhatsApp export; no duplicate full local snapshot */renderBackupPage()",
 "WhatsApp full-store duplication"
)

# Append a small visible rescue control. The chosen Android file must be
# successfully written before the corresponding local snapshot is removed.
rescue=r'''
<script id="pos7-r321-tab1-quota-recovery">
(function(){
"use strict";
var pending=null, lastStatus="";
var BACKUPS="POS7_BACKUPS_V1", MAIN="POS7_TRIAL188_CLEAN";
function list(){return JSON.parse(localStorage.getItem(BACKUPS)||"[]")}
function say(message){lastStatus=String(message||"");var el=document.getElementById("pos7R321Status");if(el)el.textContent=lastStatus}
function view(){
 var n=0, items=[];
 try{items=list();n=items.length}catch(e){say("تعذر قراءة النسخ المحلية: "+e.message);return}
 var box=document.getElementById("pos7R321Status");
 if(box)box.textContent=lastStatus||("النسخ المحلية القديمة: "+n+
  ". احفظ كل نسخة خارج التطبيق قبل تحرير مكانها. لا تمس بيانات التطبيق.");
 var num=document.getElementById("pos7R321Count");if(num)num.textContent=String(n);
 var btn=document.getElementById("pos7R321Export");if(btn)btn.disabled=!!pending||n===0;
}
function safeName(s){return String(s||"unknown").replace(/[^0-9A-Za-z_-]/g,"_")}
function exportOne(){
 if(pending)return say("هناك عملية حفظ جارية؛ لا تبدأ عملية ثانية");
 if(!window.Pos7Android||typeof window.Pos7Android.saveBackupJson!=="function")
  return say("يلزم إصدار التاب APK للحفظ الآمن بواسطة أندرويد");
 var all;
 try{all=list()}catch(e){return say("تعذر فتح النسخ: "+e.message)}
 if(!all.length)return say("لا توجد نسخ احتياطية محلية مكررة للتحرير");
 var b=all[all.length-1];
 if(!b||b.app!=="POS7"||!b.data||!Array.isArray(b.data.products))
  return say("النسخة القديمة غير معروفة البنية؛ لن تُحذف");
 var k=String(b.createdAt||"")+"|"+String(b.kind||"");
 if(all.filter(x=>String(x.createdAt||"")+"|"+String(x.kind||"")===k).length!==1)
  return say("هوية النسخة غير فريدة؛ لن تُحذف تلقائيًا");
 if(!confirm("سيتم حفظ نسخة محلية قديمة بصيغة JSON خارج التطبيق.\\n"+
  "لن تُحذف النسخة الداخلية إلا بعد أن يؤكد أندرويد نجاح حفظ الملف. متابعة؟"))return;
 try{
   var file="POS7_R321_LocalBackup_"+safeName(b.createdAt)+"_"+safeName(b.kind)+".json";
   var payload=JSON.stringify(b);
   pending={key:k,length:payload.length};
   say("اختر مكان حفظ الملف من أندرويد. لا تلغِ النافذة.");
   window.Pos7Android.saveBackupJson(file,payload);
 }catch(e){pending=null;say("فشل بدء حفظ النسخة؛ لم يُحذف شيء: "+e.message)}
 view();
}
var previousSaveResult=window.pos7OnBackupSaveResult;
window.pos7OnBackupSaveResult=function(success,message){
 var task=pending;pending=null;
 if(task){
   if(success===true){
     try{
       var before=list();
       var indexes=[];
       before.forEach(function(x,i){
         if(String(x.createdAt||"")+"|"+String(x.kind||"")===task.key)indexes.push(i);
       });
       if(indexes.length!==1)throw Error("تغيرت قائمة النسخ؛ لن تُحذف");
       var chosen=before[indexes[0]];
       if(JSON.stringify(chosen).length!==task.length)throw Error("محتوى النسخة تغير؛ لن تُحذف");
       var after=before.filter(function(_,i){return i!==indexes[0]});
       if(after.length)localStorage.setItem(BACKUPS,JSON.stringify(after));
       else localStorage.removeItem(BACKUPS);
       if(list().length!==after.length)throw Error("تعذر التحقق من عدد النسخ المتبقية");
       say("أكّد أندرويد حفظ النسخة خارج التطبيق. حُررت نسختها المحلية فقط. الباقي: "+after.length+
         ". افحص حفظ البيانات الرئيسية الآن.");
     }catch(e){say("تم الحفظ خارجيًا، لكن تحرير النسخة المحلية لم يكتمل: "+e.message)}
   }else say("لم يُؤكد أندرويد نجاح الحفظ. لم تُحذف النسخة المحلية. "+String(message||""));
 }
 if(typeof previousSaveResult==="function"){
   try{previousSaveResult(success,message)}catch(e){console.warn("R321 old backup result notice",e)}
 }
 view();
};
function checkMain(){
 try{
   var old=localStorage.getItem(MAIN);
   if(!old)throw Error("المفتاح الرئيسي غير موجود؛ أوقف العمل ولا تستعد نسخة الآن");
   localStorage.setItem(MAIN,old);
   if(localStorage.getItem(MAIN)!==old)throw Error("القراءة بعد الكتابة لا تطابق الأصل");
   say("نجح اختبار القراءة والكتابة لنفس البيانات دون أي تغيير في الفواتير أو المخزون.");
 }catch(e){say("مساحة التخزين لا تكفي بعد: "+e.message+". صدّر نسخة محلية أخرى ولا تمسح بيانات التطبيق.")}
}
function saveCurrent(){
 if(!confirm("ستُحفظ البيانات الحالية الموجودة في ذاكرة التطبيق عبر المسار الأصلي.\\n"+
    "هذه العملية لا تغيّر الفواتير عمدًا؛ تأكد أولًا من نجاح اختبار التخزين. متابعة؟"))return;
 try{
  if(typeof pos7R102SaveStateDirect!=="function")throw Error("مسار الحفظ الأصلي غير موجود");
  pos7R102SaveStateDirect();
  say("أكّد البرنامج اكتمال حفظ الحالة الحالية. حافظ على النسخة الخارجية.");
 }catch(e){say("لم تنجح كتابة البيانات الحالية: "+e.message)}
}
function mount(){
 if(document.getElementById("pos7R321Toggle"))return;
 var btn=document.createElement("button");
 btn.id="pos7R321Toggle";btn.type="button";btn.textContent="💾 إصلاح التخزين R321";
 btn.style="position:fixed;bottom:66px;left:10px;z-index:2147482000;background:#074b68;color:white;padding:11px 14px;border:2px solid #fff;border-radius:12px;font:bold 15px Arial;box-shadow:0 2px 10px #0007";
 var panel=document.createElement("div");
 panel.id="pos7R321Panel";panel.dir="rtl";
 panel.style="display:none;position:fixed;inset:5% 5%;z-index:2147483000;overflow:auto;background:#fff;color:#101820;padding:22px;border-radius:12px;border:3px solid #075676;box-shadow:0 0 0 100vmax #0009;font:16px Arial";
 panel.innerHTML='<h3>تحرير مساحة التخزين — المتجر الأول</h3>'+
 '<p>لا تحذف التطبيق أو تمسح بياناته. احفظ كل نسخة قديمة خارجيًا قبل تحرير مساحتها. لا تُلمس بيانات الفواتير والمخزون أو Supabase.</p>'+
 '<p>النسخ الكاملة المحلية القديمة: <strong id="pos7R321Count">—</strong></p>'+
 '<p id="pos7R321Status" style="white-space:pre-wrap;border:1px solid #ddd;padding:12px"></p>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
 '<button type="button" id="pos7R321Export">1. حفظ نسخة قديمة خارجيًا ثم تحريرها</button>'+
 '<button type="button" id="pos7R321Check">2. اختبار مساحة الحفظ</button>'+
 '<button type="button" id="pos7R321Save">3. حفظ الحالة الحالية</button>'+
 '<button type="button" id="pos7R321Close">إغلاق</button></div>';
 document.body.appendChild(btn);document.body.appendChild(panel);
 [btn,...panel.querySelectorAll("button")].forEach(function(b){
  b.style.font="bold 15px Arial";b.style.padding="10px";b.style.margin="4px";
 });
 btn.onclick=function(){panel.style.display="block";view()};
 document.getElementById("pos7R321Export").onclick=exportOne;
 document.getElementById("pos7R321Check").onclick=checkMain;
 document.getElementById("pos7R321Save").onclick=saveCurrent;
 document.getElementById("pos7R321Close").onclick=function(){panel.style.display="none"};
 view();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);
else mount();
window.POS7_R321_RECOVERY={open:function(){var b=document.getElementById("pos7R321Toggle");if(b)b.click()},
 exportOne:exportOne,checkMain:checkMain};
})();
</script>
'''
assert h.count("</body>")==1
h=h.replace("</body>",rescue+"\n</body>",1)
assert "POS7_R174_SMART_CAS_SERVER_VERIFIED" in h
assert "POS7_TRIAL188_CLEAN" in h
assert h.count("pos7-r321-tab1-quota-recovery")==1
assert h.count("pos7-localstorage-compression-v1")==1
assert "pos7_inventory_commit_r155" in h
hfile.write_text(h,encoding="utf8")
g=gradle.read_text(encoding="utf8")
assert g.count("versionName '485.7.229-r213'")==1
gradle.write_text(g.replace("versionName '485.7.229-r213'","versionName '485.7.229-r321-tab1'",1),encoding="utf8")
print("R321: tab1 source prepared; full state, cloud R174, signing, and inventory logic unchanged.")
