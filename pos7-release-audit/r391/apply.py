from pathlib import Path
import hashlib
import re
import sys

p=Path(sys.argv[1])
raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='f025375213acfd18ca31b4ee9e57187cb1807de9a7df362f7fd2abbb6523da7d'
s=raw.decode()
def edit(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:120],s.count(a),n)
    s=s.replace(a,b)

edit('function openPage(id){const target=', 'function openPage(id){if(pos391Private&&pos391BlockedPages.has(id))return pos391Blocked();const target=')
for entry in ("openPage('cashbox')","pos390OpenCashReport()","openPage('chartAccounts');pos7RenderChartAccounts()","openPage('backupPage')","openPage('ownerWalletPage');pos746Render()","openPage('ownerWalletPage');pos746SetPeriod('month')","pos206OpenUsers()","pos408OpenSettings()","openPage('customerViability')"):
    pattern=r'(<(?:div|button) [^<>]*class="home-tile[^"]*")([^<>]*onclick="'+re.escape(entry)+r'"[^<>]*>)'
    s,n=re.subn(pattern,r'\1 data-pos391-disabled\2',s)
    assert n==1,(entry,n)

edit("bar.append(label);head.append(bar);", """const privacy=document.createElement('button');
privacy.id='pos391PrivacyToggle';privacy.className='r372-tool';privacy.type='button';privacy.title='وضع الخصوصية';privacy.setAttribute('aria-label','وضع الخصوصية');
privacy.addEventListener('click',()=>{clear();pos391TogglePrivacy();});
bar.append(privacy,label);head.append(bar);pos391ApplyPrivacy();""")
edit("window.pos390OpenCashReport=function(){","window.pos390OpenCashReport=function(){\n if(pos391Private)return pos391Blocked();")
edit("window.pos408OpenSettings=function(){fill();","window.pos408OpenSettings=function(){if(pos391Private)return pos391Blocked();fill();")
edit("window.pos712Run=function(type){custom=", "window.pos712Run=function(type){if(!pos391AllowsReport(type))return pos391Blocked();custom=")
edit("function render(){var box=document.getElementById('reportsHub');if(!box||!custom)return;", "function render(){var box=document.getElementById('reportsHub');if(!box||!custom)return;if(!pos391AllowsReport(custom.type)){box.replaceChildren();return;}")
edit("if(custom){render();return}if(typeof baseRender", "if(custom){render();return}if(pos391Private)return;if(typeof baseRender")
edit('window.pos713CompareRender=function(type){init();',"window.pos713CompareRender=function(type){if(!pos391AllowsReport(type))return '';init();")
edit("function pos100PrintCurrentReport(){","function pos100PrintCurrentReport(){if(pos391Private)return pos391Blocked();")
anchor="if(!raw)return toast('اكتب أو قل سؤالك أولاً');"
edit(anchor,anchor+"if(pos391Private&&/(ربح|ارباح|أرباح|ال,?كلفة|صندوق|هامش|profit|margin)/i.test(raw))return pos391Blocked();")
edit("function profit(name){\n var host=", "function profit(name){\n if(pos391Private)return;\n var host=")
edit("window.renderQueries=function(){if(queryType==='cashbox')", "window.renderQueries=function(){if(pos391Private&&['movement','cashbox','profitCustomer','profitProduct'].includes(queryType)){document.getElementById('queryList')?.replaceChildren();return;}if(queryType==='cashbox')")
edit("if(pos391Private&&/(ربح|ارباح|أرباح|ال,?كلفة|صندوق|هامش|profit|margin)/i.test(raw))", "if(pos391Private&&/(ربح|ارباح|أرباح|كلفة|تكلفة|صندوق|هامش|profit|margin)/i.test(raw))")
edit("finally{bypass=false}try{window.pos789AutomaticSync?.(false)}catch(e){}});", "finally{bypass=false}requestAnimationFrame(()=>setTimeout(()=>{try{window.pos789AutomaticSync?.(false)}catch(e){}},0));});")
edit("let profit=kind==='sales'?`<div class=\"line\"><span><b>الربح</b>", "let profit=kind==='sales'&&!pos391Private?`<div class=\"line\"><span><b>الربح</b>")
edit("+accLine('هامش الربح',margin.toFixed(2).replace(/\\.00$/,'')+'%')", "+(pos391Private?'':accLine('هامش الربح',margin.toFixed(2).replace(/\\.00$/,'')+'%'))")
edit("if(q.includes('صندوق')||q.includes('نقد')||q.includes('كاش')||q.includes('حركه')){let rows=ledger", "if(q.includes('صندوق')||q.includes('نقد')||q.includes('كاش')||q.includes('حركه')){if(pos391Private)return pos391Blocked();let rows=ledger")
# Attach the privacy state before the app constructs its pages.
at=s.index('<script')
s=s[:at]+'<script id="pos391-privacy">\n'+(Path(__file__).parent/'privacy.js').read_text()+'</script>\n'+s[at:]

# Build the closed historical disclosure only when requested, and hydrate it before export.
first=s.index('  var priorDetails=d.priorRows.map')
last=s.index('  d.period.forEach',first)
details=s[first:last]
line_start=s.index("    '<details style=\"margin:8px 0\"><summary>فحص سجل ما قبل الفترة")
line_end=s.index('\n',line_start)
old_line=s[line_start:line_end]
prefix,html=old_line.split('</summary>',1)
html=html.removesuffix("</details>'+")
assert not html.endswith('+')
s=s[:line_start]+prefix+"</summary><div id=\"pos391CashPriorBody\"></div></details>'+ "+s[line_end:]
s=s[:first]+s[last:]
needle="'</tbody><tfoot><tr><th colspan=\"5\">نهاية الفترة</th><th>'+fmt(d.inAmt,d.currency)+'</th><th>'+fmt(d.outAmt,d.currency)+'</th><th>'+fmt(d.end,d.currency)+'</th></tr></tfoot></table></div></div>';"
edit(needle,needle+'''
  const prior=box.querySelector('#pos391CashPriorBody');
  if(prior){
   const disclosure=prior.closest('details');
   let ready=false;
   fillCashHistory=function(){
    if(ready)return;
    let priorBalance=0,priorIn=0,priorOut=0,groups={};
'''+details+"""    prior.innerHTML='"""+html+"""';
    ready=true;
   };
   disclosure.addEventListener('toggle',()=>{if(disclosure.open)fillCashHistory();});
  }
""")
edit('window.pos286RenderCashReport=function(){','let fillCashHistory=()=>{};\nwindow.pos286RenderCashReport=function(){\n  if(pos391Private)return pos391Blocked();\n  fillCashHistory=()=>{};')
edit('window.pos286PrintCashReport=function(){','window.pos286PrintCashReport=function(){\n  if(pos391Private)return pos391Blocked();')
edit('if(!w){toast("تعذر فتح نافذة الطباعة");return}\n  w.document.open();','if(!w){toast("تعذر فتح نافذة الطباعة");return}\n  fillCashHistory();\n  w.document.open();')
edit('window.pos286ShareCashReport=async function(){','window.pos286ShareCashReport=async function(){\n  if(pos391Private)return pos391Blocked();\n  fillCashHistory();')
edit('function fmt(v,c){return c==="LBP"?Math.round(N(v)).toLocaleString("en-US")+" ل.ل":"$"+N(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}','''const wholeCashFormat=new Intl.NumberFormat("en-US");
const usdCashFormat=new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function fmt(v,c){return c==="LBP"?wholeCashFormat.format(Math.round(N(v)))+" ل.ل":"$"+usdCashFormat.format(N(v));}''')

edit("const VERSION='R390', MAX=250;","const VERSION='R391', MAX=250;")
edit('تشخيص الأداء المتقدم — R390','تشخيص الأداء المتقدم — R391')
edit("const names=['openPage','renderHome'", "const names=['pos286InitCashReport','pos286RenderCashReport','savePurchase','pos7ClearPurchaseDraft','pos789AutomaticSync','openPage','renderHome'")
s=s.replace('485.7.229-r390-tab1','485.7.229-r391-tab1')
s+='''
<style id="pos391-privacy-style">
.pos391-private #home .home-tile > :not(.home-icon),
.pos391-private .pos712-profit,.pos391-private #pos485NetProfitSummary,
.pos391-private .pos713-compare-groups > div:has(button[onclick*="pos713RunMargin"]),
.pos391-private button[onclick*="profit"],.pos391-private button[onclick*="cmp-product-slow"],.pos391-private button[onclick*="cmp-product-active"],.pos391-private button[onclick*="cmp-customer-sales"],
.pos391-private #pos170Profit,.pos391-private #sales .sale-profit-secondary,.pos391-private .srow:has(>#saleCalcProfitMirror),
.pos391-private [onclick*="customerViability"],.pos391-private [onclick*="pos237OpenProducts"],
.pos391-private [onclick*="openPage('cashStatementPage')"],.pos391-private [onclick*="openPage('cashbox')"]{display:none!important}
.pos391-private #home [data-pos391-disabled]{opacity:.36!important;filter:grayscale(1);cursor:not-allowed!important}
#sales #r372Tools #pos391PrivacyToggle{font-size:10px;font-weight:900;letter-spacing:.02em}
@media(max-width:420px){#sales.r375-ready #r372Tools{flex-wrap:wrap!important;gap:4px!important}}
</style>
'''
p.write_bytes(s.encode())
if len(sys.argv)>2:
    g=p.parents[3]/'build.gradle'
    v=g.read_text()
    assert v.count('485.7.229-r390-tab1')==1
    g.write_text(v.replace('485.7.229-r390-tab1','485.7.229-r391-tab1'))
