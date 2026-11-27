const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
process.env.TZ='Asia/Beirut';
const html=fs.readFileSync(process.argv[2],'utf8');
const ctx={window:{}};
vm.runInNewContext(html.match(/<script id="pos397-daily-cash">([\s\S]*?)<\/script>/)[1],ctx);
const day='2026-11-28T';
const move=(account,amount,ref,title,time='09:00:00')=>({account,amount,ref,title,date:day+time+'+02:00',party:'علي'});
const book={fxRate:100000,sales:[{number:'SAL-000401',fxRate:90000}],mcLedger:[
 move('cashier_usd',20,'SAL-000401','قبض فاتورة بيع'),
 move('cashier_lbp',2700000,'SAL-000401','قبض فاتورة بيع'),
 move('main_usd',-100,'PUR-000201','دفع فاتورة شراء'),
 move('main_lbp',7000000,'RC-1','سند قبض من الزبون'),
 move('main_usd',-70,'PAY-1','سند صرف للمورد'),
 move('wish_usd',800,'SAL-000402','قبض فاتورة بيع'),
 move('main_usd',600,'SAL-000403','قبض فاتورة بيع','17:00:00'),
 {...move('main_usd',500,'SAL-000400','قبض فاتورة بيع'),date:'2026-11-27T23:59:59+02:00'},
 move('main_usd',-50,'TR-1','تحويل داخلي'),
 {...move('cashier_lbp',4500000,'TR-1','تحويل داخلي'),fxRate:90000},
]};
const snapshot=ctx.window.pos397DailyCashSnapshot;
const result=snapshot(book,new Date(day+'12:00:00+02:00'));
assert.equal(result.rows.length,6);
assert.equal(result.rows[0].label,'ف بيع');
assert.equal(result.rows[0].ref,'401');
assert.equal(result.rows[0].cents,5000);
assert.equal(result.incoming,17000);
assert.equal(result.outgoing,22000);
assert.equal(result.balance,-5000);
assert.equal(result.estimated,true);
assert.equal(snapshot(book,new Date('2026-11-29T00:00:00+02:00')).rows.length,0);
assert.match(html,/pos7SendNativeBluetooth\(bytes,'جرد الصندوق اليومي',true\)/);
assert.match(html,/#home.active #pos397DailyCash\{display:block\}/);
console.log('Daily cash cutoff, cash accounts, exchange rates, transfer net and print routing checked');
