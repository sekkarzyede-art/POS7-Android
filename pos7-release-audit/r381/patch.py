from pathlib import Path
import sys,hashlib
p=Path(sys.argv[1]);s=p.read_text()
assert s.count('485.7.229-r380-tab2')==1
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a));s=s.replace(a,b,1)
rep("function isQuota(e){return !!e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014)}", """function isQuota(e){return !!e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014)}
Object.defineProperty(window,'pos381LegacyMainExists',{value:function(){return originalGet.call(window.localStorage,'POS7_TRIAL188_CLEAN')!==null},writable:false,configurable:false});""")
rep('return oldGet.call(window.localStorage,MAIN)!==null','return window.pos381LegacyMainExists()')
start=s.index('<script id="pos7-v396-customer-statement-date-range">');end=s.index('</script>',start)
a=s[start:end];b=a
b=b.replace('function openingItems(name){','function openingItems(name,idx){').replace('(state.openingBalanceEntries||[]).filter(x=>x&&!x.cancelled', '(idx?idx.opening:(state.openingBalanceEntries||[])).filter(x=>x&&!x.cancelled',1)
b=b.replace('function buildRows(name,from,to){','function buildRows(name,from,to,idx){').replace('let entries=openingItems(name),rows=[]','let entries=openingItems(name,idx),rows=[]',1)
for field,key in [('sales','sales'),('salesReturns','salesReturns'),('customerPayments','customerPayments'),('returnVouchers','returnVouchers')]:
 old='(state.'+field+'||[])';assert old in b;b=b.replace(old,'(idx?idx.'+key+':'+old+')',1)
needle='window.pos398CustomerStatementBalanceUSD=function(name){\n let data=buildRows(name,new Date(0),new Date(8640000000000000));\n return data.rows.reduce((running,row)=>running+N(row.delta),N(data.balance));\n};'
assert needle in b
b=b.replace(needle,'''let r381Scope=null;
function r381Index(){
 const maps={};
 for(const [field,key] of [['openingBalanceEntries','opening'],['sales','sales'],['salesReturns','salesReturns'],['customerPayments','customerPayments'],['returnVouchers','returnVouchers']]){
  const rows=state[field]||[],map=new Map();
  for(const x of rows){if(!x)continue;const n=key==='opening'?String(x.partyName):key==='returnVouchers'?x.customer:String(x.customer||'');let list=map.get(n);if(!list)map.set(n,list=[]);list.push(x)}maps[key]=map;
 }return maps;
}
window.pos398CustomerStatementBalanceUSD=function(name){
 let idx=null;
 if(r381Scope&&r381Scope.state===state){const k=String(name),m=r381Scope.maps;idx={opening:m.opening.get(k)||[],sales:m.sales.get(k)||[],salesReturns:m.salesReturns.get(k)||[],customerPayments:m.customerPayments.get(k)||[],returnVouchers:m.returnVouchers.get(name)||[]};}
 let data=buildRows(name,new Date(0),new Date(8640000000000000),idx);
 return data.rows.reduce((running,row)=>running+N(row.delta),N(data.balance));
};
window.pos381WithBalanceIndex=function(fn,that,args){const previous=r381Scope;try{r381Scope={state:state,maps:r381Index()};return fn.apply(that,args)}finally{r381Scope=previous}};''')
assert a!=b;s=s[:start]+b+s[end:]
rep("return [...names].filter(n=>n&&n!=='زبون نقدي').map(n=>[n,canonical(n)]).filter(x=>x[1]>.000001);","return window.pos381WithBalanceIndex(function(){return [...names].filter(n=>n&&n!=='زبون نقدي').map(n=>[n,canonical(n)]).filter(x=>x[1]>.000001)},null,[]);")
s=s.replace('485.7.229-r380-tab2','485.7.229-r381-tab2');assert 'jdcolkgzwqpwbfvcrdje' not in s
p.write_text(s)
