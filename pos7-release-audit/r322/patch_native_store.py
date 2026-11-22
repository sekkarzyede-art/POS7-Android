"""POS7 R322 Tablet1 only: extend effective storage outside WebView localStorage.
Must be run AFTER R321 source patch; strictly guards all native code anchors.
"""
from pathlib import Path
base=Path('r321-android/tab1/POS7_Tablet')
app=base/'app/src/main'
java=app/'java/com/sokkarzeyedeh/pos7/MainActivity.java'
html=app/'assets/index.html'
gradle=base/'app/build.gradle'
j=java.read_text(encoding='utf8')
h=html.read_text(encoding='utf8')
g=gradle.read_text(encoding='utf8')

def once(source,old,new,label):
    n=source.count(old)
    if n!=1:raise RuntimeError('R322 safety: '+label+' expected 1 match, found '+str(n))
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

# Insert immediately after the existing lossless decompression plugin
# so JS reads legacy values fully decoded and never double-compresses them.
tag='<script id="pos7-localstorage-compression-v1">'
assert h.count(tag)==1,'Original compression bridge missing'
start=h.index(tag)
finish=h.index('</script>',start)+len('</script>')
injection=Path('pos7-release-audit/r322/native_state_bridge.html').read_text(encoding='utf8')
assert h.count('pos7-r322-native-state-storage')==0
h=h[:finish]+'\n'+injection+h[finish:]
assert h.index('pos7-r322-native-state-storage')<h.index("const KEY='POS7_TRIAL188_CLEAN';")
assert h.count('pos7-r321-tab1-quota-recovery')==1
assert h.count('POS7_R174_SMART_CAS_SERVER_VERIFIED')>=1
assert h.count('pos7_inventory_commit_r155')>=1

g=once(g,
    "versionName '485.7.229-r321-tab1'",
    "versionName '485.7.229-r322-tab1'",
    'new signed Tab1 version')
native_target=app/'java/com/sokkarzeyedeh/pos7/Pos7NativeStateStore.java'
assert not native_target.exists()
native_target.write_text(
    Path('pos7-release-audit/r322/Pos7NativeStateStore.java').read_text(encoding='utf8'),encoding='utf8')
java.write_text(j,encoding='utf8')
html.write_text(h,encoding='utf8')
gradle.write_text(g,encoding='utf8')
print('R322 expanded native Android storage added, old localStorage main key retained, Tab1 only')
