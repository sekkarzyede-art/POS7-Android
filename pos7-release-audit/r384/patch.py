from pathlib import Path
import sys,hashlib,subprocess
p=Path(sys.argv[1]);s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='8b8de62b03fe5a09eece80d3eb477979fde9b50039d00e1cde6ec93b737d745c'
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a));s=s.replace(a,b,1)
js=Path('pos7-release-audit/r384/prepare.js').read_text()
rep('function pos7R354OpenBackup(b,inspectOnly=false){',js+'\nfunction pos7R354OpenBackup(b,inspectOnly=false){')
rep(' let repaired=false;',' let repaired=false,prepared=null;')
rep("const report=()=>{const {identityCandidate,simulationCandidate,...details}=result;return details;};","const report=()=>{const {identityCandidate,simulationCandidate,...details}=result;return prepared?{...details,preparation:prepared.report}:details;};")
rep(" btn('تحميل تقرير الفحص',()=>download('POS7_R383_backup_audit.json',report()));",''' const prepareButton=btn('معالجة النسخة للاستعادة',()=>{
  try{prepared=pos7R384PrepareBackup(b,result);repaired=true;const r=prepared.report;status.textContent='تمت معالجة نسخة مستقلة: '+(r.identityRepairs.length+r.invalidRepairs.length)+' تصحيح معرّف. '+(r.readyForOriginalRestore?'النسخة بلا تعارضات مانعة في الفحص.':'تبقى مراجعة مطلوبة؛ لم تُستعد أي بيانات.');details.textContent=JSON.stringify(r,null,2);}
  catch(e){prepared=null;status.textContent='تعذرت المعالجة: '+e.message;}
 });prepareButton.style.background='#147d50';prepareButton.style.color='white';
 btn('حفظ النسخة المعالجة',()=>{if(!prepared)return alert('اضغط معالجة النسخة للاستعادة أولاً');download('POS7_R384_RESTORE_REVIEW.json',prepared.candidate);});
 btn('تحميل تقرير الفحص',()=>download('POS7_R384_backup_audit.json',report()));''')
rep("version:'R383',...report()","version:'R384',...report()")
rep("shareBackupJson('POS7_R383_backup_audit.json'","shareBackupJson('POS7_R384_backup_audit.json'")
rep("const VERSION='R383', MAX=250;","const VERSION='R384', MAX=250;")
rep("make('h3','تشخيص الأداء المتقدم — R383');","make('h3','تشخيص الأداء المتقدم — R384');")
rep('485.7.229-r383-tab2','485.7.229-r384-tab2')
assert 'pos7R354ExternalIdentityReviewRequired===true||t.duplicateIdGroupsBefore' in s
assert 'jdcolkgzwqpwbfvcrdje' not in s
from html.parser import HTMLParser
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
raw=g.read_text()
assert raw.count("versionName '485.7.229-r383-tab2'")==1
g.write_text(raw.replace("versionName '485.7.229-r383-tab2'","versionName '485.7.229-r384-tab2'"))
