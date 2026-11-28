from hashlib import sha256
from pathlib import Path
import sys

p=Path(sys.argv[1])
raw=p.read_bytes()
assert sha256(raw).hexdigest()=='c3e0b0b9f99c825a9017e85ba6508329f2f61dbb46692ab138ae0b4ecc772902'

def once(s,a,b):
    assert s.count(a)==1,a
    return s.replace(a,b,1)

s=raw.decode()
s=once(s,"function nativeRead(){","""// A cold WebView can run inline scripts before Android marks the page trusted.
let pos401BootReadDenied=false;
let pos401InitialRead=true;
window.pos401RetryAfterTrustedLoad=function(){
 if(!pos401BootReadDenied)return;
 pos401BootReadDenied=false;
 location.reload();
};
function nativeRead(){""")
s=once(s,' var x=bridge.pos322ReadState();',''' var x=bridge.pos322ReadState();
 if(pos401InitialRead&&x==='__POS7_R322_ACCESS_DENIED__')pos401BootReadDenied=true;''')
s=once(s,'  var current=nativeRead();','''  var current;
  try{current=nativeRead();}finally{pos401InitialRead=false;}''')
s=once(s,'   document.body.appendChild(el);\n  },{once:true});','''   if(pos401BootReadDenied){
    const retry=document.createElement('button');
    retry.type='button';retry.textContent='إعادة المحاولة';
    retry.onclick=()=>location.reload();
    el.appendChild(document.createElement('br'));el.appendChild(retry);
   }
   document.body.appendChild(el);
  },{once:true});''')
s=s.replace('485.7.229-r398-tab2','485.7.229-r401-tab2').replace("const VERSION='R398', MAX=250;","const VERSION='R401', MAX=250;").replace('تشخيص الأداء المتقدم — R387','تشخيص الأداء المتقدم — R401')
p.write_bytes(s.encode())
if len(sys.argv)>2:
    app=p.parents[3];g=app/'build.gradle'
    g.write_text(once(g.read_text(),'485.7.229-r398-tab2','485.7.229-r401-tab2'))
    java=app/'src/main/java/com/sokkarzeyedeh/pos7/MainActivity.java'
    source=java.read_text()
    source=once(source,'    private volatile boolean pos322TrustedPage=false;','''    private volatile boolean pos322TrustedPage=false;
    private boolean pos401BootRetryChecked;''')
    source=once(source,'''                super.onPageFinished(view, url);
                notifyJsPrinterSelected();''','''                super.onPageFinished(view, url);
                if (!pos401BootRetryChecked
                        && "file:///android_asset/index.html".equals(url)
                        && url.equals(view.getUrl())) {
                    pos401BootRetryChecked = true;
                    view.evaluateJavascript("if (typeof window.pos401RetryAfterTrustedLoad === 'function') window.pos401RetryAfterTrustedLoad();", null);
                }
                notifyJsPrinterSelected();''')
    java.write_text(source)
    Path('/tmp/r364-html.sha').write_text(sha256(p.read_bytes()).hexdigest())
