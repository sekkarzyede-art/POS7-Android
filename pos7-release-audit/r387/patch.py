from pathlib import Path
import hashlib
import re
import sys

p=Path(sys.argv[1])
source=p.read_bytes()
assert hashlib.sha256(source).hexdigest()=='be070522ac4c192411e56527e8f8f5ae6443d945f45fb4bc983a8d858d5cdbcc'
s=source.decode()
root=Path(__file__).resolve().parent

def edit(old,new,count=1):
    global s
    assert s.count(old)==count,(old[:160],s.count(old),count)
    s=s.replace(old,new)

edit('function pos7R354OpenBackup(', (root/'restore.js').read_text()+'\nfunction pos7R354OpenBackup(')
edit('prepared=pos7R385RepairReferences(b,result);', 'prepared=pos7R387Prepare(b,result,bienno.checked);')
edit(" const prepareButton=btn(", """ if(typeof window.Pos7Android?.pos387ExportRestoreSafety==='function')btn('تصدير نسخة الأمان قبل آخر استعادة محلية',()=>{
  if(!window.Pos7Android.pos387ExportRestoreSafety())status.textContent='لم تُفتح نسخة الأمان.';
 });
 const countChoice=add('label','');
 const bienno=document.createElement('input');bienno.type='checkbox';
 countChoice.append(bienno,' توحيد كيندر بيونو ×30 ح والإبقاء على كمية الصنف الأساسي (4 في النسخة المفحوصة) إلى حين الجرد');
 bienno.onchange=()=>{prepared=null;status.textContent='أعد معالجة النسخة بعد تغيير قرار الدمج.';};
 const prepareButton=btn(""")
edit(" if(!inspectOnly)btn('متابعة الاستعادة الآمنة',()=>{", """ if(!inspectOnly)btn('استعادة النسخة المعالجة على تاب 2 محليًا',()=>{
  if(!prepared?.report.readyForLocalRestore)return alert('عالج النسخة وراجع التقرير أولًا. يجب حل تعارضات المعرّفات والقيود قبل الاستعادة.');
  if(prepared.report.barcodeReview.length&&!confirm('تبقى '+prepared.report.barcodeReview.length+' مجموعة باركود للمراجعة. ستبقى الأصناف منفصلة ويُستخدم الباركود الأصلي لكل صنف. هل تتابع؟'))return;
  if(pos7R387CommitLocal(prepared.candidate))dialog.remove();
 });
 if(!inspectOnly)btn('متابعة الاستعادة الآمنة',()=>{""")
edit("if(!Number.isSafeInteger(p.stock))why='fractional_or_invalid_stock'", "if(!Number.isFinite(p.stock))why='invalid_stock'")
edit("!Number.isSafeInteger(p.stock)||p.stock<0||typeof p.id", "!Number.isFinite(p.stock)||p.stock<0||typeof p.id")
edit('Math.floor(nv(value))','nv(value)')
edit('Math.round(num(item.qty)+delta)','num(item.qty)+delta')
edit('Math.floor(num(value))','num(value)')
edit('Math.floor(N(value)):Math.floor(N(row.qty)+N(value))','N(value):N(row.qty)+N(value)')
edit('id="pos7PriceDialogQty" type="number" inputmode="numeric" min="1" step="1"','id="pos7PriceDialogQty" type="number" inputmode="decimal" min="0" step="any"')
edit('!Number.isInteger(qv)||qv<1','!Number.isFinite(qv)||qv<=0')
edit('!Number.isInteger(qty)||qty<=0','!Number.isFinite(qty)||qty<=0')
edit('max="${z._max}" step="1"','max="${z._max}" step="any"')
edit("if(x){x.qty++;saleCart=", "const increment=pos7AllowNegativeStock()?1:Math.min(1,saleAvailable(p));if(x){x.qty+=increment;saleCart=")
edit("cost:p.cost,qty:1});saleCartAutoFollow", "cost:p.cost,qty:increment});saleCartAutoFollow")
edit("x.qty+=d;if(x.qty<=0)", "x.qty+=!pos7AllowNegativeStock()&&d>0?Math.min(d,saleAvailable(p)):d;if(x.qty<=0)")
edit("if(!Number.isSafeInteger(q)||q<0)throw Error('R343_invalid_invoice_quantity')","if(!Number.isFinite(q)||q<0)throw Error('R343_invalid_invoice_quantity')")
edit("if(!Number.isSafeInteger(total))throw Error('R343_invalid_movement_total')","if(!Number.isFinite(total))throw Error('R343_invalid_movement_total')")
edit("if(!Number.isSafeInteger(Number(product.stock)))throw Error('R343_invalid_anchor')","if(!Number.isFinite(product.stock))throw Error('R343_invalid_anchor')")
edit("if(!Number.isSafeInteger(delta)||Number(product.stock)-guard.stock!==delta)", "if(!Number.isFinite(delta)||Math.abs(Number(product.stock)-guard.stock-delta)>Number.EPSILON*8*Math.max(1,Math.abs(product.stock),Math.abs(guard.stock),Math.abs(delta)))")
edit("if(!Number.isSafeInteger(target))throw Error('R343_target_invalid')","if(!Number.isFinite(target))throw Error('R343_target_invalid')")
# Keep cloud protocol integer assertions until its DB contract is verified.
a=s.index('function productFor(i){const all=state.products||[],bc=')
z=s.index('\n',a)
s=s[:a]+"""function productFor(i){const p=pos7R387ProductForLine(i);if(!p)throw Error('هوية صنف الفاتورة تحتاج مراجعة قبل الإلغاء');return p;}"""+s[z:]
a=s.index('function product(line){\n const id=line.productId??line.id;')
z=s.index('\nfunction sameLine',a)
s=s[:a]+"""function product(line){
 const p=pos7R387ProductForLine(line);
 if(!p)throw Error('تعذر تحديد هوية الصنف '+(line.name||line.barcode||''));
 return p;
}"""+s[z:]
old='(state.products||[]).find(x=>String(x.id)===String(i.id))||(state.products||[]).find(x=>String(x.barcode)===String(i.barcode))'
s=s.replace(old,"pos7R387ProductForLine(i)")
edit("window.pos467DeleteProduct=function(id){var p=product(id);if(!p)return;", "window.pos467DeleteProduct=function(id){var p=product(id);if(!p)return;if(pos7R387Refs(state,p).length)return alert('الصنف مرتبط ببيانات محفوظة ولا يمكن حذفه. يمكنك تجميده.');")
edit("window.POS7_BOOT_DIAG_R314.state.products=Array", """if(state.pos7R387LocalRestore){
 localStorage.setItem('POS7_RESTORE_PENDING_R305','yes');
 localStorage.setItem('POS7_RESTORE_LOCAL_ONLY_R323','yes');
}
window.POS7_BOOT_DIAG_R314.state.products=Array""")
# Resolve equivalent scans only when unambiguous. Keep exact aliases distinct in quarantined groups.
edit("var p=barcodeRows.get(normBarcode(value));return p&&", """var key=pos7R353BarcodeKey(value),raw=String(value??'').trim(),matches=normalizedBarcodes.get(key)||[],exact=matches.filter(p=>String(p.barcode)===raw);
 var p=exact.length===1?exact[0]:matches.length===1?matches[0]:null;return p&&""")
edit("function ensureProducts(){var products=", "var normalizedBarcodes=new Map();\nfunction ensureProducts(){var products=")
edit("return;productRows=[];barcodeRows=new Map();", "return;productRows=[];normalizedBarcodes=new Map();barcodeRows=new Map();")
edit("products.forEach(function(p){if(!p)return;var row={p:p,name:", "products.forEach(function(p){if(!p)return;var nk=pos7R353BarcodeKey(p.barcode);if(!normalizedBarcodes.has(nk))normalizedBarcodes.set(nk,[]);normalizedBarcodes.get(nk).push(p);var row={p:p,name:")
edit("async req(path,opts={},retry=true){if(!this.session)", "async req(path,opts={},retry=true){if(state.pos7R387LocalRestore&&!['GET','HEAD'].includes(String(opts.method||'GET').toUpperCase()))throw Error('المزامنة معلقة بسبب الاستعادة المحلية');if(!this.session)")
edit("||localStorage.getItem('POS7_RESTORE_PENDING_R305'))throw Error('انتظر اكتمال الحفظ أو المزامنة ثم أعد المحاولة');", "||(localStorage.getItem('POS7_RESTORE_PENDING_R305')&&!state.pos7R387LocalRestore))throw Error('انتظر اكتمال الحفظ أو المزامنة ثم أعد المحاولة');")
edit("p.id=pos7R354Allocate();line.id=p.id;return pos7R353NewProduct(p);", """if(!POS7IdentityGuardR352.barcodeCheck(state.products,p.barcode).ok)throw Error('الباركود مستخدم مسبقاً أو غير صالح');
 p.id=pos7R354Allocate();line.id=p.id;return pos7R353NewProduct(p);""")
# A failed identity lookup on an existing historical line must abort edit before changing stock or cash.
edit("let err=pos105CanApplyPurchaseEdit(old);", "if((old.items||[]).some(i=>!pos7R387ProductForLine(i)))return toast('هوية صنف في الفاتورة الأصلية تحتاج مراجعة');let err=pos105CanApplyPurchaseEdit(old);")
edit("let er=validatePurchaseStock(old);", "if((old.items||[]).some(i=>!pos7R387ProductForLine(i)))return toast('هوية صنف في الفاتورة الأصلية تحتاج مراجعة');let er=validatePurchaseStock(old);")
edit("String(x.barcode)===k);if(p&&nv(p.stock)+delta[k]", "String(x.barcode)===k)||pos7R387ProductForLine({barcode:k});if(p&&nv(p.stock)+delta[k]",2)
s=s.replace('485.7.229-r386-tab2','485.7.229-r387-tab2').replace("version:'R386',...report()","version:'R387',...report()").replace("const VERSION='R386', MAX=250;","const VERSION='R387', MAX=250;").replace('تشخيص الأداء المتقدم — R386','تشخيص الأداء المتقدم — R387').replace("POS7_R386_RESTORE_REVIEW","POS7_R387_RESTORE_REVIEW").replace("POS7_R386_backup_audit","POS7_R387_backup_audit")
p.write_bytes(s.encode())
if len(sys.argv)>2:
    Path('/tmp/r364-html.sha').write_text(hashlib.sha256(p.read_bytes()).hexdigest())
    gradle=p.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count("versionName '485.7.229-r386-tab2'")==1
    gradle.write_text(old.replace("versionName '485.7.229-r386-tab2'","versionName '485.7.229-r387-tab2'"))
    app=p.parent.parent
    java=app/'java/com/sokkarzeyedeh/pos7/MainActivity.java'
    marker='        @JavascriptInterface public String pos333StorageStats() {'
    raw=java.read_text()
    assert raw.count(marker)==1
    java.write_text(raw.replace(marker,(root/'safety.java.inc').read_text()+marker))
    for name,anchor in [('restore_transfer.js','  async function transfer() {'),('same_device_r324.js','async function align(){')]:
        f=p.parent/name
        raw=f.read_text()
        assert raw.count(anchor)==1
        f.write_text(raw.replace(anchor,anchor+"\n    if (state.pos7R387LocalRestore) throw Error('هذه النسخة معتمدة للتشغيل المحلي على تاب 2.');"))
    f=p.parent/'restore_transfer.js'
    raw=f.read_text()
    anchor="  cloud.rpc = function (name, args) {"
    assert raw.count(anchor)==1
    f.write_text(raw.replace(anchor,anchor+"\n    if (state.pos7R387LocalRestore) return Promise.reject(Error('المزامنة معلقة بسبب الاستعادة المحلية'));"))
