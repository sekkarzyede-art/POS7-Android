const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const h=fs.readFileSync(process.argv[2],'utf8'),a=h.indexOf('async function recoverLocalReviewsR350('),b=h.indexOf('function makeEntries(',a);
assert(a>=0&&b>a);
const code=h.slice(a,b),url='https://rmskuolsiqbzxuakofpb.supabase.co';
function fixture(o={}){
 let q=[{id:'old',items:[{event_id:'00000000-0000-4000-8000-000000000001',product_id:'1',barcode:'0123',baseline_qty:5,counted_qty:10,stock_revision:null,state:'review',reason:'تغيرت الكمية أو الهوية أو المراجعة',...(o.item||{})}]}];
 let p={'1':{id:'1',barcode:'0123',stock:5,stock_revision:1,stock_revision_untrusted:false,...(o.product||{})},...(o.catalog||{})};
 let read={ 'pos7-r71-count:u':{'1':10},'pos7-r107-count-meta:u':{'1':{counted_qty:10,baseline_qty:5,barcode:'0123'}},'pos7-r256-approved:u':o.ledger||{}},calls=[],writes=[],prompts=[],n=1,live=true;
 const c={url:o.url||url,uid:'u'};
 const ctx={q,c,MAX:30,rx:/^[0-9a-f-]{36}$/i,window:{POS7R256IsCountLocked:()=>o.lock||null,POS7R199PendingProduct:()=>!!o.localPending},ensure:()=>{if(!live)throw Error('store changed')},read:(k,d)=>read[k]||d,snapshot:async()=>{calls.push('snapshot');return p},get:async(c,path)=>{calls.push(path);if(o.changeStore){live=false;throw Error('store changed')}return path.includes('event_id=eq.')?(o.remote||[]):(o.pending||[])},confirm:t=>{prompts.push(t);return !o.cancel},uuid:()=>('00000000-0000-4000-8000-'+String(++n).padStart(12,'0')),persist:(c,q)=>writes.push(JSON.parse(JSON.stringify(q)))};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {q,c,calls,writes,prompts,run:()=>vm.runInContext('recoverLocalReviewsR350(c,q)',ctx)};
}
let n=0;async function t(name,fn){await fn();console.log('PASS',name);n++}
(async()=>{
 await t('recover metadata-only review with original quantity and new UUID',async()=>{let f=fixture();assert.equal(await f.run(),1);assert.equal(f.q[0].items[0].superseded,true);let i=f.q[1].items[0];assert.equal(i.stock_revision,1);assert.equal(i.counted_qty,10);assert.equal(i.baseline_qty,5);assert.equal(i.state,'queued');assert.notEqual(i.event_id,f.q[0].items[0].event_id);assert.equal(f.writes.length,1);assert.equal(await f.run(),0)});
 await t('Tab1 strictly unchanged',async()=>{let f=fixture({url:'https://jdcolkgzwqpwbfvcrdje.supabase.co'});assert.equal(await f.run(),0);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)});
 for(const [name,opts] of [['changed stock',{product:{stock:6}}],['changed barcode',{product:{barcode:'0124'}}],['ambiguous normalized barcode',{catalog:{'2':{id:'2',barcode:'123'}}}],['untrusted metadata',{product:{stock_revision_untrusted:true}}],['missing revision',{product:{stock_revision:null}}],['existing cloud event',{remote:[{event_id:'old',status:'processed'}]}],['different pending event',{pending:[{event_id:'other'}]}],['approved lock',{lock:'approved'}],['approved ledger',{ledger:{'1':{qty:10}}}],['server-rejected review',{item:{reason:'رفض التاب'}}],['confirmation cancelled',{cancel:true}]]){
 await t(name,async()=>{let f=fixture(opts);assert.equal(await f.run(),0);assert.equal(f.writes.length,0);assert.equal(f.q[0].items[0].superseded,undefined)})}
 await t('store switched during network read',async()=>{let f=fixture({changeStore:true});await assert.rejects(f.run(),/store changed/);assert.equal(f.writes.length,0)});
 assert(h.includes('if(add){await recoverLocalReviewsR350(c,q);const legacy='));
 console.log(n+'/14 review recovery tests PASS');
})().catch(e=>{console.error(e);process.exitCode=1});