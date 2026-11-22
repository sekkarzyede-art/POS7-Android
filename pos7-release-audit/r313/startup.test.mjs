import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

const html=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
function script(id){
 const start='<script id="'+id+'">';
 assert.equal(html.split(start).length,2,'unique script '+id);
 return html.split(start)[1].split('</script>')[0];
}
const bootScript=script('pos7-r313-startup-timing');
const storageScript=script('pos7-localstorage-compression-v1');
assert.ok(bootScript.includes('window.POS7_BOOT_R313'));
assert.ok(storageScript.includes('eagerMigrationSkipped=true'));
assert.ok(!storageScript.includes('for(var i=0;i<storage.length;i++)keys.push(storage.key(i))'));
assert.ok(storageScript.includes('var otherKey=this.key(i)'),'quota recovery must remain');
assert.ok(storageScript.includes('proto.getItem=function(key)'),'legacy reads supported');
assert.ok(storageScript.includes('proto.setItem=function(key,value)'),'writes compressed');
assert.ok(html.includes('window.POS7_BOOT_R313.stateLoadMs'));
assert.ok(html.includes('window.POS7_BOOT_R313.splashMs'));
assert.ok(html.includes('POS7_RESTORE_PENDING_R305'));
assert.ok(html.includes('window.pos310PurchaseActive=()=>active;'));
assert.ok(!html.includes('id="pos7-r311-sale-single-commit"'));
assert.ok(html.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r313-tab2'));

class Storage {
 constructor(){this.data=new Map()}
 get length(){return this.data.size}
 key(i){return [...this.data.keys()][i]||null}
 getItem(k){return this.data.get(String(k))??null}
 setItem(k,v){this.data.set(String(k),String(v))}
 removeItem(k){this.data.delete(String(k))}
}
const localStorage=new Storage();
const historical={products:Array.from({length:150},(_,i)=>({id:i,desc:'old-json-product-'.repeat(30)}))};
localStorage.setItem('HISTORICAL_BACKUP',JSON.stringify(historical));
let writes=0;
const base=Storage.prototype.setItem;
Storage.prototype.setItem=function(k,v){writes++;return base.call(this,k,v)};
const events={};
const context={
 window:null,localStorage,Storage,console,
 performance:{now:()=>100},
 document:{addEventListener:(name,fn)=>events[name]=fn},
 addEventListener:(name,fn)=>events[name]=fn,
 pako:{
  deflate:(value)=>new Uint8Array(zlib.deflateSync(value)),
  inflate:(bytes)=>zlib.inflateSync(bytes).toString('utf8')
 },
 TextEncoder,TextDecoder,Uint8Array,
 btoa:(s)=>Buffer.from(s,'latin1').toString('base64'),
 atob:(s)=>Buffer.from(s,'base64').toString('latin1')
};
context.window=context;
vm.runInNewContext(bootScript,context);
writes=0;
vm.runInNewContext(storageScript,context);
assert.equal(writes,0,'startup must not rewrite existing keys');
assert.equal(context.POS7_BOOT_R313.eagerMigrationSkipped,true);
assert.deepEqual(JSON.parse(localStorage.getItem('HISTORICAL_BACKUP')).products.length,150);
assert.equal(localStorage.getItem('HISTORICAL_BACKUP'),JSON.stringify(historical));
localStorage.setItem('NEW_KEY',JSON.stringify(historical));
assert.equal(writes,1,'new write still persists normally');
assert.ok(localStorage.data.get('NEW_KEY').startsWith('__POS7_LOCAL_JSON_DEFLATE_V1__'),'new writes remain compressed');
assert.equal(localStorage.getItem('NEW_KEY'),JSON.stringify(historical));
assert.equal(localStorage.data.get('HISTORICAL_BACKUP'),JSON.stringify(historical),'untouched backup stays unchanged');
console.log('R313 PASS: no eager rewrites, legacy JSON reads intact, compressed write readable, timing and R310/R312 retained');
