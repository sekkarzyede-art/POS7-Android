const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const c={window:{pos178Today:()=> '2026-11-28'},norm:String,state:{
 purchases:[{number:'p',date:'2026-11-27T10:00:00Z',items:[{productId:44,qty:5.5}]}],
 sales:[{date:'2026-11-28T10:00:00Z',items:[{id:44,qty:2}]},{cancelled:true,date:'2026-11-28T10:00:00Z',items:[{id:44,qty:999}]}],
 salesReturns:[{id:14,date:'2026-11-28T10:00:00Z',items:[{id:44,qty:.5}]}],
 purchaseReturns:[{id:15,date:'2026-11-28T10:00:00Z',items:[{barcode:'٠١٢٣',qty:1}]}],
}};
vm.createContext(c);
vm.runInContext(s.slice(s.indexOf('function voucherDate('),s.indexOf('function commit(p,day)')),c);
assert.match(c.voucherDate('2026-11-27'),/^2026-11-27T/);
assert.throws(()=>c.voucherDate('2026-11-29'));
assert.throws(()=>c.voucherDate('2026-09-31'));
assert.throws(()=>c.voucherDate(''));
vm.runInContext(s.slice(s.indexOf(' function movementRows('),s.indexOf(' function renderMovement(')),c);
const rows=c.movementRows({id:44,barcode:'123'}, {from:Date.parse('2026-11-27'),to:Date.parse('2026-11-29')});
assert.equal(rows.length,4);
assert.equal(rows.reduce((x,r)=>x+r.incoming,0),6);
assert.equal(rows.reduce((x,r)=>x+r.outgoing,0),3);
assert.equal(c.movementRows({id:44}, {from:Date.parse('2026-11-28'),to:Date.parse('2026-11-29')}).length,2);
assert.match(s,/const v=commit\(p,selectedDay\)/);
assert.match(s,/sourceId:id,reference:ref,date,description:label/);
console.log('Past voucher date, invalid dates, and period movement totals verified');
