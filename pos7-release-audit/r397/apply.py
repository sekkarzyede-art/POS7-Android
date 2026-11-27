from hashlib import sha256
from pathlib import Path
import sys
p=Path(sys.argv[1])
raw=p.read_bytes()
assert sha256(raw).hexdigest()=='a69dd6399ad72993e20e93ddff629380ac82ec10a464a2bbdb714b5ba419c282'
html=raw.decode()
src=Path(__file__).parent

def edit(old,new):
    global html
    assert html.count(old)==1,old[:120]
    html=html.replace(old,new,1)

edit('<section id="home" class="page active home-page">','''<section id="home" class="page active home-page">
<button type="button" id="pos397DailyCash" onclick="pos397PrintDailyCash()" aria-label="طباعة جرد الصندوق اليومي">🖨️ جرد الصندوق اليومي</button>''')
edit('function pos7SendNativeBluetooth(bytes,jobName){','function pos7SendNativeBluetooth(bytes,jobName,singleCopy){')
edit('var copies=Math.min(5,Math.max(1,Math.round(N(read().copies)||1))),all=','var copies=singleCopy?1:Math.min(5,Math.max(1,Math.round(N(read().copies)||1))),all=')
edit("setStatus('جارٍ إرسال الفاتورة إلى '+", "setStatus((singleCopy?'جارٍ إرسال جرد الصندوق إلى ':'جارٍ إرسال الفاتورة إلى ')+")
edit('window.pos408GetSettings=read;', (src/'thermal.js').read_text()+'\nwindow.pos408GetSettings=read;')
edit('<style id="pos391-privacy-style">','''<style id="pos397-daily-cash-style">
#pos397DailyCash{display:none;position:fixed;left:12px;bottom:calc(83px + env(safe-area-inset-bottom,0px));z-index:65;padding:9px 13px;min-height:44px;border:1px solid #1a7851;border-radius:999px;background:#096843;color:white;font-weight:800;box-shadow:0 4px 12px #152e3d55}
#home.active #pos397DailyCash{display:block}
.pos391-private #home #pos397DailyCash{display:none!important}
</style>
<script id="pos397-daily-cash">
'''+(src/'daily-cash.js').read_text()+'''</script>
<style id="pos391-privacy-style">''')
edit("const VERSION='R396', MAX=250;", "const VERSION='R397', MAX=250;")
edit('تشخيص الأداء المتقدم — R396','تشخيص الأداء المتقدم — R397')
p.write_bytes(html.replace('485.7.229-r396-tab1','485.7.229-r397-tab1').encode())
if len(sys.argv)>2:
    gradle=p.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r396-tab1')==1
    gradle.write_text(old.replace('485.7.229-r396-tab1','485.7.229-r397-tab1'))
