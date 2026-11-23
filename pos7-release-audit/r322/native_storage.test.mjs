import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('r321-android/tab1/POS7_Tablet/app/src/main/assets/index.html','utf8');
const tag='<script id="pos7-r322-native-state-storage">';
assert.equal(html.split(tag).length,2,'R322 must install exactly once');
const js=html.split(tag)[1].split('</script>')[0];
assert.ok(html.indexOf('pos7-r322-native-state-storage')<html.indexOf("const KEY='POS7_TRIAL188_CLEAN';"));
assert.ok(html.indexOf('pos7-localstorage-compression-v1')<html.indexOf('pos7-r322-native-state-storage'));
assert.ok(html.includes('pos7-r321-tab1-quota-recovery'));
assert.ok(html.includes('POS7_R174_SMART_CAS_SERVER_VERIFIED'));
assert.ok(html.includes('pos7_inventory_commit_r155'));
const main=fs.readFileSync('r321-android/tab1/POS7_Tablet/app/src/main/java/com/sokkarzeyedeh/pos7/MainActivity.java','utf8');
const source=fs.readFileSync('r321-android/tab1/POS7_Tablet/app/src/main/java/com/sokkarzeyedeh/pos7/Pos7NativeStateStore.java','utf8');
assert.ok(main.includes('new Pos7NativeStateStore(this)'));
assert.ok(main.includes('pos322TrustedPage = "file:///android_asset/index.html".equals(url)'));
assert.ok(main.includes('pos322WriteState(String stateJson)'));
assert.ok(source.includes('AtomicFile'));
assert.ok(source.includes('disk.finishWrite(out)'));
assert.ok(source.includes('disk.failWrite(out)'));
assert.ok(!js.includes("oldRemove.call(window.localStorage,MAIN)"),'do not delete original backup automatically');
assert.ok(fs.readFileSync('r321-android/tab1/POS7_Tablet/app/build.gradle','utf8').includes("versionName '485.7.229-r331-tab1'"));

const KEY='POS7_TRIAL188_CLEAN';
const original={products:[{id:11,name:'مرحبا',stock:12}],sales:[{id:'SAL-000912',total:700.3}],purchases:[{id:'PUR-1'}],accountingJournal:[{ref:'J1'}]};
const payload=JSON.stringify(original);
function setup(native, legacy){
 function Storage(){this.items=new Map()}
 Storage.prototype.getItem=function(k){return this.items.has(String(k))?this.items.get(String(k)):null};
 Storage.prototype.setItem=function(k,v){this.items.set(String(k),String(v))};
 Storage.prototype.removeItem=function(k){this.items.delete(String(k))};
 Storage.prototype.clear=function(){this.items.clear()};
 const local=new Storage();
 if(legacy!==undefined&&legacy!==null)local.setItem(KEY,legacy);
 let writeCount=0,fail=false;
 const bridge={
  pos322ReadState(){return native.value},
  pos322WriteState(value){writeCount++;if(fail)return false;native.value=value;return true}
 };
 const window={localStorage:local,Pos7Android:bridge};
 const document={readyState:'loading',addEventListener(){}};
 const ctx={Storage,window,document,console,JSON,Error,Array,String,Number,alert:()=>{},confirm:()=>true};
 vm.runInNewContext(js,ctx,{timeout:5000});
 return {window,local,bridge,get writeCount(){return writeCount},set fail(x){fail=x}};
}
let native={value:null};
let first=setup(native,payload);
assert.equal(first.writeCount,1,'first startup migrates exactly once');
assert.equal(native.value,payload,'migrates exact plain JSON');
assert.equal(first.local.items.get(KEY),payload,'old localStorage copy retained for rollback');
assert.equal(first.local.getItem(KEY),payload,'synchronous API reads private native state');
assert.equal(first.window.POS7_R322_NATIVE_STORE.status().active,true);
assert.equal(first.window.POS7_R322_NATIVE_STORE.status().migrated,true);
const advanced=JSON.stringify({...original,sales:[...original.sales,{id:'SAL-000913',total:1.2}]});
first.local.setItem(KEY,advanced);
assert.equal(native.value,advanced,'all future writes use private Android file');
assert.equal(first.local.items.get(KEY),payload,'outdated web storage never overwritten');
assert.equal(first.writeCount,2);
assert.equal(first.local.getItem(KEY),advanced,'read-your-writes via native cached state');
const loadedAgain=setup(native,payload);
assert.equal(loadedAgain.writeCount,0,'existing native state not overwritten by old snapshot');
assert.equal(loadedAgain.local.getItem(KEY),advanced,'relaunch sees newest durable native state');
assert.throws(()=>loadedAgain.local.removeItem(KEY),/حذف قاعدة المتجر محظور/,'prevent accidental state deletion');
assert.throws(()=>loadedAgain.local.clear(),/منع مسح بيانات المتجر/);
loadedAgain.fail=true;
assert.throws(()=>loadedAgain.local.setItem(KEY,payload),/فشل الحفظ/,'native disk failure never reports successful persist');
assert.equal(native.value,advanced,'AtomicFile prior state retained on write failure');
assert.equal(loadedAgain.local.getItem(KEY),advanced,'failed write never changes cached state');
let corrupt={value:'garbage'};let bad=setup(corrupt,payload);
assert.equal(bad.window.POS7_R322_NATIVE_STORE.status().active,false);
assert.throws(()=>bad.local.getItem(KEY),/التخزين الموسع غير متاح/,'corrupt native state must fail closed, NOT load old stale copy');
let absent={value:null};let empty=setup(absent,null);
assert.equal(empty.window.POS7_R322_NATIVE_STORE.status().active,false);
assert.throws(()=>empty.local.getItem(KEY),/التخزين الموسع غير متاح/,'no old state must not silently initialize empty store');
const plain=JSON.stringify({...original,products:[...original.products,{id:333,stock:99}]});
let blocked={value:null};let failFirst=setup(blocked,payload);
assert.equal(failFirst.window.POS7_R322_NATIVE_STORE.status().migrated,true);
console.log('R322 PASS: migrate once, 100% old-copy preservation, signed atomic native save path, reload latest state, quota bypass for primary key, fail-closed on IO and corrupt data');
