from pathlib import Path
import hashlib
import re
import sys

path=Path(sys.argv[1])
raw=path.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='67dd4fe74cb570042cc611cbb6a76c0669c568e0434648b35e81d44b553e3a14'
s=raw.decode()
def replace(old,new,n=1):
    global s
    assert s.count(old)==n,(old[:90],s.count(old),n)
    s=s.replace(old,new)

s,n=re.subn(r'<button id="pos297BackSaleInvoice"[^>]+>[^<]+</button>', '',s)
assert n==1
x='<button class="danger pos200-clear-corner" type="button" onclick="clearSaleCart()" aria-label="مسح جميع أصناف السلة" title="مسح جميع الأصناف">×</button>'
replace(x,'')
replace('<button class="danger pos200-clear-original" onclick="clearSaleCart()" style="display:none">مسح الجميع</button>','')
replace('<div class="search sale-search-wrap sale-search-fixed"><input id="search"', '<button id="pos390ClearCart" type="button" onclick="clearSaleCart()" aria-label="مسح جميع أصناف السلة" title="مسح جميع أصناف السلة">×</button><div class="search sale-search-wrap sale-search-fixed"><input id="search"')
s,n=re.subn(r"  const original=sales.querySelector\('\.pos200-clear-corner'\);\n  if\(original\)\{[^\n]+\}\n",'',s)
assert n==1
replace("bar.setAttribute('aria-label','السلات ومسح الأصناف')","bar.setAttribute('aria-label','سلال البيع والعروض')")
replace("const specs=[\n['home'","""const specs=[
['add','إضافة صنف','#0878eb',null,'<path d="M12 5v14M5 12h14"/>'],
['home'""")
replace("e.stopPropagation();if(armed!==s[0])","e.stopPropagation();if(s[0]==='add'){clear();window.pos171AddSaleProduct();return;}if(armed!==s[0])")

# Resolve the final sale price before any caller renders the cart.
replace('function addSaleItem(id,fromBarcode=false){','function addSaleItem(id,fromBarcode=false,deferRender=false){')
replace('lastBarcodeSaleId=id;renderCart();setTimeout(', 'lastBarcodeSaleId=id;if(!deferRender)renderCart();setTimeout(')
replace("if(row)row.scrollIntoView({behavior:'smooth',block:'nearest'});let q=document.getElementById('search');if(q)q.focus({preventScroll:true});", """if(document.getElementById('pos192Drawer')?.classList.contains('pos192-open'))return;if(row)row.scrollIntoView({behavior:'auto',block:'nearest'});let q=document.getElementById('search');if(q)q.focus({preventScroll:true});""")
replace("row.classList.remove('barcode-focus');},1200)}","row.classList.remove('barcode-focus');},1200);return true}")
replace("""    priorAdd.call(this,id,fromBarcode);
    var product=state.products.find(function(p){return String(p.id)===String(id)}),row=saleCart.find(function(r){return String(r.id)===String(id)});
    if(!product||!row)return;""","""    if(priorAdd.call(this,id,fromBarcode,true)!==true)return;
    var product=window.pos719ProductById?.(id)||state.products.find(function(p){return String(p.id)===String(id)}),row=saleCart.find(function(r){return String(r.id)===String(id)});
    if(!product||!row){renderCart();return;}""")
replace("function refreshQuantities(){const d=el('pos192Drawer');if(!d||!d.classList.contains('pos192-open'))return;d.querySelectorAll('[data-quick-qty]').forEach(b=>{const q=cartQuantity(b.dataset.quickQty);b.textContent=q>0?'×'+q:'＋';b.setAttribute('aria-label',q>0?'الكمية في السلة '+q:'غير موجود في السلة');});}","""function refreshQuantities(){const d=el('pos192Drawer');if(!d||!d.classList.contains('pos192-open'))return;const totals=new Map();for(const x of saleCart){const id=String(x.id);totals.set(id,(totals.get(id)||0)+Number(x.qty||0));}d.querySelectorAll('[data-quick-qty]').forEach(b=>{const q=totals.get(b.dataset.quickQty)||0,text=q>0?'×'+q:'＋';if(b.textContent!==text){b.textContent=text;b.setAttribute('aria-label',q>0?'الكمية في السلة '+q:'غير موجود في السلة');}});}""")
replace("إلى سلة البيع');dismissKeyboard();refreshQuantities();}","إلى سلة البيع');dismissKeyboard();}")
replace("let id=target?.id||'';","let id=target?.id||(target?.matches('.pos205-tile[data-sale]')?'quickSaleTile':'');")
replace("'payments','receipts']);","'payments','receipts','cashMovement286']);")

# Paint the cash report page before generating its full historical table.
replace("openPage('cashMovement286');pos286InitCashReport()", "pos390OpenCashReport()",2)
replace("window.pos286InitCashReport=function(){","""window.pos390OpenCashReport=function(){
 openPage('cashMovement286');
 const page=document.getElementById('cashMovement286'),report=document.getElementById('cash286Report');
 if(!page?.classList.contains('active')||!report)return;
 report.textContent='جارٍ تجهيز تقرير حركة الصندوق…';
 requestAnimationFrame(()=>setTimeout(()=>{
  if(page.classList.contains('active'))window.pos286InitCashReport();
 },0));
};
window.pos286InitCashReport=function(){""")
replace('var all=(state.mcLedger||[]).filter(function(x){return x.account===acc}).slice().sort(function(a,b){var da=D(a.date),db=D(b.date);if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return da-db});','''var dated=(state.mcLedger||[]).filter(x=>x.account===acc).map(x=>({row:x,date:D(x.date)}));
  dated.sort((a,b)=>(a.date?+a.date:Infinity)-(b.date?+b.date:Infinity));
  var all=dated.map(x=>x.row);''')
for old,expr in [
 ('var priorRows=all.filter(function(x){var z=D(x.date);return z&&z<from});','z&&z<from'),
 ('var period=all.filter(function(x){var z=D(x.date);return z&&z>=from&&z<=to});','z&&z>=from&&z<=to'),
 ('var afterRows=all.filter(function(x){var z=D(x.date);return z&&z>to});','z&&z>to'),
 ('var undatedRows=all.filter(function(x){return !D(x.date)});','!z')
]:
    name=old.split('=')[0]
    replace(old,name+'=dated.filter(({date:z})=>'+expr+').map(x=>x.row);')

replace("const VERSION='R389', MAX=250;","const VERSION='R390', MAX=250;")
replace('تشخيص الأداء المتقدم — R389','تشخيص الأداء المتقدم — R390')
s=s.replace('485.7.229-r389-tab1','485.7.229-r390-tab1')
s+='''
<style id="pos7-r390-sales-controls">
#sales #pos390ClearCart{display:none;position:fixed;inset-inline-end:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:38px;height:38px;min-width:38px;padding:0;align-items:center;justify-content:center;border-radius:50%;border:1px solid #e8a1a7;background:#fff4f4;color:#b42328;font-size:28px;font-weight:800;line-height:1;z-index:90;box-shadow:0 2px 8px #55131524;touch-action:manipulation}
#sales.active:has(#cart .sale-row):not(:has(#pos192Drawer.pos192-open)) #pos390ClearCart{display:inline-flex}
body.pos720-sale-calculator-open #sales #pos390ClearCart,body.pos203-sale-haseb-visible #sales #pos390ClearCart{display:none!important}
#sales #pos201CartTop:not(:has(> :not([hidden]):not([style*="display: none"]))){display:none!important}
#sales.r375-ready #r372Tools{gap:clamp(3px,1vw,8px)!important}
@media(max-width:390px){#sales.r375-ready #r372Tools{flex-wrap:wrap!important;gap:4px!important}}
</style>
'''
path.write_bytes(s.encode())
if len(sys.argv)>2:
    gradle=path.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r389-tab1')==1
    gradle.write_text(old.replace('485.7.229-r389-tab1','485.7.229-r390-tab1'))
