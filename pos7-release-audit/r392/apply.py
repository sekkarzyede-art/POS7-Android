from pathlib import Path
import hashlib
import sys

p=Path(sys.argv[1])
raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='7c5c304182d1e96f9044324e111465d7f20f66b33a71a8f1772466d37bb22bd0'
s=raw.decode()
def edit(a,b):
    global s
    assert s.count(a)==1,(a,s.count(a))
    s=s.replace(a,b)

edit(""" if(!pos391Private){
  const pin=prompt('أدخل كلمة السر لتشغيل وضع الخصوصية');
  if(pin===null)return;
  if(pin!=='1212'){toast('كلمة السر غير صحيحة');return;}
 }
 pos391Private=!pos391Private;""",""" const pin=prompt(pos391Private?'أدخل كلمة السر لإطفاء وضع الخصوصية':'أدخل كلمة السر لتشغيل وضع الخصوصية');
 if(pin===null)return;
 if(pin!=='1212'){toast('كلمة السر غير صحيحة');return;}
 pos391Private=!pos391Private;""")
edit('.pos391-private #home .home-tile > :not(.home-icon),','.pos391-private #home .home-tile > .home-mini,')
edit('function dateLabel(v){var d=D(v);return d?d.toLocaleString("ar-LB"):"تاريخ غير مسجل"}','''const cashDateFormatter=new Intl.DateTimeFormat("ar-LB",{year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"});
function dateLabel(v){var d=D(v);return d?cashDateFormatter.format(d):"تاريخ غير مسجل"}''')
edit('var v=oldHome.apply(this,arguments),d=new Date(),valid=', 'var v=oldHome.apply(this,arguments);if(pos391Private)return v;var d=new Date(),valid=')
edit('var result=oldHome.apply(this,arguments);var d=new Date(),today=', 'var result=oldHome.apply(this,arguments);if(pos391Private)return result;var d=new Date(),today=')
edit("const VERSION='R391', MAX=250;","const VERSION='R392', MAX=250;")
edit('تشخيص الأداء المتقدم — R391','تشخيص الأداء المتقدم — R392')
s=s.replace('485.7.229-r391-tab1','485.7.229-r392-tab1')
p.write_bytes(s.encode())
if len(sys.argv)>2:
    gradle=p.parents[3]/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r391-tab1')==1
    gradle.write_text(old.replace('485.7.229-r391-tab1','485.7.229-r392-tab1'))
