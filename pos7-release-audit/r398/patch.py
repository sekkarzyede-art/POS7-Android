from hashlib import sha256
from pathlib import Path
import sys
p=Path(sys.argv[1]);raw=p.read_bytes()
assert sha256(raw).hexdigest()=='16bf80a70bd91986f8dc97c04e869a25a0a2d266a6cbc6b0e3f370fa03a5fee3'
html=raw.decode()
marker="if(bridge&&typeof bridge.pos322ReadState==='function'&&typeof bridge.pos322WriteState==='function'){"
assert html.count(marker)==1
html=html.replace(marker,Path(__file__).with_name('recovery.js').read_text()+marker)
old="   if(old===null)throw Error('R322: لا توجد بيانات المتجر الأصلية؛ الترحيل موقوف');"
assert html.count(old)==1
html=html.replace(old,"""   if(old===null){
    fault='R398: بانتظار اختيار نسخة تاب ٢';
    showFreshRestore();
    // Keep initialization blocked. Only the explicit restore action can write.
    proto.getItem=function(key){
     if(isLocal(this)&&String(key)===MAIN)throw Error(fault);
     return oldGet.apply(this,arguments);
    };
    proto.setItem=function(key){
     if(isLocal(this)&&String(key)===MAIN)throw Error(fault);
     return oldSet.apply(this,arguments);
    };
    window.POS7_R322_NATIVE_STORE={status:status};
    return;
   }""")
html=html.replace('485.7.229-r387-tab2','485.7.229-r398-tab2').replace("const VERSION='R387', MAX=250;","const VERSION='R398', MAX=250;")
p.write_bytes(html.encode())
if len(sys.argv)>2:
    g=p.parents[3]/'build.gradle';v=g.read_text()
    assert v.count('485.7.229-r387-tab2')==1
    g.write_text(v.replace('485.7.229-r387-tab2','485.7.229-r398-tab2'))
    Path('/tmp/r364-html.sha').write_text(sha256(p.read_bytes()).hexdigest())
