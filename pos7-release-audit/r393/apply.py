from hashlib import sha256
from pathlib import Path
import sys

path = Path(sys.argv[1])
raw = path.read_bytes()
assert sha256(raw).hexdigest() == '28c64594561c2a847c643f2b68a5baba275d4b22dddfa1860674c3c95366084c'
source = raw.decode()

def edit(old, new):
    global source
    assert source.count(old) == 1, old
    source = source.replace(old, new, 1)

edit('   if(bridge.pos322WriteState(next)!==true)', '''   // The cache contains the last successful native write or startup read.
   if(next===cache)return;
   if(bridge.pos322WriteState(next)!==true)''')
edit('proto.getItem=function(key){var value=originalGet.call(this,key);return isLocal(this)?unpack(value):value};', '''// Always read the authoritative raw value. Reuse only an exact compressed match.
var lastCompressed=null,lastUnpacked=null;
proto.getItem=function(key){
  var value=originalGet.call(this,key);
  if(!isLocal(this)||!value||value.indexOf(PREFIX)!==0)return value;
  if(value===lastCompressed)return lastUnpacked;
  var decoded=unpack(value);
  if(decoded!==value && value.length<=2*1024*1024 && decoded.length<=8*1024*1024){
    lastCompressed=value;
    lastUnpacked=decoded;
  }
  return decoded;
};''')
edit("function paint(){const page=el('sales');", "let paintedBasketRoot=null,paintedBasketSignature=null;\nfunction paint(){const page=el('sales');")
edit("const root=el('pos173Baskets');if(!root)return;root.replaceChildren();", """const root=el('pos173Baskets');if(!root)return;
const signature=JSON.stringify([active,slots.map(s=>[s?.fields?.customer||'',s?.items?.length||0])]);
if(root===paintedBasketRoot&&root.childElementCount===3&&signature===paintedBasketSignature)return;
paintedBasketRoot=root;paintedBasketSignature=signature;
root.replaceChildren();""")
edit("const pos391SafeReports=new Set(['store-invoices'", "const pos391SafeReports=new Set(['sale-daily','purchase-daily','store-invoices'")
for kind, label in [('sale', 'المبيعات'), ('purchase', 'المشتريات')]:
    button = f'<button onclick="pos712Run(\'{kind}-all\')">جميع الفواتير</button>'
    edit(button, button + f'<button onclick="pos712Run(\'{kind}-daily\')">مجموع {label} اليومية</button>')
edit("function titleFor(type){var m={'store-items'", "function titleFor(type){var m={'sale-daily':'مجموع المبيعات اليومية','purchase-daily':'مجموع المشتريات اليومية','store-items'")
edit(' function invoiceSelectorReport(){var x=custom.type;', ''' function dailyInvoiceReport(type){
  var days=new Map(), totalCents=0;
  activeRows(type==='sale-daily'?'sales':'purchases').forEach(function(doc){
   if(!doc||cancelled(doc)||/^(canceled|voided|deleted|reversed)$/i.test(doc.status||''))return;
   var d=new Date(doc.date);
   if(!doc.date||!Number.isFinite(d.getTime()))return;
   var key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
   var cents=Math.round((doc.totalUSD!=null?n(doc.totalUSD):usd(doc,doc.total||0))*100);
   var day=days.get(key)||{cents:0,count:0};
   day.cents+=cents;
   day.count++;
   days.set(key,day);
   totalCents+=cents;
  });
  var rows=Array.from(days.keys()).sort().map(function(key){
   var day=days.get(key);
   return '<tr><td dir="ltr">'+esc(key)+'</td><td>'+day.count+'</td><td>'+money(day.cents/100)+'</td></tr>';
  }).join('');
  return summaryCard([['إجمالي الفترة',money(totalCents/100)]])+table(['اليوم','عدد الفواتير','المجموع بالدولار'],rows);
 }
 function invoiceSelectorReport(){var x=custom.type;if(x==='sale-daily'||x==='purchase-daily')return dailyInvoiceReport(x);''')
edit("const VERSION='R392', MAX=250;", "const VERSION='R393', MAX=250;")
edit("const names=['pos286InitCashReport'", "const names=['saveSale','pos7R102SaveStateDirect','pos7R100PrepareStockRevisions','pos286InitCashReport'")
edit('تشخيص الأداء المتقدم — R392','تشخيص الأداء المتقدم — R393')
source = source.replace('485.7.229-r392-tab1','485.7.229-r393-tab1')
path.write_bytes(source.encode())
if len(sys.argv)>2:
    gradle=path.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r392-tab1')==1
    gradle.write_text(old.replace('485.7.229-r392-tab1','485.7.229-r393-tab1'))
