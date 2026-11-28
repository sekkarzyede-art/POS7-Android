from pathlib import Path
from hashlib import sha256
import sys

p=Path(sys.argv[1]);raw=p.read_bytes()
assert sha256(raw).hexdigest()=='30492ea21f16aa6e6b9dbab186039377190bca981d4b1418cebc3e08c4ea16b5'
s=raw.decode()
def edit(a,b):
    global s
    assert s.count(a)==1,a[:160]
    s=s.replace(a,b,1)

start=s.index('function allocate(p){const remaining=E.debts')
end=s.index('window.POS7R370Quick=',start)
chunk=s[start:end]
chunk=chunk.replace('function allocate(p){','function allocate(p,date){').replace('if(!inv||take<=0)continue;','if(!inv||take<=0||(date&&!(Date.parse(inv.date)<=Date.parse(date))))continue;')
chunk=chunk.replace('function commit(p){',r'''function voucherDate(day,now=new Date()){
 const today=window.pos178Today();
 if(day===undefined||day===today)return now.toISOString();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>today)throw Error('اختر تاريخ اليوم أو تاريخًا سابقًا');
 const value=new Date(day+'T12:00:00');
 if(!Number.isFinite(+value)||value.getFullYear()!==Number(day.slice(0,4))||value.getMonth()+1!==Number(day.slice(5,7))||value.getDate()!==Number(day.slice(8,10)))throw Error('تاريخ السند غير صالح');
 return value.toISOString();
}
function commit(p,day){''')
chunk=chunk.replace(' const ok=T.run(', ' const date=voucherDate(day),createdAt=new Date().toISOString();\n const ok=T.run(')
chunk=chunk.replace('const date=new Date().toISOString(),part=', 'const part=').replace('al=allocate(p);','al=allocate(p,date);').replace('[key(p.k)]:p.name,date,amount:', '[key(p.k)]:p.name,date,createdAt,amount:')
edit(s[start:end],chunk)
edit("window.POS7R370Quick={quote,commit,allocate};","window.POS7R370Quick={quote,commit,allocate,voucherDate};")
edit("select.value=k==='customer'?'cashier_usd':'main_usd';el(pay,'label','مبلغ الدفعة بعملة الصندوق');","select.value=k==='customer'?'cashier_usd':'main_usd';const dateLabel=el(pay,'label','تاريخ السند');dateLabel.htmlFor='pos402VoucherDate';const day=el(pay,'input');day.id='pos402VoucherDate';day.type='date';day.max=day.value=window.pos178Today();el(pay,'label','مبلغ الدفعة بعملة الصندوق');")
edit('const p=quote(k,name,select.value,input.value,full);if(full)', 'const selectedDay=day.value;voucherDate(selectedDay);const p=quote(k,name,select.value,input.value,full);if(full)')
edit("+p.currency+'\\nالرصيد بعد العملية:", "+p.currency+'\\nتاريخ السند: '+selectedDay+'\\nالرصيد بعد العملية:")
edit('const v=commit(p);if(!v){done=false;return}d.close();', 'const v=commit(p,selectedDay);if(!v){done=false;return}d.close();')
mark=' function run(forCustomer){var p=chosenProduct()'
edit(mark,Path(__file__).with_name('movement.js').read_text()+mark)
edit('var rows=salesRows(p,forCustomer?customer:"");render(p,forCustomer?customer:"",rows)','if(!forCustomer)return renderMovement(p);var rows=salesRows(p,customer);render(p,customer,rows)')
edit('حركة الصنف لجميع الزبائن</button>','حركة الصنف — داخل وخارج</button>')
edit('يعرض إجمالي الكمية المباعة، ثم يفصلها حسب الفاتورة والزبون والتاريخ. اختر الزبون اختيارياً لعرض حركته وحده.','اعرض الشراء والبيع والمرتجعات حسب الفترة، أو اختر زبونًا لعرض مبيعات الصنف له.')
s=s.replace('485.7.229-r400-tab1','485.7.229-r402-tab1').replace("VERSION='R400', MAX=250","VERSION='R402', MAX=250").replace('تشخيص الأداء المتقدم — R400','تشخيص الأداء المتقدم — R402')
p.write_bytes(s.encode())
if len(sys.argv)>2:
    g=p.parents[3]/'build.gradle'
    g.write_text(g.read_text().replace('485.7.229-r400-tab1','485.7.229-r402-tab1'))
