from hashlib import sha256
from pathlib import Path
import sys

p=Path(sys.argv[1]);raw=p.read_bytes()
assert sha256(raw).hexdigest()=='c6ea3f3658a8cf5bad50f6e02a3fbdc0038b8b695a9e8245a7b3bcc64c4c9500'
s=raw.decode()

def edit(old,new):
    global s
    assert s.count(old)==1,old[:200]
    s=s.replace(old,new,1)

a=s.index('function pos391TogglePrivacy(){')
b=s.index('function pos391MarkCards(){',a)
edit(s[a:b],Path(__file__).with_name('privacy.js').read_text())
edit('<style id="pos391-privacy-style">','''<style id="pos400-privacy-dialog">
#pos400PrivacyDialog{width:min(360px,90vw);border:1px solid #b7cdbd;border-radius:14px;padding:16px;color:#183047}
#pos400PrivacyDialog::backdrop{background:#10271ba8}
#pos400PrivacyDialog form{display:grid;gap:8px}
#pos400PrivacyDialog h2,#pos400PrivacyDialog p{margin:0}
#pos400PrivacyDialog input{min-height:44px;width:100%;box-sizing:border-box}
#pos400PrivacyDialog p{color:#a51313}
#pos400PrivacyDialog form>div{display:flex;gap:8px}
</style>
<style id="pos391-privacy-style">''')
edit("const fm=n=>nv(n||0).toLocaleString('en-US',{maximumFractionDigits:2});","const pos400AmountFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});\nconst fm=n=>pos400AmountFormat.format(nv(n||0));")
edit("  const USD=v=>'$'+N(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});","  const usdFormat=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});\n  const USD=v=>'$'+usdFormat.format(N(v));")
edit("  function lbp176(v){return Math.round(num(v)*rate176()).toLocaleString('en-US')+' ل.ل';}","  function lbp176(v,rate){return Math.round(num(v)*rate).toLocaleString('en-US')+' ل.ل';}")
edit("    box.innerHTML=(saleCart&&saleCart.length)?saleCart.map(function(x){\n      var p=state.products.find(function(y){return y.id===x.id}),a=p?saleAvailable(p):0;",
"""    var rate=rate176();
    box.innerHTML=(saleCart&&saleCart.length)?saleCart.map(function(x){
      var p=window.pos719ProductById?window.pos719ProductById(x.id):state.products.find(function(y){return y.id===x.id});
      var a=p?Math.max(0,nv(p.stock||0)+originalSaleQty(p.id)-nv(x.qty||0)):0;""")
edit("lbp176(x.sell)+'</small><small class=\"pos135-piece-price\">'+pos135PieceText(p,Math.round(num(x.sell)*rate176()))","lbp176(x.sell,rate)+'</small><small class=\"pos135-piece-price\">'+pos135PieceText(p,Math.round(num(x.sell)*rate))")
edit("    var h=document.querySelector('#sales .sale-table-head');if(h)h.innerHTML='<span>الصنف</span><span>الكمية</span><span>السعر الإفرادي</span><span>الإجمالي</span><span></span>';","""    var h=document.querySelector('#sales .sale-table-head');
    var headings='<span>الصنف</span><span>الكمية</span><span>السعر الإفرادي</span><span>الإجمالي</span><span></span>';
    if(h&&h.innerHTML!==headings)h.innerHTML=headings;""")
edit("box.innerHTML=html;box.classList.toggle('pos486-ok',!hasExpiryWithin45Days())","if(box.innerHTML!==html)box.innerHTML=html;box.classList.toggle('pos486-ok',!hasExpiryWithin45Days())")
edit("function product(id){return products().find(p=>String(p.id)===String(id));}","function product(id){return window.pos719ProductById?window.pos719ProductById(id):products().find(p=>String(p.id)===String(id));}")
s=s.replace('485.7.229-r399-tab1','485.7.229-r400-tab1').replace("const VERSION='R399', MAX=250;","const VERSION='R400', MAX=250;").replace('تشخيص الأداء المتقدم — R399','تشخيص الأداء المتقدم — R400')
p.write_bytes(s.encode())
if len(sys.argv)>2:
    g=p.parents[3]/'build.gradle';old=g.read_text()
    assert old.count('485.7.229-r399-tab1')==1
    g.write_text(old.replace('485.7.229-r399-tab1','485.7.229-r400-tab1'))
