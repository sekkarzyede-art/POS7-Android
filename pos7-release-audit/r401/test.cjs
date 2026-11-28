const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.argv[2],'utf8').match(/<script id="pos7-r322-native-state-storage">([\s\S]*?)<\/script>/)[1];
function boot(result){
 class Storage{getItem(){return null}setItem(){}removeItem(){}clear(){}}
 let reloads=0,writes=0;
 const c={Storage,localStorage:new Storage(),document:{readyState:'loading',addEventListener(){}},
  Pos7Android:{pos322ReadState:()=>result,pos322WriteState(){writes++;return false}},
  location:{reload(){reloads++}}};
 c.window=c;vm.runInNewContext(source,c);
 c.pos401RetryAfterTrustedLoad();c.pos401RetryAfterTrustedLoad();
 return [reloads,writes,c.POS7_R322_NATIVE_STORE.status().active];
}
assert.deepEqual(boot('__POS7_R322_ACCESS_DENIED__'),[1,0,false]);
assert.deepEqual(boot('__POS7_R322_IO_ERROR__'),[0,0,false]);
assert.deepEqual(boot(null),[0,0,false]);
assert.deepEqual(boot('{"products":[],"sales":[],"purchases":[]}'),[0,0,true]);
console.log('Startup retries access timing once; valid, empty, and I/O paths unchanged');
