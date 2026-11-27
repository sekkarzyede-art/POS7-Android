const fs=require('fs'),vm=require('vm'),assert=require('assert');
const h=fs.readFileSync(process.argv[2],'utf8');
let a=h.indexOf('/* POS7 R352'),b=h.indexOf('/* R354: integrated',a);vm.runInThisContext(h.slice(a,b));
a=h.indexOf('function pos7R384PrepareBackup');b=h.indexOf('function pos7R354OpenBackup',a);vm.runInThisContext(h.slice(a,b));
const p={id:123.5,barcode:'0123',name:'A',stock:0.5,stock_revision:0};
const b0={app:'POS7',data:{products:[p],sales:[{number:'S1',items:[{id:123.5,barcode:'0123',qty:3,price:7}]}],purchases:[],salesReturns:[],recordRevisions:[{snapshot:{items:[{id:123.5,barcode:'123'}]}}]}};
const original=JSON.stringify(b0),r=pos7R385RepairReferences(b0,POS7DataDoctorR351.run(b0));
assert.equal(JSON.stringify(b0),original);assert.equal(r.report.referenceRepairs.length,1);assert.equal(r.report.referenceRepairs[0].references.length,2);assert.equal(r.report.remaining.invalidIds,0);assert.equal(r.candidate.data.sales[0].items[0].price,7);assert.equal(r.candidate.data.products[0].stock,0.5);assert(r.candidate.pos7R354ExternalIdentityReviewRequired);
const bad=JSON.parse(original);bad.data.sales[0].items[0].barcode='999';const q=pos7R385RepairReferences(bad,POS7DataDoctorR351.run(bad));assert.equal(q.report.referenceRepairs.length,0);assert.equal(q.report.remaining.invalidIds,1);console.log('R385 reference repair checks passed');
