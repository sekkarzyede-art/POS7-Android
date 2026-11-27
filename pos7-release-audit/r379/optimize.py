from pathlib import Path
import re,hashlib,subprocess
from html.parser import HTMLParser
p=Path('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html')
s=p.read_text()
assert s.count('485.7.229-r378-tab2')==1
assert 'pos7-r378-native-scroll' in s
def replace(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a))
 s=s.replace(a,b,1)
# Do not write unchanged diagnostic text; do not recompute diagnostics for an invisible existing panel.
# Keep status current even when hidden; deduplicate DOM writes only.
replace("el.textContent='المرحلة: '+diag.stage+", "const text='المرحلة: '+diag.stage+")
replace("ثانية، عند توفر الاتصال وانتهاء الفاتورة.':'');}", "ثانية، عند توفر الاتصال وانتهاء الفاتورة.':'');if(el.textContent!==text)el.textContent=text;}")
# Keep list filtering bound to the current DOM after rerender, with one listener per input.
replace('inp.addEventListener("input",filter)}function filter(){var q=S(inp.value);list.querySelectorAll(".line").forEach(function(row){row.style.display=!q||S(row.textContent).includes(q)?"":"none"})}filter();return r', 'inp.addEventListener("input",function(){inp._r379Filter?.()})}inp._r379Filter=function(){var q=S(inp.value);list.querySelectorAll(".line").forEach(function(row){var next=!q||S(row.textContent).includes(q)?"":"none";if(row.style.display!==next)row.style.display=next})};inp._r379Filter();return r')
# Reuse current period sales only within the synchronous report render, never across writes.
# Existing R715 report cache remains authoritative.
# Do not alter legacy/overridden report grouping.
# No persistent caches of accounting data, no changes to publication schedule.
# On-demand bounded measurement, automatically remove observers/listeners.
marker='<script id="pos7-r379-perf-diagnostics">'
assert marker not in s
s+=r'''
<script id="pos7-r379-perf-diagnostics">
(function(){'use strict';
function install(){
 const host=document.getElementById('saleSettingsPage');if(!host||document.getElementById('r379Perf'))return;
 const panel=document.createElement('div');panel.id='r379Perf';panel.className='panel';
 const h=document.createElement('h3');h.textContent='تشخيص الأداء';panel.append(h);
 const b=document.createElement('button');b.type='button';b.className='soft';b.textContent='بدء قياس لمدة 30 ثانية';panel.append(b);
 const out=document.createElement('pre');out.style.cssText='white-space:pre-wrap;direction:rtl';out.textContent='القياس اختياري ولا يغير البيانات.';panel.append(out);host.append(panel);
 let stop=null;
 b.onclick=function(){
 if(stop){stop();return;}
 const start=performance.now();let raf=0,last=start,frames=0,slow=0,max=0,tasks=0,total=0,clicks=0,maxClick=0,observer=null,timer=0;
 const next=t=>{const gap=t-last;last=t;frames++;if(gap>34)slow++;max=Math.max(max,gap);raf=requestAnimationFrame(next)};
 const click=()=>{const t=performance.now();clicks++;requestAnimationFrame(()=>{maxClick=Math.max(maxClick,performance.now()-t)})};
 document.addEventListener('click',click,{capture:true,passive:true});
 try{observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){tasks++;total+=e.duration}});observer.observe({type:'longtask',buffered:false})}catch(e){observer=null}
 raf=requestAnimationFrame(next);b.textContent='إيقاف القياس';out.textContent='القياس نشط. يمكنك التنقل والبحث والتمرير ثم العودة هنا.';
 stop=function(){clearTimeout(timer);cancelAnimationFrame(raf);document.removeEventListener('click',click,true);observer?.disconnect();const sec=(performance.now()-start)/1000;out.textContent='مدة القياس: '+sec.toFixed(1)+' ثانية\nإطارات العرض: '+frames+'\nإطارات بفاصل أكبر من 34ms: '+slow+'\nأطول فاصل: '+max.toFixed(1)+' ms\nعدد الضغطات: '+clicks+'\nأقصى زمن حتى إطار العرض التالي بعد الضغط: '+maxClick.toFixed(1)+' ms\nالمهام الطويلة: '+(observer?tasks+' / '+total.toFixed(1)+' ms':'غير مدعوم');stop=null;b.textContent='بدء قياس لمدة 30 ثانية'};
 timer=setTimeout(stop,30000);
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>
'''
s=s.replace('485.7.229-r378-tab2','485.7.229-r379-tab2')
assert 'jdcolkgzwqpwbfvcrdje' not in s and 'rmskuolsiqbzxuakofpb' in s
class P(HTMLParser):
 def __init__(self):super().__init__();self.active=False;self.s=[]
 def handle_starttag(self,t,a):
  if t=='script':self.active=True;self.s.append('')
 def handle_endtag(self,t):
  if t=='script':self.active=False
 def handle_data(self,d):
  if self.active:self.s[-1]+=d
q=P();q.feed(s)
for i,j in enumerate(q.s):
 if j.strip():
  r=subprocess.run(['node','--check'],input=j,text=True,capture_output=True)
  if r.returncode:raise SystemExit(f'Script {i}: {r.stderr}')
p.write_text(s)
Path('/tmp/r364-html.sha').write_text(hashlib.sha256(s.encode()).hexdigest())
g=p.parents[3]/'build.gradle'
v=g.read_text()
assert v.count("versionName '485.7.229-r378-tab2'")==1
g.write_text(v.replace("versionName '485.7.229-r378-tab2'","versionName '485.7.229-r379-tab2'"))
