from hashlib import sha256
from pathlib import Path
import sys

path = Path(sys.argv[1])
raw = path.read_bytes()
assert sha256(raw).hexdigest() == 'af9859b1212ca5df93b3de1cd706d73db615e8be3b53f2c7bbf03568241b677f'
html = raw.decode()

def edit(old, new):
    global html
    assert html.count(old) == 1, old
    html = html.replace(old, new, 1)

calc = '<button class="calc-btn" onclick="openPurchaseCalculator()">🧮 حاسب</button>'
edit(calc, '')
start = '<div class="pos394-tools" role="group" aria-label="اختصارات الشراء">'
edit(start, start + calc.replace('class="calc-btn"', 'id="pos395PurchaseCalc" type="button" class="calc-btn"'))
edit('<div><b>أصناف فاتورة الشراء</b><div class="muted" id="purchaseSupplierMini">اختر المورد من حاسب</div></div>', '<b class="pos395-cart-label">أصناف فاتورة الشراء</b>')
original_start = html.index('    <div class="pos189-supplier-bar"')
original_end = html.index('      <div class="pos189-panel-head">', original_start)
old = html[original_start:original_end]
supplier_input = next(line.strip() for line in old.splitlines() if '<input id="pos189SupplierQuickName"' in line)
edit(old, '''    <div class="pos395-supplier-menu">
      <button type="button" id="pos189ShowSupplierList" class="pos189-show-btn" aria-controls="pos189SupplierPanel" aria-expanded="false" onclick="pos189ToggleSupplierPanel()"><span>المورد وأصنافه</span><small id="purchaseSupplierMini"></small><span class="pos395-chevron" aria-hidden="true">▾</span></button>
      <section class="pos189-supplier-panel" id="pos189SupplierPanel" hidden aria-label="المورد والأصناف التي يبيعها">
        <label for="pos189SupplierQuickName">المورد</label>
        '''+supplier_input+'\n')
edit('    </section>\n    <div class="purchase-table-head">', '      </section>\n    </div>\n    <div class="purchase-table-head">')
edit("if(btn){btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'▴ إخفاء الأصناف':'☷ أصناف المورد'}", "if(btn)btn.setAttribute('aria-expanded',String(open));")
edit("if(e&&s)e.textContent=s.value.trim()||'اختر المورد من حاسب'", "if(e&&s)e.textContent=s.value.trim()")
edit("'</b><small>باركود '+esc(p.barcode||'')+' • متوفر '", 
     """'</b><small><span class="pos395-result-barcode">باركود '+esc(p.barcode||'')+'</span> • متوفر '""")
edit("'</b><small>⚠️ مجمّد عن البيع والشراء — لا يمكن اختياره</small>",
     """'</b><small><span class="pos395-result-barcode">باركود '+esc(p.barcode||'')+'</span></small><small>⚠️ مجمّد عن البيع والشراء — لا يمكن اختياره</small>""")
css = '''
<style id="pos395-purchase-compact">
#purchase .pos394-tools{justify-content:flex-start;direction:rtl;gap:clamp(3px,1.4vw,10px)}
#purchase #pos395PurchaseCalc{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;position:static!important;min-width:0;padding-inline:8px;white-space:nowrap;margin:0}
#purchase .sale-invoice-pane>.sale-invoice-toolbar{display:flex!important;flex-flow:row nowrap!important;align-items:center;justify-content:space-between;gap:5px;padding-block:4px!important}
#purchase .pos395-cart-label{min-width:0;line-height:1.2}
#purchase .sale-invoice-toolbar>.sale-toolbar-actions{display:flex!important;flex:0 0 auto!important;width:auto!important;margin:0!important}
#purchase #purchaseToolbarTotal{display:flex!important;align-items:center;flex-flow:row nowrap;gap:4px;width:auto!important;min-width:0!important;padding:4px 6px!important;white-space:nowrap}
#purchase .pos395-supplier-menu{position:relative;flex:0 0 auto;margin-block:4px}
#purchase #pos189ShowSupplierList{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:4px 8px;text-align:start}
#purchase #purchaseSupplierMini{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#purchase .pos395-chevron{font-size:16px}
#purchase #pos189ShowSupplierList[aria-expanded="true"] .pos395-chevron{transform:rotate(180deg)}
#purchase #pos189SupplierPanel{margin:4px 0 0;padding:7px}
#purchase #pos189SupplierQuickName{width:100%;min-width:0;box-sizing:border-box}
#purchase .sale-picker-pane .sale-search-fixed>input#pSearch{height:38px!important;min-height:38px!important;max-height:38px!important;padding:4px 7px!important;font-size:16px!important;line-height:1.1!important}
#purchasePickerResults .product>div:first-child>b{color:#12315a!important}
#purchasePickerResults .pos395-result-barcode{color:#b42328!important}
@media(max-width:380px){
 #purchase .pos394-tools .pos394-round{width:35px;height:35px;min-width:35px;max-width:35px;min-height:35px;flex-basis:35px}
 #purchase .pos394-tools .pos394-round svg{width:20px;height:20px}
 #purchase .sale-invoice-pane>.sale-invoice-toolbar{font-size:12px}
}
</style>
'''
edit('<style id="pos391-privacy-style">', css+'\n<style id="pos391-privacy-style">')
edit("const VERSION='R394', MAX=250;", "const VERSION='R395', MAX=250;")
edit('تشخيص الأداء المتقدم — R394','تشخيص الأداء المتقدم — R395')
html = html.replace('485.7.229-r394-tab1','485.7.229-r395-tab1')
path.write_bytes(html.encode())
if len(sys.argv)>2:
    gradle=path.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r394-tab1')==1
    gradle.write_text(old.replace('485.7.229-r394-tab1','485.7.229-r395-tab1'))
