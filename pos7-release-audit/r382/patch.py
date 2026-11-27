from pathlib import Path
import sys,hashlib
p=Path(sys.argv[1]);s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='fe8848322dabcbff0c9dd375d3f2e873850b602dae84eda00539b59185795bac'
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a));s=s.replace(a,b,1)
rep("const VERSION='R380', MAX=250;","const VERSION='R382', MAX=250;")
rep("make('h3','تشخيص الأداء المتقدم — R380');","make('h3','تشخيص الأداء المتقدم — R382');")
rep("if(e)e.textContent=x[1]+'$'+x[2].toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})","if(e){const value=x[1]+'$'+x[2].toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});if(e.textContent!==value)e.textContent=value}")
rep('485.7.229-r381-tab2','485.7.229-r382-tab2')
s+='\n<style id="pos7-r382-static-paint">\n#home.home-page:before,#home.home-page:after,#home .home-tile,#home .home-icon{animation:none!important}\n#home .home-tile{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:transform .22s ease!important}\n.bottom,#pos741ReportDock{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}\n</style>\n'
assert 'jdcolkgzwqpwbfvcrdje' not in s and 'pos381WithBalanceIndex' in s and 'pos381LegacyMainExists' in s
p.write_text(s);print(hashlib.sha256(s.encode()).hexdigest())
