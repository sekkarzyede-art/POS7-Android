import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const h=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const tag='<script id="pos7-v234-stock-center">';
assert.equal(h.split(tag).length,2);
const stock=h.split(tag)[1].split('</script>')[0];
assert.ok(!stock.includes("document.addEventListener('DOMContentLoaded',summary);"),'hidden summary must not run at boot');
assert.ok(stock.includes("if(!p.classList.contains('hidden'))summary()"),'summary generated on visible report');
assert.ok(stock.includes('function buildSaleIndex()'));
assert.ok(h.includes('POS7_RESTORE_PENDING_R305'));
assert.ok(h.includes('window.pos310Installed=true'));
assert.ok(!h.includes('window.pos311SaleActive'));
assert.ok(h.includes('المتجر الثاني — قاعدة مستقلة • 485.7.229-r316-tab2'));

const now=Date.now();
const ago=n=>new Date(now-n*86400000).toISOString();
const products=[
 {id:1,barcode:'A',stock:12,cost:2},
 {id:2,barcode:'B',stock:7,cost:3},
 {id:3,barcode:'C',stock:0,cost:4},
 {id:4,barcode:'D',stock:5,cost:5},
 {id:5,barcode:'E',stock:10,cost:6},
 {id:6,barcode:'F',stock:10,cost:7},
 {id:7,barcode:'G',stock:10,cost:8},
 {id:8,barcode:'H',stock:10,cost:9},
 {id:9,barcode:'I',stock:10,cost:10},
 {id:10,barcode:'J',stock:10,cost:11},
];
const sales=[
 {date:ago(1),items:[{id:1,barcode:'A'},{id:777,barcode:'B'}]},
 {date:ago(21),items:[{id:4,barcode:'D'}]},
 {date:ago(2),cancelled:true,items:[{id:5,barcode:'E'}]},
 {date:ago(3),items:[{id:100,barcode:'F'}]},
 {date:'not-a-date',items:[{id:7,barcode:'G'}]},
 {date:ago(2),items:[{id:8,barcode:'H'},{id:9,barcode:'I'}]},
 {date:ago(28),items:[{id:9,barcode:'I'}]},
 {date:ago(40),items:[{id:10,barcode:'J'}]}
];
const state={products,sales,purchases:[]};
function naiveLast(p){
 let ds=[];
 for(const inv of sales){if(inv.cancelled)continue;
  for(const i of inv.items||[]){
   if(String(i.id)===String(p.id)||String(i.barcode)===String(p.barcode)){
    ds.push(new Date(inv.date).getTime());
   }
  }
 }
 return ds.length?Math.max.apply(null,ds):0;
}
const expected=products.filter(p=>p.stock>0&&(!naiveLast(p)||(Date.now()-naiveLast(p))>15*86400000)).length;
const element={innerHTML:''},panel={classList:{contains:()=>false,toggle:()=>{} }};
const domListeners=[];
const ctx={state,window:null,console,Date,Map,Set,Number,String,Array,Math,document:{
 getElementById(id){if(id==='pos234StockSummary')return element;if(id==='stockReportsPanel')return panel;return null},
 addEventListener(type,fn){domListeners.push({type,fn})}
}};
ctx.window=ctx;
vm.runInNewContext(stock,ctx);
assert.equal(domListeners.filter(x=>x.type==='DOMContentLoaded').length,0,'stock summary not eager');
assert.equal(element.innerHTML,'','no stock summary before opening report');
ctx.openStockReports();
assert.ok(element.innerHTML.includes('راكدة أكثر من 15 يوم'),'stock report renders when requested');
assert.ok(element.innerHTML.includes('<b>'+expected+'</b>'),'stale count matches legacy nested search');
const cost=products.reduce((v,p)=>v+p.cost*p.stock,0);
assert.ok(element.innerHTML.includes('$'+cost.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})),
 'inventory value unchanged');
const first=element.innerHTML;
ctx.pos234RenderSummary();
assert.equal(element.innerHTML,first,'repeat reports deterministic');
// Simulate adding invoice before re-opening, verify no stale cache.
sales.push({date:ago(1),items:[{id:10,barcode:'J'}]});
ctx.pos234RenderSummary();
const updated=products.filter(p=>p.stock>0&&(!naiveLast(p)||(Date.now()-naiveLast(p))>15*86400000)).length;
assert.ok(element.innerHTML.includes('<b>'+updated+'</b>'));
console.log('R316 PASS: stock summary is lazy, accurate after changes, correctly handles cancelled sales, barcode matches, invalid dates and inventory valuations');
