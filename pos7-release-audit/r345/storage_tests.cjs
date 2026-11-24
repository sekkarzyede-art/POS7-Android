const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const h=fs.readFileSync(process.argv[2],'utf8');
const script=h.match(/<script id="pos7-r322-native-state-storage">([\s\S]*?)<\/script>/)[1];
const backup=h.slice(h.indexOf('function pos340StoreBackups(list){'),h.indexOf('function saveAutoLocalBackup(slot){'));
const main='POS7_TRIAL188_CLEAN',old=JSON.stringify({products:[{id:'p',stock:8}],sales:[{id:'s'}],purchases:[{id:'b'}]}),fresh=JSON.stringify({products:[{id:'p',stock:7}],sales:[{id:'s'},{id:'s2'}],purchases:[{id:'b'}]});
const session=project=>JSON.stringify({access_token:'x.'+Buffer.from(JSON.stringify({iss:`https://${project}.supabase.co/auth/v1`})).toString('base64url')+'.x'});
const correct='rmskuolsiqbzxuakofpb',wrong='jdcolkgzwqpwbfvcrdje';
function env({native=null,legacy=old,storedSession=null,writeFail=false,readMismatch=false,backupFail=false}={}){
 class Storage{constructor(){this.m=new Map}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){if(backupFail&&k==='POS7_BACKUPS_V1')throw Error('quota');this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}clear(){this.m.clear()}}
 const ls=new Storage,ss=new Storage;if(legacy!==null)ls.setItem(main,legacy);if(storedSession!==null)ls.setItem('POS7_CLOUD_SESSION_V1',storedSession);ls.setItem('POS7_RESTORE_PENDING_R305','yes');ls.setItem('POS7_RESTORE_LOCAL_ONLY_R323','yes');ls.m.set('POS7_BACKUPS_V1','[{"a":1}]');
 let reads=0,writes=0,disk=native;const window={localStorage:ls,Pos7Android:{pos322ReadState(){reads++;return readMismatch&&writes?'{}':disk},pos322WriteState(v){writes++;if(writeFail)return false;disk=v;return true}}};
 const ctx=vm.createContext({window,Storage,localStorage:ls,sessionStorage:ss,console,atob,document:{readyState:'loading',addEventListener(){}},POS7_BACKUPS_KEY:'POS7_BACKUPS_V1'});vm.runInContext(script,ctx);vm.runInContext(backup,ctx);return {ls,ss,ctx,window,status:()=>window.POS7_R322_NATIVE_STORE.status(),disk:()=>disk,writes:()=>writes};
}
let n=0;function test(name,f){f();n++;console.log('PASS',name)}
test('exact migration retains original local snapshot',()=>{const e=env({storedSession:session(correct)});assert.equal(e.status().active,true);assert.equal(e.status().migrated,true);assert.equal(e.disk(),old);assert.equal(e.ls.m.get(main),old)});
test('logged-out tablet migrates offline without cloud',()=>{const e=env();assert.equal(e.status().active,true);assert.equal(e.writes(),1)});
test('wrong store cached token fails closed without writes',()=>{const e=env({storedSession:session(wrong)});assert.equal(e.status().active,false);assert.match(e.status().error,/المتجر الثاني/);assert.equal(e.writes(),0);assert.equal(e.ls.m.get(main),old)});
test('atomic write failure retains old local copy',()=>{const e=env({writeFail:true});assert.equal(e.status().active,false);assert.equal(e.ls.m.get(main),old);assert.throws(()=>e.ls.setItem(main,fresh))});
test('readback mismatch fails closed',()=>{const e=env({readMismatch:true});assert.equal(e.status().active,false);assert.equal(e.ls.m.get(main),old)});
test('reopen uses latest native copy not stale legacy copy',()=>{const e=env({native:fresh});assert.equal(e.ls.getItem(main),fresh);assert.equal(e.writes(),0);assert.equal(e.ls.m.get(main),old)});
test('new writes retain original legacy snapshot and restore flags',()=>{const e=env();e.ls.setItem(main,fresh);assert.equal(e.disk(),fresh);assert.equal(e.ls.getItem(main),fresh);assert.equal(e.ls.m.get(main),old);assert.equal(e.ls.getItem('POS7_RESTORE_PENDING_R305'),'yes');assert.equal(e.ls.getItem('POS7_RESTORE_LOCAL_ONLY_R323'),'yes')});
test('invalid main state cannot overwrite valid current state',()=>{const e=env();assert.throws(()=>e.ls.setItem(main,'{}'));assert.equal(e.disk(),old)});
test('main key delete and clear blocked but other keys work',()=>{const e=env();assert.throws(()=>e.ls.removeItem(main));assert.throws(()=>e.ls.clear());e.ls.setItem('other','1');e.ls.removeItem('other');assert.equal(e.ls.getItem('other'),null);e.ss.setItem(main,'other');assert.equal(e.ss.getItem(main),'other')});
test('backup quota failure never deletes existing backup',()=>{const e=env({backupFail:true});assert.equal(e.ctx.pos340StoreBackups([{a:2},{a:1}]),false);assert.equal(e.ls.getItem('POS7_BACKUPS_V1'),'[{"a":1}]')});
test('backup truncation is rejected and adding succeeds',()=>{const e=env();assert.equal(e.ctx.pos340StoreBackups([]),false);assert.equal(e.ctx.pos340StoreBackups([{a:2},{a:1}]),true);assert.equal(e.ls.getItem('POS7_BACKUPS_V1'),'[{"a":2},{"a":1}]')});
test('restore guard and original restore modules still present',()=>{assert.ok(h.includes("if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;"));assert.ok(h.includes("if(!pos340StoreBackups(list))return toast('تعذر حفظ نسخة الأمان الحالية"));for(const f of ['restore_transfer.js','local_restore_r323.js','same_device_r324.js'])assert.ok(h.includes(`<script src="${f}"></script>`));assert.ok(h.indexOf('pos7-r322-native-state-storage')<h.indexOf('pos7-r314-storage-hook'));assert.ok(!h.includes(wrong))});
console.log(n+'/12 PASS');
