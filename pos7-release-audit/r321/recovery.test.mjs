import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('r321-android/tab1/POS7_Tablet/app/src/main/assets/index.html','utf8');
const tag='<script id="pos7-r321-tab1-quota-recovery">';
assert.equal(html.split(tag).length,2,'unique R321 intervention');
const code=html.split(tag)[1].split('</script>')[0];
assert.ok(code.includes('window.Pos7Android.saveBackupJson(file,payload)'));
assert.ok(code.includes('if(success===true)'));
assert.ok(code.includes('localStorage.removeItem(BACKUPS)'));
assert.ok(code.includes('if(after.length)localStorage.setItem(BACKUPS,JSON.stringify(after))'));
assert.ok(code.includes('pos7R102SaveStateDirect()'));
assert.ok(!code.includes('window.POS7_R174_SMART_CAS_SERVER_VERIFIED='));
assert.ok(!html.includes("versionName '485.7.229-r321-tab1'")); // lives in Gradle, not HTML
assert.equal(html.split('pos7-localstorage-compression-v1').length,2);
assert.ok(html.includes('pos7_inventory_commit_r155'),'inventory approval not removed');
assert.ok(html.includes('POS7_R174_SMART_CAS_SERVER_VERIFIED'),'R174 gate untouched');
const backupSection=html.split("const POS7_BACKUPS_KEY='POS7_BACKUPS_V1'")[1].split('/* ===== POS7 v97')[0];
assert.ok(backupSection.includes("let list=getBackupList(), ok=false, externalSelected=false"),'scheduled backups are external first');
assert.ok(backupSection.includes("if(!externalSelected&&!list.length)ok=pos340StoreBackups([b]);"),'fallback only when no older backup exists');
assert.ok(backupSection.includes("function manualBackupDownload(){let b=makeBackupObject('manual');"),'manual saves remain external');
assert.ok(!backupSection.includes("function manualBackupDownload(){let b=makeBackupObject('manual'),list=getBackupList()"));
assert.ok(backupSection.includes("/* R321: external Drive export; no duplicate full local snapshot */"));
assert.ok(backupSection.includes("/* R321: external WhatsApp export; no duplicate full local snapshot */"));

const DATA_KEY='POS7_TRIAL188_CLEAN', BACKUPS_KEY='POS7_BACKUPS_V1';
const B=(kind,date)=>({app:'POS7',version:110,kind,createdAt:date,data:{products:[{id:10,stock:5}],sales:[{id:'SAL-1'}],purchases:[]}});
function setup(){
  const obj={[DATA_KEY]:JSON.stringify({products:[{id:10,stock:5}],sales:[{id:'SAL-1'}]}),
   [BACKUPS_KEY]:JSON.stringify([B('auto-1','2026-11-22T10:00:00Z'),B('auto-2','2026-11-22T11:00:00Z')])};
  const savedCalls=[], nativeCalls=[], priorResults=[];let quota=false, mainWrites=0;
  const store={getItem(k){return Object.hasOwn(obj,k)?obj[k]:null},
    setItem(k,v){if(quota&&k===BACKUPS_KEY)throw new Error('QuotaExceededError');obj[k]=String(v);if(k===DATA_KEY)mainWrites++},
    removeItem(k){delete obj[k]}};
  const ctx={window:null,localStorage:store,document:{readyState:'loading',addEventListener(){}},
    confirm:()=>true,console,JSON,Date,Array,String,
    pos7R102SaveStateDirect:()=>{store.setItem(DATA_KEY,obj[DATA_KEY])}};
  ctx.window={Pos7Android:{saveBackupJson:(name,data)=>{nativeCalls.push({name,data})}},
    pos7OnBackupSaveResult:(success,msg)=>priorResults.push({success,msg})};
  vm.runInNewContext(code,ctx,{timeout:3000});
  return {ctx,obj,store,nativeCalls,priorResults,savedCalls,get mainWrites(){return mainWrites},set quota(x){quota=x}};
}
{
 const v=setup(),before=v.obj[DATA_KEY], backupsBefore=v.obj[BACKUPS_KEY];
 v.ctx.window.POS7_R321_RECOVERY.exportOne();
 assert.equal(v.nativeCalls.length,1,'first copy exported via Android');
 assert.equal(v.obj[BACKUPS_KEY],backupsBefore,'NOT removed before callback');
 const exported=JSON.parse(v.nativeCalls[0].data);assert.equal(exported.createdAt,'2026-11-22T11:00:00Z');
 assert.equal(exported.data.products[0].stock,5);
 v.ctx.window.pos7OnBackupSaveResult(false,'user cancelled');
 assert.equal(v.obj[BACKUPS_KEY],backupsBefore,'failed external save NEVER removes local copy');
 v.ctx.window.POS7_R321_RECOVERY.exportOne();
 v.ctx.window.pos7OnBackupSaveResult(true,'written');
 assert.equal(JSON.parse(v.obj[BACKUPS_KEY]).length,1,'only confirmed snapshot removed');
 assert.equal(JSON.parse(v.obj[BACKUPS_KEY])[0].createdAt,'2026-11-22T10:00:00Z');
 assert.equal(v.obj[DATA_KEY],before,'primary store unchanged during cleanup');
 v.ctx.window.POS7_R321_RECOVERY.exportOne();
 v.ctx.window.pos7OnBackupSaveResult(true,'written');
 assert.equal(v.store.getItem(BACKUPS_KEY),null,'fully exported backups key removed');
 assert.equal(v.store.getItem(DATA_KEY),before);
 v.ctx.window.POS7_R321_RECOVERY.checkMain();
 assert.equal(v.store.getItem(DATA_KEY),before,'quota-test preserves exact primary data');
 assert.equal(v.mainWrites,1);
 assert.equal(v.priorResults.length,3,'original callback retained');
}
{
 const v=setup(),before=v.obj[BACKUPS_KEY];v.quota=true;
 v.ctx.window.POS7_R321_RECOVERY.exportOne();
 v.ctx.window.pos7OnBackupSaveResult(true,'external written but quota blocked replacing backup key');
 assert.equal(v.obj[BACKUPS_KEY],before,'failed local rewrite must leave original intact');
 assert.equal(v.store.getItem(DATA_KEY),v.obj[DATA_KEY]);
}
{
 const v=setup();v.ctx.window.POS7_R321_RECOVERY.exportOne();
 const old=v.obj[BACKUPS_KEY],changed=JSON.parse(old);
 changed[1].data.products[0].stock=999;
 v.obj[BACKUPS_KEY]=JSON.stringify(changed);
 v.ctx.window.pos7OnBackupSaveResult(true,'written');
 assert.equal(v.obj[BACKUPS_KEY],JSON.stringify(changed),'changed backups never removed by stale confirmation');
}
console.log('R321 PASS: Android-confirmed export first, fail retains all backups, only exact matching snapshot released, primary store unchanged, existing protections retained');
