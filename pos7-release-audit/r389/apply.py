from pathlib import Path
import hashlib
import sys

p=Path(sys.argv[1])
root=Path(__file__).parent
raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='ffb5d89c712ddfa44b9d919bb2b7139f640f907b34b9d945d6e2a46f48d31df2'
s=raw.decode()
def edit(old,new,n=1):
    global s
    assert s.count(old)==n,(old[:150],s.count(old),n)
    s=s.replace(old,new)

# Scope indexes and amounts to a single synchronous render. Statements retain chronological replay.
start=s.index('<script id="pos7-v396-customer-statement-date-range">')
end=s.index('</script>',start)
block=s[start:end]
before=block
def balance_edit(a,b):
    global block
    assert block.count(a)==1,(a,block.count(a))
    block=block.replace(a,b)
balance_edit('function openingItems(name){','function openingItems(name,index){')
balance_edit('let entries=(state.openingBalanceEntries||[]).filter','let entries=(index?index.opening:(state.openingBalanceEntries||[])).filter')
balance_edit('function buildRows(name,from,to){','function buildRows(name,from,to,index){')
balance_edit('let entries=openingItems(name),rows=[]','let entries=openingItems(name,index),rows=[]')
for table in ('sales','salesReturns','customerPayments','returnVouchers'):
    op='filter' if table=='returnVouchers' else 'forEach'
    key=' (state.'+table+'||[]).'+op
    balance_edit(key,' (index?index.'+table+':(state.'+table+'||[])).'+op)
balance_edit('return {balance:signed(name)?balance:Math.max(0,balance),rows,entries};','return {balance:isSigned?balance:Math.max(0,balance),rows,entries,isSigned};')
balance_edit('rows.sort((a,b)=>a.ts-b.ts||a.order-b.order);','const isSigned=index?index.salesReturns.some(r=>r.r365&&!r.cancelled&&r.status!==\'cancelled\'&&r.customer===name):signed(name);rows.sort((a,b)=>a.ts-b.ts||a.order-b.order);')
balance_edit("""window.pos398CustomerStatementBalanceUSD=function(name){
 let data=buildRows(name,new Date(0),new Date(8640000000000000));
 return data.rows.reduce((running,row)=>signed(name)?running+N(row.delta):Math.max(0,running+N(row.delta)),N(data.balance));
};""","""let balanceScope=null;
window.pos389WithBalanceIndex=function(fn,receiver,args){
 if(balanceScope)return fn.apply(receiver,args);
 const maps={},cache=new Map();
 for(const [table,alias] of [['openingBalanceEntries','opening'],['sales','sales'],['salesReturns','salesReturns'],['customerPayments','customerPayments'],['returnVouchers','returnVouchers']]){
  const map=new Map();
  for(const row of state[table]||[]){
   if(!row)continue;
   const key=table==='openingBalanceEntries'?String(row.partyName):table==='returnVouchers'?row.customer:String(row.customer||'');
   if(!map.has(key))map.set(key,[]);
   map.get(key).push(row);
  }
  maps[alias]=map;
 }
 balanceScope={maps,cache};
 try{return fn.apply(receiver,args);}finally{balanceScope=null;}
};
window.pos398CustomerStatementBalanceUSD=function(name){
 if(balanceScope?.cache.has(name))return balanceScope.cache.get(name);
 const index=balanceScope?Object.fromEntries(Object.entries(balanceScope.maps).map(([key,map])=>[key,map.get(key==='returnVouchers'?name:String(name))||[]])):null;
 const data=buildRows(name,new Date(0),new Date(8640000000000000),index);
 const value=data.rows.reduce((running,row)=>data.isSigned?running+N(row.delta):Math.max(0,running+N(row.delta)),N(data.balance));
 if(balanceScope)balanceScope.cache.set(name,value);
 return value;
};""")
edit(before,block)
# Existing home batching takes care of invoice commits. Avoid painting the hidden home on ordinary persist.
edit('if(!window.pos307MarkHomeDirty || !window.pos307MarkHomeDirty())renderHome();',
     "if((!window.pos307MarkHomeDirty||!window.pos307MarkHomeDirty())&&document.getElementById('home')?.classList.contains('active'))renderHome();")
# Reduce the number of stock-alert calculations while preserving current contents.
edit("function renderAlerts(){var box=", "function renderAlerts(low=lowItems()){var box=")
edit("var low=lowItems(),exp=expiryItems(),html='';", "var exp=expiryItems(),html='';")
edit("function decorateCart(){var c=settings(),activeKeys=new Set(lowItems().map", "function decorateCart(low){var c=settings(),activeKeys=new Set(low.map")
edit("decorateCart();renderAlerts();return r", "const low=lowItems();decorateCart(low);renderAlerts(low);return r")

edit("window.pos366VoucherCanvas=voucherCanvas;", "window.pos366VoucherCanvas=voucherCanvas;")
edit("pos7SendNativeBluetooth(nativeBytes,String(v.ref||'سند'))","pos7SendNativeBluetooth(nativeBytes,'voucher:'+String(v.ref||'سند'))")
edit('window.pos418ShowVoucher=function(kind,id){var list=', "window.pos389PrintSavedVoucher=function(kind,v){if(v&&!v.cancelled)pos389Print(voucherData(kind,v));};\nwindow.pos418ShowVoucher=function(kind,id){var list=")
edit("if(typeof window.pos418ShowVoucher==='function')window.pos418ShowVoucher(c.kind,v.id);else toast(c.kind==='customer'?'تم تسجيل سند القبض لكن نافذة عرضه غير متاحة':'تم تسجيل سند الصرف لكن نافذة عرضه غير متاحة')", "window.pos389PrintSavedVoucher(c.kind,v)")
edit('if(window.pos310PurchaseActive?.()||window.pos789SyncIsBusy?.()||window.POS7_R212_BATCH_ACTIVE||window.POS7_R166_RELOAD_REQUIRED)', 'if(window.pos310PurchaseActive?.()||window.POS7_R212_BATCH_ACTIVE||window.POS7_R166_RELOAD_REQUIRED)',2)
edit("function save(full){if(done||busy)return;try{const p=quote(", "async function save(full){if(done||busy)return;try{const p=quote(",2)
# The wait completes before commit. The commit re-quotes against the latest durable balance.
s,count=s.replace("done=true;const v=commit(p);","done=true;if(!await pos389WaitPayment(d)){done=false;return;}const v=commit(p);"),s.count("done=true;const v=commit(p);")
assert count==2
edit('window.pos418ShowVoucher(k,v.id);','window.pos389PrintSavedVoucher(k,v);')
edit("window.pos366VoucherAction(v.id,'view');","window.pos389PrintSavedVoucher('return',v);")
edit('async function sync(auto=false,afterCommit=false){','async function sync(auto=false,afterCommit=false){\n if(window.pos389QuickWaiting)return false;')
edit("device:'TAB2',durationSeconds","device:'TAB1',durationSeconds")
edit("const VERSION='R388', MAX=250;","const VERSION='R389', MAX=250;")
edit('تشخيص الأداء المتقدم — R388','تشخيص الأداء المتقدم — R389')
edit("if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,48}$/.test(id)||!/(home|sale|purchase|report|search|cash|stock|settings|nav|sync|perf|cart|save|print|close|back)/i.test(id))id='';","if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,48}$/.test(id))id='';if(!id){const cmd=target?.getAttribute('onclick')?.match(/^\\s*(?:return\\s+)?([A-Za-z_$][\\w$]*)\\s*\\(/);id=cmd?.[1]||'';}")
s+='\n<script id="pos7-r389-voucher-performance">\n'+(root/'helpers.js').read_text()+"""
const pos389Home=window.renderHome;
window.renderHome=renderHome=function(){return window.pos389WithBalanceIndex(pos389Home,this,arguments);};
</script>
"""
s=s.replace('485.7.229-r388-tab1','485.7.229-r389-tab1')
assert 'jdcolkgzwqpwbfvcrdje' in s and 'rmskuolsiqbzxuakofpb' not in s
p.write_bytes(s.encode())
if len(sys.argv)>2:
    g=p.parents[3]/'build.gradle'
    g.write_text(g.read_text().replace('485.7.229-r388-tab1','485.7.229-r389-tab1'))
    java=p.parent.parent/'java/com/sokkarzeyedeh/pos7/MainActivity.java'
    j=java.read_text()
    for old,new in [
        ('Thread.sleep(200);','boolean voucher = jobName != null && jobName.startsWith("voucher:");\n                Thread.sleep(voucher ? 450 : 200);'),
        ('Math.min(4096, bytes.length - offset)','Math.min(voucher ? 256 : 4096, bytes.length - offset)'),
        ('offset += count;\n                }','offset += count;\n                    if (voucher && offset < bytes.length) Thread.sleep(12);\n                }'),
    ]:
        assert j.count(old)==1,(old,j.count(old))
        j=j.replace(old,new)
    java.write_text(j)
