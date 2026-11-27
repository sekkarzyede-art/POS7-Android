from hashlib import sha256
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
raw = path.read_bytes()
assert sha256(raw).hexdigest() == 'd39168907a5ffbec0caa3f1d49ff011ec1e11de23b655cc8b8054f5d8728a066'
html = raw.decode()

def edit(old, new):
    global html
    assert html.count(old) == 1, old
    html = html.replace(old, new, 1)

def icon(shape):
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + shape + '</svg>'

def control(id, label, shape, action='', extra=''):
    click = f' onclick="{action}"' if action else ''
    return f'<button id="{id}" class="pos394-round" type="button" aria-label="{label}" title="{label}"{click}{extra}>{icon(shape)}</button>'

calc_icon = icon('<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6h8M8 10h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1"/>')
calc_button = '<button id="pos151CalcToggle" type="button" aria-label="فتح الحاسبة" aria-controls="pos151Calc" aria-expanded="false">▦</button>'
edit(calc_button, '')
edit('<button class="mailBtn" onclick="toast(\'لا توجد تنبيهات', calc_button.replace('▦', calc_icon) + '<button class="mailBtn" onclick="toast(\'لا توجد تنبيهات')
start = html.index('function place(){if(window.pos156Place')
end = html.index('\n', start)
edit(html[start:end], '''function place(){
  if(panel.hidden)return;
  const rect=toggle.getBoundingClientRect();
  panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,rect.right-panel.offsetWidth))+'px';
  panel.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-panel.offsetHeight-8))+'px';
}''')
drag_start = html.index("const b=document.getElementById('pos151CalcToggle'),panel=")
drag_end = html.index("['search','pSearch'].forEach", drag_start)
edit(html[drag_start:drag_end], '')
edit("const button=document.createElement('button');button.type='button';button.className='soft';button.style.cssText='width:100%;margin:6px 0;padding:8px';button.textContent='⌨ إخفاء الكيبورد';button.setAttribute('aria-controls',id);const wrap=input.closest('.search')||input;wrap.parentNode.insertBefore(button,wrap);", """const button=id==='pSearch'?document.getElementById('pos394PurchaseKeyboard'):document.createElement('button');if(!button)return;
if(id==='search'){button.type='button';button.className='soft';button.style.cssText='width:100%;margin:6px 0;padding:8px';button.textContent='⌨ إخفاء الكيبورد';button.setAttribute('aria-controls',id);const wrap=input.closest('.search')||input;wrap.parentNode.insertBefore(button,wrap);}""")
edit("button.textContent=enabled?'⌨ إخفاء الكيبورد':'⌨ إظهار الكيبورد';if(document.activeElement&&document.activeElement.blur)", """const label=enabled?'إخفاء الكيبورد':'إظهار الكيبورد';
if(id==='pSearch'){button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(!enabled));}
else button.textContent='⌨ '+label;
if(document.activeElement&&document.activeElement.blur)""")

purchase_start = html.index('<section id="purchase" class="page tablet-sale-page">')
purchase_end = html.index('<div id="purchaseCalculatorModal"', purchase_start)
purchase = html[purchase_start:purchase_end]
toolbar = ''.join([
    control('r369PurchaseInquiry','استعلام الرصيد','<circle cx="10" cy="10" r="5.5"/><path d="m14 14 5 5M10 8v4"/>','pos369Inquiry()'),
    control('pos394PurchaseKeyboard','إخفاء الكيبورد','<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h1m4 0h1m4 0h1M8 14h8"/>',extra=' aria-controls="pSearch" aria-pressed="false"'),
    control('pos297BackPurchaseInvoice','إضافة صنف','<path d="M12 5v14M5 12h14"/>','openPurchaseNewProduct()'),
    control('pos394PurchaseReprint','إعادة طباعة','<path d="M6 8V3h12v5m-12 9H4V8h16v9h-2M6 14h12v7H6zm10-3h1"/>','pos417OpenReprint()'),
    control('pos394PurchaseHome','العودة للرئيسية','<path d="m3 11 9-8 9 8M5 10v10h14V10m-9 10v-6h4v6"/>',"openPage('home')"),
])
updated = re.sub(r'<button class="back".*?</div>\s*<div class="tablet-landscape-note">.*?</div>', '<div class="pos7-sale-heading pos394-purchase-heading"><h2 id="purchaseTitle">فاتورة شراء جديدة</h2><div class="pos394-tools" role="group" aria-label="اختصارات الشراء">'+toolbar+'</div></div>', purchase, count=1, flags=re.S)
assert updated != purchase
updated = re.sub(r'    <div class="picker-title">.*?</div>\n    <label>.*?</label>\n', '', updated, count=1)
updated = re.sub(r'<button id="pos297BackPurchaseInvoice"[^>]*>＋ إضافة صنف</button>', '', updated)
updated = re.sub(r'<button type="button" aria-label="تركيز البحث".*?</button>', '', updated, count=1)
updated = updated.replace('id="pSearch" placeholder=', 'id="pSearch" aria-label="ابحث بالباركود أو اسم الصنف" placeholder=')
updated = updated.replace('<button class="danger" onclick="clearPurchaseCart()">مسح الجميع</button>', '')
updated = re.sub(r'    <div class="picker-help">.*?</div>\n', '', updated, count=1)
purchase_cart = '<div id="purchaseCart" class="cart sale-table sale-table-main purchase-table-main"></div>'
assert purchase_cart in updated
updated = updated.replace(purchase_cart, '<div class="pos394-cart-area">'+purchase_cart+'<button id="pos394ClearPurchase" class="pos394-clear" type="button" onclick="clearPurchaseCart()" aria-label="مسح جميع أصناف سلة الشراء" title="مسح جميع أصناف سلة الشراء">×</button></div>')
edit(purchase, updated)
legacy_heading = html.index(' // Reuse the sales title row structure')
edit(html[legacy_heading:html.index(' function n(v)',legacy_heading)], '')
sale_clear = re.search(r'<button id="pos390ClearCart"[^>]*>×</button>', html)[0]
edit(sale_clear, '')
sale_cart = '<div id="cart" class="cart sale-table sale-table-main"></div>'
edit(sale_cart, '<div class="pos394-cart-area">'+sale_cart+sale_clear.replace('type="button"', 'class="pos394-clear" type="button"')+'</div>')
for line in re.findall(r'(?m)^#sales(?: #pos390ClearCart\{|\.active:has\(#cart \.sale-row\).*#pos390ClearCart\{).*\n',html):
    edit(line, '')
css = '''
<style id="pos394-cart-controls">
header.top #pos151CalcToggle{position:relative;inset:auto;display:grid;place-items:center;flex:0 0 36px;cursor:pointer;z-index:auto}
#pos151CalcToggle svg{width:23px;height:23px}
#purchase .pos394-purchase-heading{display:flex;flex-direction:column;gap:3px;padding-block:3px;margin-block:0 4px}
#purchase .pos394-tools{display:flex;flex-wrap:nowrap;justify-content:center;align-items:center;gap:clamp(4px,2vw,12px);width:100%}
#purchase .pos394-tools .pos394-round{display:inline-grid!important;place-items:center;flex:0 0 42px;width:42px;height:42px;min-width:42px;max-width:42px;min-height:42px;border-radius:50%;padding:0;margin:0;color:#102f57;background:#fff;border:1px solid #e5edf5;box-shadow:0 3px 7px #13355229;touch-action:manipulation}
#purchase .pos394-tools .pos394-round svg{width:23px;height:23px;pointer-events:none}
#purchase .pos394-tools .pos394-round[aria-pressed="true"]{background:#e8f3ff;border-color:#0878eb}
#purchase .sale-picker-pane .sale-search-fixed{margin-block-start:0!important}
#purchase #pSearch{width:100%;min-width:0}
#sales .pos394-cart-area,#purchase .pos394-cart-area{display:flex;flex-direction:column;position:relative;flex:1 1 auto;min-height:0}
#sales .pos394-cart-area>#cart,#purchase .pos394-cart-area>#purchaseCart{flex:1 1 auto;min-height:0}
#sales .pos394-cart-area:has(#cart .sale-row)>#cart,#purchase .pos394-cart-area:has(#purchaseCart .purchase-row)>#purchaseCart{padding-bottom:46px!important;scroll-padding-bottom:46px!important}
#sales .pos394-cart-area>.pos394-clear,#purchase .pos394-cart-area>.pos394-clear{display:none;position:absolute;left:4px;right:auto;bottom:4px;width:38px;height:38px;min-width:38px;padding:0;align-items:center;justify-content:center;border-radius:50%;border:1px solid #e8a1a7;background:#fff4f4;color:#b42328;font-size:28px;font-weight:800;line-height:1;z-index:3;box-shadow:0 2px 8px #55131524;touch-action:manipulation}
#sales.active:has(#cart .sale-row):not(:has(#pos192Drawer.pos192-open)) #pos390ClearCart,
#purchase.active:has(#purchaseCart .purchase-row):not(:has(#purchaseCalculatorModal.show)) #pos394ClearPurchase{display:inline-flex}
body.pos720-purchase-calculator-open #pos394ClearPurchase{display:none!important}
</style>
'''
# Keep positioning and visibility together at the end of the stylesheet cascade.
edit('<style id="pos391-privacy-style">', css+'\n<style id="pos391-privacy-style">')
edit("const VERSION='R393', MAX=250;", "const VERSION='R394', MAX=250;")
edit('تشخيص الأداء المتقدم — R393','تشخيص الأداء المتقدم — R394')
html = html.replace('485.7.229-r393-tab1','485.7.229-r394-tab1')
path.write_bytes(html.encode())
if len(sys.argv)>2:
    gradle=path.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r393-tab1')==1
    gradle.write_text(old.replace('485.7.229-r393-tab1','485.7.229-r394-tab1'))
