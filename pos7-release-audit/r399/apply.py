from hashlib import sha256
from pathlib import Path
import re,sys
p=Path(sys.argv[1])
raw=p.read_bytes()
assert sha256(raw).hexdigest()=='ce41cc6edce1a12169c8f6517f08812168b153fa89a9531c7b31618e55ec3afe'
s=raw.decode()
old=re.search(r'<button type="button" id="pos397DailyCash".*?</button>\n',s)[0]
s=s.replace(old,'',1)
end='onclick="pos369Inquiry()">استعلام ودفعة سريعة</button></div>'
assert s.count(end)==1
s=s.replace(end,end[:-6]+old.strip().replace('طباعة جرد الصندوق اليومي','معاينة جرد الصندوق اليومي')+'</div>')
s,n=re.subn(r'(?m)^#pos397DailyCash\{.*\n#home.active #pos397DailyCash\{.*\n','''#pos397DailyCash{position:static;min-height:44px;white-space:nowrap}
#pos399CashPreview{width:min(680px,94vw);max-height:90dvh;border:1px solid #bbd5c5;border-radius:14px;padding:14px;color:#183047}
#pos399CashPreview[open]{display:flex;flex-direction:column;gap:8px}
#pos399CashPreview::backdrop{background:#10271ba8}
#pos399CashPreview h2,#pos399CashPreview p{margin:0;text-align:center}
.pos399-cash-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;text-align:center}
.pos399-cash-summary div{padding:6px;background:#f1f6f3;border-radius:8px}
.pos399-cash-summary span,.pos399-cash-summary b{display:block;overflow-wrap:anywhere}
.pos399-cash-actions{display:flex;gap:8px;flex-wrap:wrap}
.pos399-cash-actions button{min-height:44px}
.pos399-cash-rows{overflow:auto;min-height:0}
.pos399-cash-rows table{width:100%;border-collapse:collapse}
.pos399-cash-rows td,.pos399-cash-rows th{padding:5px;border-block-end:1px solid #ddd;text-align:start}
''',s)
assert n==1
start=s.index(' window.pos397PrintDailyCash=function(){')
end=s.index('\n})();',start)
s=s[:start]+Path(__file__).with_name('preview.js').read_text().rstrip()+s[end:]
s=s.replace('485.7.229-r397-tab1','485.7.229-r399-tab1').replace("const VERSION='R397', MAX=250;","const VERSION='R399', MAX=250;").replace('تشخيص الأداء المتقدم — R397','تشخيص الأداء المتقدم — R399')
p.write_bytes(s.encode())
if len(sys.argv)>2:
    g=p.parents[3]/'build.gradle';old=g.read_text()
    assert old.count('485.7.229-r397-tab1')==1
    g.write_text(old.replace('485.7.229-r397-tab1','485.7.229-r399-tab1'))
