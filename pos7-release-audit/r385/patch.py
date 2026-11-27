from pathlib import Path
import sys,hashlib,subprocess
p=Path(sys.argv[1]);s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='4840f8789b454408804ea2953e0c3d44717c09d30e53a4af2fa5626bab3654be'
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b,1)
js=Path('pos7-release-audit/r385/repair.js').read_text()
rep('function pos7R354OpenBackup(b,inspectOnly=false){',js+'\nfunction pos7R354OpenBackup(b,inspectOnly=false){')
rep('prepared=pos7R384PrepareBackup(b,result)','prepared=pos7R385RepairReferences(b,result)')
rep('(r.identityRepairs.length+r.invalidRepairs.length)','(r.identityRepairs.length+r.invalidRepairs.length+r.referenceRepairs.length)')
rep("version:'R384',...report()","version:'R385',...report()")
rep("POS7_R384_RESTORE_REVIEW.json","POS7_R385_RESTORE_REVIEW.json")
s=s.replace('POS7_R384_backup_audit.json','POS7_R385_backup_audit.json')
rep("const VERSION='R384', MAX=250;","const VERSION='R385', MAX=250;")
rep("make('h3','تشخيص الأداء المتقدم — R384');","make('h3','تشخيص الأداء المتقدم — R385');")
rep('485.7.229-r384-tab2','485.7.229-r385-tab2')
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
g=p.parents[3]/'build.gradle';raw=g.read_text()
assert raw.count("versionName '485.7.229-r384-tab2'")==1
g.write_text(raw.replace("versionName '485.7.229-r384-tab2'","versionName '485.7.229-r385-tab2'"))
