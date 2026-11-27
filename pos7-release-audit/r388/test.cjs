const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const base=fs.readFileSync(process.argv[2],'utf8'),h=fs.readFileSync(process.argv[3],'utf8');
function block(html,id){
 const a=html.indexOf('id="'+id+'"');
 assert(a>=0,id);
 const start=html.lastIndexOf('<',a),end=html.indexOf(id.endsWith('-style')?'</style>':'</script>',a);
 assert(end>=0,id);
 return html.slice(start,end);
}
for(const id of ['pos7-r375-tabs-style','pos7-r375-tabs-ui','pos7-r376-credit-payout','pos7-r325-safe-sync']){
 assert.equal(block(h,id),block(base,id),id);
}
assert(h.includes('jdcolkgzwqpwbfvcrdje')&&!h.includes('rmskuolsiqbzxuakofpb'));
assert(!h.includes('POS7_RESTORE_PENDING_R305'));
const elements=new Map(),storage=new Map();
const c=vm.createContext({state:{products:[{id:1,stock:10.5}],sales:[],purchases:[]},saleCart:[{id:1,qty:1}],window:{},document:{getElementById:id=>elements.get(id)},nv:Number,originalSaleQty:()=>0,pos7AllowNegativeStock:()=>false,renderCart:()=>{},setTimeout:()=>{},toast:()=>{},localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)}});
const segment=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
vm.runInContext(segment('function pos7R388Barcode','function renderProducts'),c);
vm.runInContext(h.split('\n').find(l=>l.startsWith('function setSaleQty(')),c);
vm.runInContext('setSaleQty(1,0.5)',c);
assert.equal(c.saleCart[0].qty,0.5);
vm.runInContext('setSaleQty(1,1.25)',c);
assert.equal(c.saleCart[0].qty,1.25);
assert.equal(vm.runInContext("pos7R388Barcode('٠٠١٢٣')",c),'123');
const write=h.split('\n').find(l=>l.startsWith('function write(nextSlots=slots,nextActive=active)'));
vm.runInContext("let slots=[],active=0,lastDraftBody,lastDraftRaw,storageWarned;const KEY='basket';let writes=0;const store=localStorage.setItem;localStorage.setItem=(k,v)=>{writes++;store(k,v)};"+write,c);
assert.equal(vm.runInContext('write();write();write();writes',c),1);
assert.equal(vm.runInContext('storageWarned=false;write([{qty:0.5}],1);writes',c),2);
const audit=block(h,'pos7-r388-backup-audit');
vm.runInContext('function validBackup(b){return b?.app==="POS7"}\n'+audit.slice(audit.indexOf('>')+1),c);
const report=vm.runInContext("pos7R388AuditBackup({app:'POS7',data:{products:[{id:1,barcode:'00123',stock:9.5},{id:2,barcode:'١٢٣',stock:-3}],sales:[],purchases:[]}})",c);
assert.equal(report.fractionalStock,1);
assert.equal(report.negativeStock,1);
assert.equal(report.barcodeConflicts.length,1);
assert.equal(vm.runInContext("pos7R388HasReferences({products:[],inventoryAdjustments:[{productId:1}]},{id:1})",c),true);
console.log('R388: UI and store isolation, fractions, basket writes and read-only backup checks passed');
