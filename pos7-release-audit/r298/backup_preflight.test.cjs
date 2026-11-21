const assert=require('node:assert/strict');
const {inspect}=require('./backup_preflight.js');
const now=Date.parse('2026-11-22T00:00:00Z');
function sample(){
 return {app:'POS7',version:110,createdAt:'2026-11-21T23:30:00Z',kind:'manual',data:{
   products:[{id:1,name:'test'}],sales:[{id:'SAL-1'}],purchases:[{id:'PUR-1'}],
   customerPayments:[],supplierPayments:[],expenses:[],
   cashTransfers:[],cashClosings:[],cashAdjustments:[],
   customers:{},suppliers:{},cashOpening:{daily:0,main:0}
 }};
}
let n=0;
function t(name,fn){fn();console.log('PASS '+(++n)+' '+name);}
t('valid backup format but never allows publishing',()=>{const r=inspect(JSON.stringify(sample()),'tab1',now);assert.equal(r.ok,true);assert.equal(r.canPublish,false);assert.equal(r.safeToRestore,false);});
t('refuse unknown branch',()=>assert.equal(inspect(JSON.stringify(sample()),'other',now).ok,false));
t('refuse corrupt JSON',()=>assert.ok(inspect('{','tab1',now).errors.includes('invalid_json')));
t('refuse wrong app',()=>{let b=sample();b.app='OTHER';assert.ok(inspect(JSON.stringify(b),'tab1',now).errors.includes('not_pos7_backup'));});
t('refuse missing products',()=>{let b=sample();delete b.data.products;assert.ok(inspect(JSON.stringify(b),'tab1',now).errors.includes('missing_array_products'));});
t('refuse missing cashOpening',()=>{let b=sample();delete b.data.cashOpening;assert.ok(inspect(JSON.stringify(b),'tab1',now).errors.includes('missing_object_cashOpening'));});
t('refuse missing customer payments',()=>{let b=sample();delete b.data.customerPayments;assert.equal(inspect(JSON.stringify(b),'tab1',now).ok,false);});
t('reject duplicate product IDs',()=>{let b=sample();b.data.products.push({id:1});assert.ok(inspect(JSON.stringify(b),'tab1',now).errors.includes('duplicate_ids_products'));});
t('reject duplicate invoice IDs',()=>{let b=sample();b.data.sales.push({id:'SAL-1'});assert.ok(inspect(JSON.stringify(b),'tab1',now).errors.includes('duplicate_ids_sales'));});
t('reject invalid records',()=>{let b=sample();b.data.purchases.push(null);assert.equal(inspect(JSON.stringify(b),'tab1',now).ok,false);});
t('reject future creation dates',()=>{let b=sample();b.createdAt='2026-11-23T23:30:00Z';assert.ok(inspect(JSON.stringify(b),'tab1',now).errors.includes('future_backup_date'));});
t('warn old backup',()=>{let b=sample();b.createdAt='2026-11-18T20:00:00Z';assert.ok(inspect(JSON.stringify(b),'tab1',now).warnings.includes('backup_older_than_24h'));});
t('refuse huge strings',()=>assert.ok(inspect('x'.repeat(80*1024*1024+1),'tab1',now).errors.includes('backup_file_too_large_or_invalid')));
t('branch marker never authorizes owner identity',()=>{let b=sample();b.branch='tab1';const r=inspect(JSON.stringify(b),'tab1',now);assert.equal(r.canPublish,false);assert.ok(r.warnings.includes('backup_store_marker_is_untrusted'));});
t('always flags unverified cloud data',()=>{let r=inspect(JSON.stringify(sample()),'tab1',now);assert.ok(r.warnings.includes('cloud_revision_not_verified'));});
console.log('PASS '+n+' backup preflight assertions');
