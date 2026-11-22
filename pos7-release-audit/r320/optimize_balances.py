"""R320: skip repeated durable state compression when cached USD balances do not change.

Run after R319 patch. Fail closed on any source mismatch. Does not modify any
accounting formula or the normal state/receipt/restore/sync code paths.
"""
from pathlib import Path
root=Path('r305-android/tab2/POS7_Tablet')
hfile=root/'app/src/main/assets/index.html'
gfile=root/'app/build.gradle'
h=hfile.read_text(encoding='utf-8')
tag='<script id="pos7-v265-canonical-balances-usd">'
assert h.count(tag)==1,'R320 safety: missing canonical USD balance script'
a=h.index(tag);b=h.index('</script>',a)
segment=h[a:b]
old=" function sync(){cNames().forEach(function(n){if(typeof state.customers[n]!=='object')state.customers[n]=cBal(n)});sNames().forEach(function(n){if(typeof state.suppliers[n]!=='object')state.suppliers[n]=sBal(n)});try{persist()}catch(e){}}"
new=""" function sync(){
  var changed=false;
  cNames().forEach(function(n){
   if(typeof state.customers[n]!=='object'){
    var computed=cBal(n);
    if(state.customers[n]!==computed){state.customers[n]=computed;changed=true}
   }
  });
  sNames().forEach(function(n){
   if(typeof state.suppliers[n]!=='object'){
    var computed=sBal(n);
    if(state.suppliers[n]!==computed){state.suppliers[n]=computed;changed=true}
   }
  });
  if(changed)try{persist()}catch(e){}
 }"""
assert segment.count(old)==1,'R320 safety: legacy cached-balances sync not unique'
segment=segment.replace(old,new,1)
assert segment.count('if(changed)try{persist()}catch(e){}')==1
h=h[:a]+segment+h[b:]
oldversion='485.7.229-r319-tab2';newversion='485.7.229-r320-tab2'
assert h.count('المتجر الثاني — قاعدة مستقلة • '+oldversion)==1
h=h.replace('المتجر الثاني — قاعدة مستقلة • '+oldversion,
            'المتجر الثاني — قاعدة مستقلة • '+newversion,1)
g=gfile.read_text(encoding='utf-8')
assert g.count("versionName '"+oldversion+"'")==1
g=g.replace("versionName '"+oldversion+"'","versionName '"+newversion+"'",1)
assert 'window.pos310Installed=true' in h
assert 'POS7_RESTORE_PENDING_R305' in h
assert 'window.pos311SaleActive' not in h
hfile.write_text(h,encoding='utf-8');gfile.write_text(g,encoding='utf-8')
print('R320: cached USD balances only persisted when values actually change')
