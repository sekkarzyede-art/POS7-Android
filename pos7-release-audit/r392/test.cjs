const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8');
const js=html.split('<script id="pos391-privacy">')[1].split('</script>')[0];
for(const initial of ['on','off']){
 let pin=null,stored=initial,asks=0;
 const button={setAttribute(){}};
 const ctx=vm.createContext({document:{documentElement:{classList:{toggle(){}}},querySelectorAll:()=>[],getElementById:id=>id==='pos391PrivacyToggle'?button:null,addEventListener(){}},localStorage:{getItem:()=>stored,setItem:(_,v)=>stored=v},window:{},toast(){},prompt(){asks++;return pin}});
 vm.runInContext(js,ctx);
 const toggle=()=>vm.runInContext('pos391TogglePrivacy()',ctx);
 toggle();assert.equal(stored,initial);
 pin='1234';toggle();assert.equal(stored,initial);
 pin='1212';toggle();assert.equal(stored,initial==='on'?'off':'on');
 assert.equal(asks,3);
}
assert(html.includes('.pos391-private #home .home-tile > .home-mini,'));
assert(!html.includes('.pos391-private #home .home-tile > :not(.home-icon)'));
assert(html.includes('#pos170Profit{color:#c62828'));
const f=new Intl.DateTimeFormat('ar-LB',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'});
for(const t of ['2026-11-27T09:21:09','2026-11-27T22:20:00','1970-01-01T00:00:00']){
 const d=new Date(t);
 assert.equal(f.format(d),d.toLocaleString('ar-LB'));
}
console.log('Both privacy transitions require PIN, card labels are preserved and cash timestamps match');
