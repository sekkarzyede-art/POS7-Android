const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||'R340/index.html','utf8');
const script=html.match(/<script id="pos7-r342-no-duplicate-sku">([\s\S]*?)<\/script>/);
assert.ok(script,'SKU guard must be shipped in HTML');
const values={mBarcode:'08000500380642',pBarcode:'08000500224403'};
const els=Object.fromEntries(Object.keys(values).map(k=>[k,{value:values[k]}]));
let productSaves=0,addLines=0,purchaseSaves=0,alerts=[];
const state={products:[{id:1,name:'نيوتيلا بسكوت',barcode:'8000500380642',stock:5},{id:2,name:'نيوتيلا ريدي',barcode:'8000500224403',stock:8}]};
const context={state,editingProductId:null,purchaseCart:[{barcode:'08000500380642'}],
 document:{readyState:'loading',getElementById:id=>els[id]||null,addEventListener(){}},
 normalizeBarcode:v=>String(v).trim(),peekNextBarcode:()=>'12345',
 toast:t=>alerts.push(t),alert:t=>alerts.push(t),
 saveProduct:()=>{productSaves++},addPurchaseLine:()=>{addLines++},savePurchase:()=>{purchaseSaves++},window:{}};
context.window.saveProduct=context.saveProduct;context.window.addPurchaseLine=context.addPurchaseLine;context.window.savePurchase=context.savePurchase;
vm.createContext(context);vm.runInContext(script[1],context);
assert.equal(context.window.saveProduct(),false);assert.equal(productSaves,0,'zero-prefix duplicate blocks new product');
assert.equal(context.window.addPurchaseLine(),undefined);assert.equal(addLines,1);assert.equal(els.pBarcode.value,'8000500224403','purchase resolves unique zero-prefixed alias');
assert.equal(context.window.savePurchase(),false);assert.equal(purchaseSaves,0,'purchase cannot create duplicate in final cart');
context.purchaseCart=[{barcode:'8000500224403'}];context.window.savePurchase();assert.equal(purchaseSaves,1,'existing SKU remains saleable');
context.editingProductId=1;context.window.saveProduct();assert.equal(productSaves,1,'editing original SKU allowed');
const cand=context.window.POS7_R342_duplicateCandidates('08000500380642');assert.equal(cand.length,1);assert.equal(cand[0].id,1);
assert.equal(state.products.length,2,'catalog left unchanged');
console.log('PASS R342 SKU: leading-zero duplicate rejected, unique alias mapped in purchase, canonical edit allowed, existing stock/invoices unchanged');