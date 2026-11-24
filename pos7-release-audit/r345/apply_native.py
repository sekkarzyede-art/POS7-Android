"""R345 Tab2 only. Apply exact tested HTML patch before this native step.
No data access or cloud operation during source generation."""
from pathlib import Path
import hashlib
base=Path("r305-android/tab2/POS7_Tablet")
app=base/"app/src/main"
java=app/"java/com/sokkarzeyedeh/pos7/MainActivity.java"
html=app/"assets/index.html"
gradle=base/"app/build.gradle"
j=java.read_text(encoding="utf8")
h=html.read_text(encoding="utf8")
g=gradle.read_text(encoding="utf8")
assert hashlib.sha256(html.read_bytes()).hexdigest()=="0e626ad4a5fc6bc9499276521714237fbcd11cf134d3c7fa7ca1b35cc799b007"
assert "https://rmskuolsiqbzxuakofpb.supabase.co" in h
assert "jdcolkgzwqpwbfvcrdje" not in h
assert "POS7_RESTORE_PENDING_R305" in h
assert h.count('id="pos7-r322-native-state-storage"')==1
assert h.count('id="pos7-r331-storage-settings"')==1
assert h.count('id="pos7-r333-storage-dashboard"')==1
restore_names=["restore_transfer.js","local_restore_r323.js","same_device_r324.js"]
restore_hashes={name:hashlib.sha256((app/"assets"/name).read_bytes()).hexdigest() for name in restore_names}
def once(source,old,new,label):
    if source.count(old)!=1:raise RuntimeError("R345 safety: "+label+" unexpected anchor count "+str(source.count(old)))
    return source.replace(old,new,1)
j=once(j,
    '    private WebView webView;',
    '    private WebView webView;\n    private volatile boolean pos322TrustedPage=false;\n    private Pos7NativeStateStore pos322NativeState;',
    'new Native store fields')
j=once(j,
    '        super.onCreate(savedInstanceState);',
    '''        super.onCreate(savedInstanceState);
        try { pos322NativeState = new Pos7NativeStateStore(this); }
        catch (IOException e) {
            android.util.Log.e("POS7-R322", "Cannot prepare expanded local state", e);
        }''','native initialization after Context available')
j=once(j,'        webView.setWebViewClient(new WebViewClient() {',
   '''        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pos322TrustedPage = "file:///android_asset/index.html".equals(url);
                super.onPageStarted(view, url, favicon);
            }''','navigation access security')
j=once(j,
    '        AndroidPrintBridge(Context context) { this.context = context; }',
    '''        AndroidPrintBridge(Context context) { this.context = context; }

        // R322: synchronous bridge to a single private, atomic Android data file.
        // Never lets a non-app page access it, and does not expose file paths.
        @JavascriptInterface public String pos322ReadState() {
            if (!pos322TrustedPage) return "__POS7_R322_ACCESS_DENIED__";
            if (pos322NativeState == null) return "__POS7_R322_IO_ERROR__";
            try { return pos322NativeState.read(); }
            catch (IOException e) {
                android.util.Log.e("POS7-R322", "Native store read failed", e);
                return "__POS7_R322_IO_ERROR__";
            }
        }

        @JavascriptInterface public boolean pos322WriteState(String stateJson) {
            return pos322TrustedPage && pos322NativeState != null
                && pos322NativeState.write(stateJson);
        }''',
    'trusted native storage JS interfaces')


marker='''        @JavascriptInterface public boolean pos322WriteState(String stateJson) {
            return pos322TrustedPage && pos322NativeState != null
                && pos322NativeState.write(stateJson);
        }'''
assert j.count(marker)==1, 'R322 trusted bridge changed'
inject='''

        // R333: read-only capacity from the private Android data partition.
        // JS is served only from the trusted bundled POS7 asset.
        @JavascriptInterface public String pos333StorageStats() {
            if (!pos322TrustedPage) return "{\\"error\\":\\"untrusted_page\\"}";
            try {
                android.os.StatFs fs = new android.os.StatFs(context.getFilesDir().getAbsolutePath());
                long total = fs.getTotalBytes();
                long free = fs.getAvailableBytes();
                java.io.File state = new java.io.File(
                    new java.io.File(context.getFilesDir(), "pos7_native_state_tab2_r345"),
                    "pos7_main_state.json");
                long dbSize = state.isFile() ? state.length() : -1L;
                org.json.JSONObject result = new org.json.JSONObject();
                result.put("totalBytes", total);
                result.put("freeBytes", free);
                result.put("pos7DatabaseBytes", dbSize);
                // Existing R322 single-state safety limit: 128 MiB.
                result.put("pos7DatabaseLimitBytes", 128L * 1024L * 1024L);
                result.put("source", "android-internal-data");
                return result.toString();
            } catch (Exception e) {
                android.util.Log.e("POS7-R333", "Storage stats failed", e);
                return "{\\"error\\":\\"storage_stats_unavailable\\"}";
            }
        }'''
j=j.replace(marker,marker+inject,1)

native=app/"java/com/sokkarzeyedeh/pos7/Pos7NativeStateStore.java"
assert not native.exists()
native.write_text("package com.sokkarzeyedeh.pos7;\n\nimport android.content.Context;\nimport android.util.AtomicFile;\nimport java.io.File;\nimport java.io.FileNotFoundException;\nimport java.io.FileOutputStream;\nimport java.io.IOException;\nimport java.nio.charset.StandardCharsets;\n\n/**\n * R322: durable private Android backing for POS7_TRIAL188_CLEAN only.\n * This is NOT a WebView localStorage quota override. No shared preferences,\n * Supabase, stock synchronization or invoice semantics are changed.\n *\n * AtomicFile rolls back incomplete writes and never replaces a good file\n * with a partial payload after a process crash or disk-space failure.\n */\nfinal class Pos7NativeStateStore {\n    private static final int MAX_BYTES = 128 * 1024 * 1024;\n    private final AtomicFile disk;\n\n    Pos7NativeStateStore(Context context) throws IOException {\n        File prior = new File(context.getFilesDir(), \"pos7_native_state_r322\");\n        for (String name : new String[]{\"pos7_main_state.json\", \"pos7_main_state.json.bak\", \"pos7_main_state.json.new\"}) {\n            if (new File(prior, name).exists()) throw new IOException(\"Tab1 native state present: refusing Tab2 migration\");\n        }\n        File dir = new File(context.getFilesDir(), \"pos7_native_state_tab2_r345\");\n        if (!dir.isDirectory() && !dir.mkdirs()) {\n            throw new IOException(\"Cannot create POS7 private state directory\");\n        }\n        disk = new AtomicFile(new File(dir, \"pos7_main_state.json\"));\n    }\n\n    synchronized String read() throws IOException {\n        try {\n            byte[] bytes = disk.readFully();\n            if (bytes.length == 0 || bytes.length > MAX_BYTES) {\n                throw new IOException(\"Invalid POS7 state size\");\n            }\n            return new String(bytes, StandardCharsets.UTF_8);\n        } catch (FileNotFoundException notInitialized) {\n            // No file yet: JS migrates from the original WebView localStorage.\n            return null;\n        }\n    }\n\n    synchronized boolean write(String raw) {\n        if (raw == null || raw.length() < 2 || raw.charAt(0) != '{' || raw.length() > MAX_BYTES) {\n            return false;\n        }\n        byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);\n        if (bytes.length == 0 || bytes.length > MAX_BYTES) return false;\n        FileOutputStream out = null;\n        try {\n            out = disk.startWrite();\n            out.write(bytes);\n            disk.finishWrite(out);\n            return true;\n        } catch (IOException | RuntimeException failure) {\n            if (out != null) disk.failWrite(out);\n            android.util.Log.e(\"POS7-R322\", \"Native state save failed; previous state retained\", failure);\n            return false;\n        }\n    }\n\n    synchronized long sizeBytes() {\n        try {\n            String text = read();\n            return text == null ? 0 : text.getBytes(StandardCharsets.UTF_8).length;\n        } catch (Exception e) {\n            return -1;\n        }\n    }\n\n    long freeBytes() {\n        return disk.getBaseFile().getParentFile().getUsableSpace();\n    }\n}\n",encoding="utf8")
(app/"assets/r331_storage_settings.js").write_text("/* R331: move storage maintenance controls from fixed sale overlays to\n * the existing saleSettingsPage. Same buttons and click handlers; NO data writes.\n */\n(function(){\n'use strict';\nfunction attach(){\n const settings=document.getElementById('saleSettingsPage');\n if(!settings)return false;\n let panel=document.getElementById('pos7R331StorageSettings');\n if(!panel){\n  panel=document.createElement('section');\n  panel.className='panel';\n  panel.id='pos7R331StorageSettings';\n  panel.dir='rtl';\n  panel.style.cssText='margin:14px 0;padding:14px;border:1px solid #cbd5e1;border-radius:12px';\n  const title=document.createElement('h3');\n  title.textContent='💾 صيانة التخزين — أدوات متقدمة';\n  const help=document.createElement('p');\n  help.textContent='للصيانة فقط. لا تحذف بيانات التطبيق؛ احتفظ بنسخة احتياطية خارجية قبل تحرير النسخ.';\n  help.style.cssText='font:13px Arial;color:#475569;margin:8px 0';\n  const actions=document.createElement('div');\n  actions.id='pos7R331StorageActions';\n  actions.style.cssText='display:flex;flex-wrap:wrap;gap:10px';\n  panel.appendChild(title);panel.appendChild(help);panel.appendChild(actions);\n  settings.appendChild(panel);\n }\n const actions=document.getElementById('pos7R331StorageActions');\n for(const id of ['pos7R321Toggle','pos7R322Info']){\n  const button=document.getElementById(id);\n  if(button&&button.parentElement!==actions){\n    actions.appendChild(button);\n    // Remove the fixed-position UI while keeping ORIGINAL onclick unchanged.\n    button.style.cssText='position:static;bottom:auto;left:auto;right:auto;z-index:auto;box-shadow:none;display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;margin:0;max-width:100%;white-space:normal;border:1px solid #94a3b8;border-radius:9px;background:#f1f5f9;color:#0f172a;font:bold 14px Arial;';\n  }\n }\n return !!document.getElementById('pos7R321Toggle');\n}\nfunction mount(){\n attach();\n // For slow devices, R321/R322 may mount after DOMContentLoaded.\n if(window.MutationObserver){\n  const observer=new MutationObserver(function(){attach()});\n  const settings=document.getElementById('saleSettingsPage');\n  if(settings)observer.observe(settings,{childList:true,subtree:true});\n  // The two original controls can be initially appended under body by their\n  // deferred mount handlers. Observe additions only, and never modify data.\n  observer.observe(document.body,{childList:true});\n }\n}\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);\nelse mount();\nwindow.POS7_R331_STORAGE_SETTINGS={attach:attach};\n})();",encoding="utf8")
(app/"assets/r333_storage_dashboard.js").write_text("/* R333: read-only Android storage capacity and POS7 native JSON file size.\n * Never mutates data. Existing R331 maintenance controls remain available.\n */\n(function(){\n'use strict';\nconst ID='pos7R333StorageStats';\nconst bytes=n=> {\n if(typeof n!=='number'||!Number.isFinite(n)||n<0)return 'غير متاح';\n if(n===0)return '0 B';\n const units=['B','KB','MB','GB','TB'];\n const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),units.length-1);\n return (n/Math.pow(1024,i)).toFixed(i===0?0:2)+' '+units[i];\n};\nfunction cell(label,value,detail){\n const d=document.createElement('div');\n d.style.cssText='min-width:145px;flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:11px;background:#f8fafc';\n const l=document.createElement('div');l.textContent=label;\n l.style.cssText='font:13px Arial;color:#475569';\n const v=document.createElement('div');v.textContent=value;\n v.style.cssText='font:bold 21px Arial;color:#0f172a;margin:7px 0';\n d.appendChild(l);d.appendChild(v);\n if(detail){const s=document.createElement('div');s.textContent=detail;s.style.cssText='font:11px Arial;color:#64748b';d.appendChild(s)}\n return d;\n}\nfunction mount(){\n const settings=document.getElementById('saleSettingsPage');\n const parent=document.getElementById('pos7R331StorageSettings');\n if(!settings||!parent)return false;\n if(document.getElementById(ID))return true;\n const panel=document.createElement('div');\n panel.id=ID;panel.dir='rtl';\n panel.style.cssText='margin:14px 0 0;padding:12px;border:1px solid #94a3b8;border-radius:12px;background:white;';\n const title=document.createElement('h4');title.textContent='📊 حالة مساحة التخزين';\n title.style.cssText='margin:0 0 8px;font:bold 17px Arial;color:#0f172a';\n const desc=document.createElement('p');\n desc.textContent='المساحة الداخلية المتاحة للتطبيق، والحجم الفعلي لملف قاعدة بيانات POS7. هذه قراءة فقط.';\n desc.style.cssText='font:12px Arial;color:#475569;line-height:1.7;margin:4px 0 12px';\n const values=document.createElement('div');values.id=ID+'Values';\n values.style.cssText='display:flex;gap:10px;flex-wrap:wrap';\n const refresh=document.createElement('button');refresh.type='button';\n refresh.id='pos7R333Refresh';refresh.textContent='↻ تحديث حالة التخزين';\n refresh.style.cssText='padding:10px 14px;margin-top:12px;border:1px solid #2563eb;border-radius:8px;background:#eff6ff;color:#1e40af;font:bold 14px Arial';\n const note=document.createElement('div');note.id=ID+'Note';\n note.style.cssText='font:12px Arial;color:#64748b;margin-top:10px;line-height:1.7';\n refresh.onclick=update;\n panel.appendChild(title);panel.appendChild(desc);\n panel.appendChild(values);panel.appendChild(refresh);panel.appendChild(note);\n // Keep it in the R331 maintenance section, never in the sale invoice overlay.\n parent.insertBefore(panel,document.getElementById('pos7R331StorageActions')||null);\n update();\n return true;\n}\nfunction update(){\n const target=document.getElementById(ID+'Values'),note=document.getElementById(ID+'Note');\n if(!target||!note)return;\n target.replaceChildren();\n const bridge=window.Pos7Android;\n if(!bridge||typeof bridge.pos333StorageStats!=='function'){\n  target.appendChild(cell('مساحة أندرويد','غير متاح'));\n  note.textContent='هذا المؤشر يتطلب APK R345 على التاب. متصفح HTML التجريبي لا يعرض مساحة جهازك.';\n  return;\n }\n try{\n  const st=JSON.parse(bridge.pos333StorageStats());\n  if(st.error||!Number.isFinite(st.totalBytes)||!Number.isFinite(st.freeBytes)||\n     st.totalBytes<=0||st.freeBytes<0||st.freeBytes>st.totalBytes)\n   throw Error(st.error||'قراءة المساحة غير صالحة');\n  target.appendChild(cell('المساحة الإجمالية',bytes(st.totalBytes),'قسم بيانات أندرويد الداخلي'));\n  target.appendChild(cell('المساحة الفارغة',bytes(st.freeBytes),'المتاح حاليًا لتطبيقات الجهاز'));\n  target.appendChild(cell('قاعدة بيانات POS7',bytes(st.pos7DatabaseBytes),'ملف الحالة الرئيسي المحفوظ فعليًا'));\n  const cap=st.pos7DatabaseLimitBytes;\n  const capDescription=cap>0?'الحد الحالي لملف قاعدة POS7 المفرد: '+bytes(cap)+'. ':'';\n  const lowSpace=st.freeBytes<200*1024*1024;\n  note.textContent=capDescription+\n    'هذه المساحة مشتركة بين التطبيقات، وليست محجوزة للبرنامج. '+\n    (lowSpace?'تنبيه: المساحة الحرة أقل من 200 MB؛ احتفظ بنسخة احتياطية خارجية.':'')+\n    ' آخر تحديث: '+new Date().toLocaleTimeString('ar-LB');\n }catch(e){\n  target.appendChild(cell('إحصاءات التخزين','تعذرت القراءة'));\n  note.textContent='لم تتغير أي بيانات. السبب: '+String(e&&e.message||e);\n }\n}\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);\nelse mount();\nif(window.MutationObserver){\n const observer=new MutationObserver(function(){if(!document.getElementById(ID))mount()});\n observer.observe(document.documentElement,{childList:true,subtree:true});\n}\nwindow.POS7_R333_STORAGE_DASHBOARD={refresh:update,mount:mount};\n})();",encoding="utf8")
g=once(g,"versionName '485.7.229-r324-tab2'","versionName '485.7.229-r345-tab2'","Tab2 development version")
java.write_text(j,encoding="utf8")
gradle.write_text(g,encoding="utf8")
assert restore_hashes=={name:hashlib.sha256((app/"assets"/name).read_bytes()).hexdigest() for name in restore_names}
print("R345 native storage + dashboard prepared on Tab2 only; restore modules byte-identical")
