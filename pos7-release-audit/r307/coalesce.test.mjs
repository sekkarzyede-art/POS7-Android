import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html', 'utf8');
const match = html.match(/<script id="pos7-r307-invoice-home-coalesce">([\s\S]*?)<\/script>/);
assert.ok(match, 'R307 coalescer must be present exactly once');
assert.equal((html.match(/id="pos7-r307-invoice-home-coalesce"/g) || []).length, 1);
assert.ok(html.includes('pos7R102SaveStateDirect();\n  if(!window.pos307MarkHomeDirty || !window.pos307MarkHomeDirty())renderHome();'));

let writes = 0, renders = 0, fail = false, seq = 'purchase';
const context = {
  renderHome() { renders++; },
  saveSale() {
    for (let i=0;i<4;i++) { writes++; if(!context.pos307MarkHomeDirty())context.renderHome(); }
    return 'SALE_OK';
  },
  savePurchase() {
    for (let i=0;i<11;i++) {
      writes++;
      if(!context.pos307MarkHomeDirty())context.renderHome();
      if(fail && i===4)throw Error('simulated_failure');
    }
    return 'PURCHASE_OK';
  }
};
context.window = context;
vm.runInNewContext(match[1], context);
assert.equal(context.pos307HomeBatchInstalled, true);
assert.equal(context.saveSale(), 'SALE_OK');
assert.equal(writes, 4);
assert.equal(renders, 1);
writes = 0; renders = 0;
assert.equal(context.savePurchase(), 'PURCHASE_OK');
assert.equal(writes, 11, 'all 11 durable writes are preserved');
assert.equal(renders, 1, '11 heavy dashboard renders become one');
writes = 0; renders = 0; fail = true;
assert.throws(() => context.savePurchase(), /simulated_failure/);
assert.equal(writes, 5);
assert.equal(renders, 1, 'failed operation still refreshes home once');
assert.equal(context.pos307MarkHomeDirty(), false, 'batch state clears on error');
renders = 0;
if(!context.pos307MarkHomeDirty())context.renderHome();
assert.equal(renders, 1, 'ordinary standalone saves render immediately');
console.log('R307 behavior passed: sale 4 writes/1 render, purchase 11 writes/1 render, failure safe');
