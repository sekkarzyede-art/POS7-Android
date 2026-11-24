const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||'R340/index.html','utf8');
const code=html.match(/<script id="pos7-r342-no-duplicate-sku">([\s\S]*?)<\/script>/)[1];
const rows=[
 {barcode:'08000500380642',name:'نيوتيلا بسكوت' /* ambiguous already */},
 {barcode:'08000500224403',name:'نيوتيلا بي ريدي' /* unique normalized */},
 {barcode:'000777',name:'item 777 A'},
 {barcode:'777',name:'item 777 B'},
 {barcode:'92345',name:'new item'}
];
const state={products:[{id:1,barcode:'8000500380642',name:'Nutella A'},{id:2,barcode:'08000500380642',name:'Nutella B'},{id:3,barcode:'8000500224403',name:'Nutella Ready'}]};
let previews=0,confirms=0,saved=[];
const funcs={saveProduct(){},addPurchaseLine(){},savePurchase(){},async previewProductsImport(){return true},confirmProductsImport(){confirms++;saved=rows.filter(x=>!x.status).map(x=>x.barcode)},renderProductsImportPreview(){previews++}};
const c={state,pos109ImportRows:rows,editingProductId:null,purchaseCart:[],normalizeBarcode:x=>String(x).trim(),toast(){},alert(){},peekNextBarcode:()=>111,document:{readyState:'loading',addEventListener(){},getElementById:id=>id==='productImportMode'?{value:'merge'}:null},...funcs,window:{...funcs}};
vm.createContext(c);vm.runInContext(code,c);
(async()=>{
 await c.window.previewProductsImport();
 assert.match(rows[0].status,/تعارض/,'ambiguous preexisting ID rejected');
 assert.equal(rows[1].barcode,'8000500224403','unique canonical barcode reused');
 assert.match(rows[2].status,/تعارض/);assert.match(rows[3].status,/تعارض/);
 assert.equal(rows[4].status,undefined);
 c.window.confirmProductsImport();assert.equal(confirms,1);
 assert.deepEqual(saved,['8000500224403','92345']);
 assert.ok(previews>=1);assert.equal(state.products.length,3);
 console.log('PASS R342 import: existing collision excluded, duplicate import lines excluded, unique alias normalized without loss');
})().catch(e=>{console.error(e);process.exitCode=1});