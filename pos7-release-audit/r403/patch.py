from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
def put(a,b):
 global s
 assert s.count(a)==1,a[:100]
 s=s.replace(a,b,1)
i=s.index('function voucherDate(');j=s.index('function commit(p,day)',i)
helper='''function pos403Today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
'''+s[i:j].replace('window.pos178Today()', 'pos403Today()')+'''function pos403PaymentDate(id){
 try{return voucherDate(document.getElementById(id)?.value);}
 catch(e){toast(e.message);return null;}
}
'''
s=s[:i]+s[j:]
s=s.replace('<head>','<head><script>\n'+helper+'</script>',1)
for kind, rows, dateid in [('customer','pos163PayRows','pos403CustomerDate'),('supplier','pos168SupplierPayRows','pos403SupplierDate')]:
 tag='<div id="'+rows+'"></div>'
 put(tag,'<label for="'+dateid+'">تاريخ السند</label><input type="date" id="'+dateid+'" value="\'+pos403Today()+\'" max="\'+pos403Today()+\'" required>'+tag)
if True:
 i=s.index('  function commit(ps){\n    if(!selectedCustomer)')
 j=s.index('  window.cancelCustomerReceipt=',i)
 h=s[i:j].replace('function commit(ps){','function commit(ps,date){').replace("let date=new Date().toISOString(),ref=", "let ref=")
 h=h.replace("showConfirm('تأكيد", "const date=pos403PaymentDate('pos403CustomerDate');if(!date)return;showConfirm('تأكيد").replace('()=>commit(ps)','()=>commit(ps,date)')
 s=s[:i]+h+s[j:]
 i=s.index('  function commit(ps){let balance=balanceUSD()')
 j=s.index('  window.cancelSupplierPayment=',i)
 h=s[i:j].replace('function commit(ps){','function commit(ps,date){').replace("let date=new Date().toISOString(),ref=", "let ref=")
 h=h.replace('if(!confirm(confirmText','const date=pos403PaymentDate(\'pos403SupplierDate\');if(!date)return;if(!confirm(confirmText').replace('commit(ps)}','commit(ps,date)}')
 s=s[:i]+h+s[j:]
put('card.previousElementSibling!==sections)sections.parentNode.insertBefore(card,sections.nextSibling)','card.nextElementSibling!==sections)sections.parentNode.insertBefore(card,sections)')
put('📦 حركة المنتج ضمن الفترة</h4>','📦 الأصناف — حركة الصنف ضمن الفترة</h4>')
put('<div><b>الأصناف</b><button','<div><b>الأصناف</b><button type="button" onclick="document.getElementById(&quot;pos742ProductMovementCard&quot;)?.scrollIntoView({block:&quot;start&quot;});document.getElementById(&quot;pos742Product&quot;)?.focus({preventScroll:true})">حركة الصنف — داخل وخارج</button><button')
s=s.replace('485.7.229-r402-tab1','485.7.229-r403-tab1').replace("VERSION='R402', MAX=250","VERSION='R403', MAX=250").replace('تشخيص الأداء المتقدم — R402','تشخيص الأداء المتقدم — R403')
p.write_text(s)
if len(sys.argv)>2:
 g=p.parents[3]/'build.gradle';v=g.read_text();assert v.count('485.7.229-r402-tab1')==1
 g.write_text(v.replace('485.7.229-r402-tab1','485.7.229-r403-tab1'))
