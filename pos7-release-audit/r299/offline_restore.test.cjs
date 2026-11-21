const assert=require('node:assert/strict');
const R=require('./offline_restore.js');
function store(initial={},rejectKey=''){
 const m=new Map(Object.entries(initial));
 return {getItem:k=>m.has(k)?m.get(k):null,setItem(k,v){if(k===rejectKey)throw Error('quota');m.set(k,String(v));},removeItem:k=>m.delete(k),m};
}
const now=new Date().toISOString();
const state={products:[{id:'p1'}],sales:[{id:'SAL-000001'}],purchases:[],customerPayments:[],supplierPayments:[],
expenses:[],cashTransfers:[],cashClosings:[],cashAdjustments:[],customers:{},suppliers:{},cashOpening:{daily:0,main:0}};
const valid=JSON.stringify({app:'POS7',version:110,createdAt:now,kind:'manual',data:state});
let n=0;
function test(label,fn){fn();console.log('PASS '+(++n)+' '+label);}
test('offline restore of new empty device',()=>{const s=store();let r=R.recover(valid,'tab1',s,{nativeOfflineGate:true});assert.equal(r.ok,true);assert.equal(r.canPublish,false);assert.equal(JSON.parse(s.getItem(R.DATA_KEY)).sales[0].id,'SAL-000001')});
test('no native isolation prohibits modification',()=>{const s=store();assert.throws(()=>R.recover(valid,'tab1',s),/native_network/);assert.equal(s.getItem(R.DATA_KEY),null)});
test('invalid branch rejected',()=>{const s=store();assert.throws(()=>R.recover(valid,'tab3',s,{nativeOfflineGate:true}),/preflight_failed/);assert.equal(s.getItem(R.DATA_KEY),null)});
test('old tablet nonempty state protected',()=>{const old=JSON.stringify({...state,sales:[{id:'OLD'}]});const s=store({[R.DATA_KEY]:old});assert.throws(()=>R.recover(valid,'tab1',s,{nativeOfflineGate:true}),/existing_live_records/);assert.equal(s.getItem(R.DATA_KEY),old)});
test('empty state gets rollback before applying',()=>{const old=JSON.stringify({...state,sales:[],products:[]});const s=store({[R.DATA_KEY]:old});R.recover(valid,'tab1',s,{nativeOfflineGate:true});assert.equal(s.getItem(R.ROLLBACK_KEY),old)});
test('duplicate invoices blocked before state write',()=>{const p=JSON.parse(valid);p.data.sales.push({id:'SAL-000001'});const s=store();assert.throws(()=>R.recover(JSON.stringify(p),'tab1',s,{nativeOfflineGate:true}),/preflight_failed/);assert.equal(s.getItem(R.DATA_KEY),null)});
test('invalid backup does not overwrite',()=>{const s=store();assert.throws(()=>R.recover('not json','tab1',s,{nativeOfflineGate:true}));assert.equal(s.getItem(R.DATA_KEY),null)});
test('corrupt previous state blocks any overwrite',()=>{const s=store({[R.DATA_KEY]:'not json'});assert.throws(()=>R.recover(valid,'tab1',s,{nativeOfflineGate:true}),/local_state_corrupt/);assert.equal(s.getItem(R.DATA_KEY),'not json')});
test('storage quota during state copy recovers old state',()=>{const old=JSON.stringify({...state,sales:[],products:[]});const s=store({[R.DATA_KEY]:old},R.DATA_KEY);assert.throws(()=>R.recover(valid,'tab1',s,{nativeOfflineGate:true}),/quota/);assert.equal(s.getItem(R.DATA_KEY),old)});
test('rollback reservation quota preserves original',()=>{const old=JSON.stringify({...state,sales:[],products:[]});const s=store({[R.DATA_KEY]:old},R.ROLLBACK_KEY);assert.throws(()=>R.recover(valid,'tab1',s,{nativeOfflineGate:true}),/quota/);assert.equal(s.getItem(R.DATA_KEY),old)});
test('metadata quota rolls back newly restored state',()=>{const s=store({},R.RESTORED_META);assert.throws(()=>R.recover(valid,'tab1',s,{nativeOfflineGate:true}),/quota/);assert.equal(s.getItem(R.DATA_KEY),null)});
test('no repeated restore after success',()=>{const s=store();R.recover(valid,'tab2',s,{nativeOfflineGate:true});assert.throws(()=>R.recover(valid,'tab2',s,{nativeOfflineGate:true}),/already_restored/);assert.equal(JSON.parse(s.getItem(R.RESTORED_META)).branch,'tab2')});
console.log('PASS '+n+' R299 tests');
