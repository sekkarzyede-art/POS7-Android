#!/usr/bin/env python3
import hashlib,json,re,sys,zipfile
from pathlib import Path
A={'tab1':'POS7_Tablet_v485.7.229_R213_Project.zip','tab2':'POS7_المتجر_الثاني_TAB_R215_Android_Source.zip'}
P={'tab1':'jdcolkgzwqpwbfvcrdje','tab2':'rmskuolsiqbzxuakofpb'}
def inspect(branch,filename):
 p=Path(filename)
 if not p.is_file():raise ValueError('Missing source ZIP: '+filename)
 with zipfile.ZipFile(p) as z:
  if z.testzip() is not None:raise ValueError('CRC failed: '+filename)
  names=z.namelist()
  hs=[x for x in names if x.endswith('app/src/main/assets/index.html')]
  gs=[x for x in names if x.endswith('app/build.gradle')]
  if len(hs)!=1 or len(gs)!=1:raise ValueError('Unexpected structure in '+filename)
  h=z.read(hs[0]).decode('utf8','replace');g=z.read(gs[0]).decode('utf8','replace')
  urls=sorted(set(re.findall(r'https://([a-z0-9]{20})\.supabase\.co',h)))
  return {'archive':filename,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'html_sha256':hashlib.sha256(h.encode()).hexdigest(),'gradle_sha256':hashlib.sha256(g.encode()).hexdigest(),'expected_project':P[branch],'url_project_ids_in_html':urls,'version_name':re.findall(r'versionName\s*[= ]\s*[\'"]([^\'"]+)',g),'package_id':re.findall(r'applicationId\s*[= ]\s*[\'"]([^\'"]+)',g),'html_marker_presence':{m:m in h for m in ['pos7_owner_snapshot','publisher_device','pos7_inventory_commit_r155','pos7_owner_rebind_device','pos7_store2_first_tablet_r215']},'source_files':len(names)}
def main():
 r={k:inspect(k,v) for k,v in A.items()}
 result={'task':'R285_original_pair_audit','status':'BLOCK_BUILD','source':r,'safe_to_build':False,'blockers':['Unified branch selection before Supabase initialization not implemented','Actual restore and publisher cutover not tested','Original installed APK certificate comparison not verified'],'note':'READ ONLY. Source identifiers are detected, not proof of routing correctness.'}
 Path('POS7_R285_AUDIT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':
 try:main()
 except Exception as e: print(str(e),file=sys.stderr);sys.exit(2)
