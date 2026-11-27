from pathlib import Path
import hashlib
import json
import sys

p=Path(sys.argv[1])
root=Path(__file__).resolve().parent
raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='0b23aaa8d98cc66eb3091f57ac6910d6a9ad5584eb145f2a6aa4c3aa8398e346'
s=raw.decode()
def edit(a,b,count=1):
    global s
    assert s.count(a)==count,(a[:150],s.count(a),count)
    s=s.replace(a,b)

for old,new in json.loads((root/'performance.json').read_text()):
    edit(old,new)

edit("function isQuota(e){return !!e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014)}", """function isQuota(e){return !!e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014)}
Object.defineProperty(window,'pos381LegacyMainExists',{value:function(){return originalGet.call(window.localStorage,'POS7_TRIAL188_CLEAN')!==null}});""")
edit('return oldGet.call(window.localStorage,MAIN)!==null','return window.pos381LegacyMainExists()')
edit("if(e)e.textContent=x[1]+'$'+x[2].toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})","if(e){const value=x[1]+'$'+x[2].toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});if(e.textContent!==value)e.textContent=value}")
edit('Math.floor(nv(value))','nv(value)')
edit('Math.round(num(item.qty)+delta)','num(item.qty)+delta')
edit('Math.floor(num(value))','num(value)')
edit('Math.floor(N(value)):Math.floor(N(row.qty)+N(value))','N(value):N(row.qty)+N(value)')
edit('id="pos7PriceDialogQty" type="number" inputmode="numeric" min="1" step="1"','id="pos7PriceDialogQty" type="number" inputmode="decimal" min="0" step="any"')
edit('!Number.isInteger(qv)||qv<1','!Number.isFinite(qv)||qv<=0')
edit('!Number.isInteger(qty)||qty<=0','!Number.isFinite(qty)||qty<=0')
edit('max="${z._max}" step="1"','max="${z._max}" step="any"')
edit('if(q<=0){saleCart=',"if(!Number.isFinite(q))return toast('أدخل كمية صالحة');if(q<=0){saleCart=")
edit('if(x){x.qty++;saleCart=',"const increment=pos7AllowNegativeStock()?1:Math.min(1,saleAvailable(p));if(x){x.qty+=increment;saleCart=")
edit('cost:p.cost,qty:1});saleCartAutoFollow','cost:p.cost,qty:increment});saleCartAutoFollow')
edit("x.qty+=d;if(x.qty<=0)", "x.qty+=!pos7AllowNegativeStock()&&d>0?Math.min(d,saleAvailable(p)):d;if(x.qty<=0)")
edit("!name||qty<=0||cost<0", "!name||!Number.isFinite(qty)||qty<=0||cost<0")
edit("!name||stock<0", "!name||!Number.isFinite(stock)||stock<0")
# Existing barcode conflicts can be edited under their original barcode. Block new collisions.
edit("if(state.products.some(p=>String(p.barcode)===String(barcode)&&p.id!==editingProductId))", """const previous=state.products.find(p=>p.id===editingProductId);
if((!previous||previous.barcode!==barcode)&&state.products.some(p=>pos7R388Barcode(p.barcode)===pos7R388Barcode(barcode)&&p!==previous))""")
edit("let existing=null;if(barcode)existing=state.products.find(p=>normalizeBarcode(p.barcode)===normalizeBarcode(barcode));",
"""let existing=null;if(barcode){
 const equiv=state.products.filter(p=>pos7R388Barcode(p.barcode)===pos7R388Barcode(barcode));
 const exact=equiv.filter(p=>String(p.barcode)===barcode);
 if(exact.length>1||(!exact.length&&equiv.length>1))return toast('الباركود مرتبط بأكثر من صنف، اختر الصنف باسمه');
 existing=exact[0]||equiv[0]||null;
}""")
edit("code=normalizeBarcode(code);return state.products.some(p=>normalizeBarcode(p.barcode)===code&&p.id!==excludeId)||purchaseCart?.some?.(x=>normalizeBarcode(x.barcode)===code)", "code=pos7R388Barcode(code);return state.products.some(p=>pos7R388Barcode(p.barcode)===code&&p.id!==excludeId)||purchaseCart?.some?.(x=>pos7R388Barcode(x.barcode)===code)")
edit("let byBarcode=new Map(nextProducts.map(p=>[normalizeBarcode(p.barcode||''),p]).filter(x=>x[0]));", """let byBarcode=new Map(),ambiguous=new Set();
  for(const p of nextProducts){const key=pos7R388Barcode(p.barcode);if(!key)continue;if(byBarcode.has(key))ambiguous.add(key);else byBarcode.set(key,p);}""")
edit("let nb=normalizeBarcode(barcode),p=byBarcode.get(nb);", "let nb=pos7R388Barcode(barcode),p=byBarcode.get(nb);if(ambiguous.has(nb)){rejected++;continue;}")
edit("window.pos467DeleteProduct=function(id){var p=product(id);if(!p)return;", "window.pos467DeleteProduct=function(id){var p=product(id);if(!p)return;if(pos7R388HasReferences(state,p))return alert('الصنف مرتبط بسجلات محفوظة. يمكنك تجميده.');")
edit('function normalizeBarcode(v)',"""function pos7R388Barcode(v){const s=normalizeBarcode(v);return /^\\d+$/.test(s)?s.replace(/^0+(?=\\d)/,''):s;}
function normalizeBarcode(v)""")
edit('<div style="margin-top:14px"><b>النسخ المحفوظة تلقائياً على هذا الجهاز</b>',"""<div style="margin-top:14px">
 <label class="soft">فحص نسخة احتياطية <input type="file" accept=".json,application/json" onchange="pos7R388ReadBackup(this)"></label>
 <textarea id="pos7R388BackupResult" readonly hidden dir="ltr" rows="8"></textarea>
 <button class="soft" type="button" onclick="pos7R388BackupAction('copy')">نسخ تقرير الفحص</button>
 <button class="soft" type="button" onclick="pos7R388BackupAction('save')">حفظ تقرير الفحص</button>
</div><div style="margin-top:14px"><b>النسخ المحفوظة تلقائياً على هذا الجهاز</b>""")
s+='\n<script id="pos7-r388-backup-audit">\n'+(root/'audit.js').read_text()+'</script>\n'
s+='\n<script id="pos7-r388-perf-diagnostics">\n'+(root/'diagnostics.js').read_text().replace('R380','R388')+'</script>\n'
s+='\n<style id="pos7-r388-paint">html,#sales #cart,#purchase #purchaseCart{scroll-behavior:auto!important}#home.home-page:before,#home.home-page:after,#home .home-tile,#home .home-icon{animation:none!important}</style>\n'
s=s.replace('485.7.229-r376-tab1','485.7.229-r388-tab1')
assert 'jdcolkgzwqpwbfvcrdje' in s and 'rmskuolsiqbzxuakofpb' not in s
assert 'POS7_RESTORE_PENDING_R305' not in s
p.write_bytes(s.encode())
if len(sys.argv)>2:
    gradle=p.parents[3]/'build.gradle'
    g=gradle.read_text()
    assert g.count('485.7.229-r376-tab1')==1
    gradle.write_text(g.replace('485.7.229-r376-tab1','485.7.229-r388-tab1'))
