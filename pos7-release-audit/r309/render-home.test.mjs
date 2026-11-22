import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const tag='<script id="pos7-r307-invoice-home-coalesce">';
assert.equal(source.split(tag).length,2,'single batch script');
const body=source.split(tag)[1].split('</script>')[0];
assert.ok(body.includes('window.pos309HomeBatchActive=()=>depth>0;'));
assert.ok(source.includes("if(name==='renderHome' && window.pos309HomeBatchActive?.())return original.apply(this,arguments);"));
let renders=0,writes=0, fail=false;
const app={
  renderHome(){renders++;},
  saveSale(){
    for(let i=0;i<4;i++){writes++;app.renderHome();}
    return 'sale';
  },
  savePurchase(){
    for(let i=0;i<11;i++){
      writes++;app.renderHome();app.renderHome();
      if(fail&&i===4)throw Error('simulated_fail');
    }
    return 'purchase';
  }
};
app.window=app;
vm.runInNewContext(body,app);
assert.equal(app.pos307HomeBatchInstalled,true);
assert.equal(app.pos309HomeBatchActive(),false);

assert.equal(app.saveSale(),'sale');
assert.equal(writes,4,'all sale durable writes preserved');
assert.equal(renders,1,'4 sale direct home renders coalesced to one');
writes=0;renders=0;
assert.equal(app.savePurchase(),'purchase');
assert.equal(writes,11,'all purchase durable writes preserved');
assert.equal(renders,1,'22 nested purchase home renders coalesced to one');
writes=0;renders=0;fail=true;
assert.throws(()=>app.savePurchase(),/simulated_fail/);
assert.equal(writes,5,'failed invoice not silently retried');
assert.equal(renders,1,'one home refresh on failure');
assert.equal(app.pos309HomeBatchActive(),false,'batch cleared after exception');
renders=0;
app.renderHome();
assert.equal(renders,1,'standalone render not deferred');
console.log('R309 PASS: actual renderHome batching, 11 durable writes, sale, exception, standalone home');
