from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text('utf-8')
assert 'function r362Eligible(' not in s
# Input: exact R257 based on R256 batch build (R350 is replaced, not chained).
assert 'function recoverLocalReviewsR350' not in s

def rep(a,b):
 global s
 assert s.count(a)==1,(a[:130],s.count(a))
 s=s.replace(a,b,1)

rep('function matches(r,i,b){', '''// R362: Store2 count is a proposal, not a revision-based write. Keep original count
// and identity; only the approved tablet may establish a missing baseline revision.
const r362Store=c=>c.url==='https://rmskuolsiqbzxuakofpb.supabase.co';
const r362Norm=v=>{const b=String(v??'').trim().replace(/[٠-٩۰-۹]/g,k=>String(k.charCodeAt(0)-(k.charCodeAt(0)>=0x6f0?0x6f0:0x660)));return /^\\d+$/.test(b)?b.replace(/^0+(?=\\d)/,''):b};
const r362Rev=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=999999999999998;
function r362Index(products){const ids=new Map(),bars=new Map();for(const p of Object.values(products||{})){const id=String(p?.id??''),bar=r362Norm(p?.barcode);ids.set(id,(ids.get(id)||0)+1);bars.set(bar,(bars.get(bar)||0)+1);}return {ids,bars};}
function r362Eligible(c,i,products,index){
 const p=products?.[i.product_id];if(!r362Store(c))return eligible(i,p);
 const n=r362Norm(i.barcode),id=Number(i.product_id);
 return !!p&&String(p.id)===i.product_id&&String(id)===i.product_id&&Number.isSafeInteger(id)&&id>0&&String(p.barcode||'')===i.barcode&&!!n&&index.ids.get(i.product_id)===1&&index.bars.get(n)===1&&typeof p.stock==='number'&&Number.isSafeInteger(p.stock)&&Number.isSafeInteger(i.baseline_qty)&&Number.isSafeInteger(i.counted_qty)&&i.counted_qty>=0&&r362Rev(i.stock_revision)&&(p.stock_revision==null||r362Rev(p.stock_revision));
}
function matches(r,i,b){''')
# Pump uses same stable UUID and original payload; store1 remains exact old eligibility.
rep("catalog=null;const products=await cat();for(const i of missing){if(!eligible(i,products[i.product_id]))", "catalog=null;const products=await cat(),r362Idx=r362Store(c)?r362Index(products):null;for(const i of missing){if(!r362Eligible(c,i,products,r362Idx))")
# Avoid another active pending row of same ID before send; only for store2.
rep("ensure(c);const d=device(c),payload=missing.map(i=>", """if(r362Store(c)){
   const pend=await get(c,'pos7_owner_commands?store_id=eq.pos7&event_type=eq.inventory_count&status=eq.pending&payload->>product_id=in.('+missing.map(i=>encodeURIComponent(i.product_id)).join(',')+')&select=event_id,payload');
   for(const i of missing)if(pend.some(r=>String(r.payload?.product_id)===i.product_id)){i.state='review';i.reason='يوجد طلب جرد معلق لهذا الصنف';}persist(c,q);missing=missing.filter(i=>i.state==='queued');if(!missing.length)continue;
  }
  ensure(c);const d=device(c),payload=missing.map(i=>""")
rep('function makeEntries(counts,scope){', '''// R362: recover only unsent, locally retained review proposals. No remote rejection
// is replayed. Confirm the saved physical count is still current before creating UUIDs.
async function recoverLocalReviewsR362(c,q){
 if(!r362Store(c))return 0;ensure(c);
 const counts=read('pos7-r71-count:'+c.uid,{}),meta=read('pos7-r107-count-meta:'+c.uid,{}),ledger=read('pos7-r256-approved:'+c.uid,{}),legacy=read('pos7-r105-transfer:'+c.uid,null);
 const held=new Set(['pending','complete','acknowledged'].includes(legacy?.status)?(legacy.items||[]).map(i=>String(i.product_id)):[]);
 const active=q.flatMap(b=>b.items.filter(i=>!i.superseded));
 const reasons=['تغيرت الكمية أو الهوية أو المراجعة','مراجعة المخزون أو الهوية غير مطابقة؛ أعد عدّ الصنف بعد تحديث الكتالوج'];
 const candidates=active.filter(i=>i.state==='review'&&reasons.includes(i.reason)&&rx.test(i.event_id||'')&&active.filter(x=>x.product_id===i.product_id).length===1&&Number.isSafeInteger(i.baseline_qty)&&Number.isSafeInteger(i.counted_qty)&&i.counted_qty>=0&&counts[i.product_id]===i.counted_qty&&meta[i.product_id]?.counted_qty===i.counted_qty&&meta[i.product_id]?.baseline_qty===i.baseline_qty&&String(meta[i.product_id]?.barcode||'')===i.barcode&&!Object.hasOwn(ledger,i.product_id)&&!held.has(i.product_id)&&!window.POS7R256IsCountLocked?.(c.uid,i.product_id)&&!window.POS7R199PendingProduct?.(c.uid,i.product_id));
 if(!candidates.length)return 0;
 const catalog=await snapshot(c),index=r362Index(catalog),safe=[];
 for(const i of candidates){
  const rev=i.stock_revision==null?0:i.stock_revision;
  if(!r362Eligible(c,{...i,stock_revision:rev},catalog,index))continue;
  const old=await get(c,'pos7_owner_commands?store_id=eq.pos7&event_id=eq.'+encodeURIComponent(i.event_id)+'&select=event_id,status&limit=1');if(old.length)continue;
  const pending=await get(c,'pos7_owner_commands?store_id=eq.pos7&event_type=eq.inventory_count&status=eq.pending&payload->>product_id=eq.'+encodeURIComponent(i.product_id)+'&select=event_id&limit=1');if(pending.length)continue;
  safe.push({i,rev});
 }
 if(!safe.length)return 0;ensure(c);
 if(!confirm('تمت مطابقة هوية '+safe.length+' صنفًا محفوظًا للمراجعة. هل تؤكد أن الكميات المجرودة هي الرصيد الفعلي الآن؟ سيتم إرسالها لاعتماد التاب؛ لا تتغير الأصناف المعتمدة.'))return 0;ensure(c);
 const recovered=safe.map(({i,rev})=>({...i,event_id:uuid(),stock_revision:rev,state:'queued',reason:undefined,superseded:false}));
 for(const {i} of safe)i.superseded=true;
 for(let n=0;n<recovered.length;n+=MAX)q.push({id:uuid(),items:recovered.slice(n,n+MAX)});persist(c,q);return recovered.length;
}
function makeEntries(counts,scope){''')
rep('const q=queue(c.uid);if(add){const legacy=', 'const q=queue(c.uid);if(add){await recoverLocalReviewsR362(c,q);const legacy=')
rep("confirm('إرسال '+entries.length+' صنفًا في دفعات لا تتجاوز 30؟')", "confirm('إرسال '+entries.length+' صنفًا في دفعات لا تتجاوز 30؟'+(r362Store(c)?' أكد أن الأعداد تمثل المخزون الفعلي الآن؛ الاعتماد النهائي في التاب.':''))")
rep("stock_revision:m.stock_revision??null,state:'queued'", "stock_revision:m.stock_revision??(r362Store(c)?0:null),state:'queued'")
# Unknown revision 0 is only a proposal transport placeholder; no local data revision changed.
# R362 keeps R256 validation and requires actual barcode + integer baseline in pump.
p.write_text(s,'utf-8')
print('R362 phone patch OK')
