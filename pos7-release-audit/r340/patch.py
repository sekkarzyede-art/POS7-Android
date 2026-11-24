from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a))
 s=s.replace(a,b)
helper='''
window.POS7_R340_local=function(products,id,barcode){
 const rows=(products||[]).filter(x=>String(x.barcode)===String(barcode));
 if(rows.length!==1)return [];
 if(!window.POS7_R213_COUNT_CORRECTION_ACTIVE&&String(rows[0].id)!==String(id))return [];
 if((products||[]).filter(x=>String(x.id)===String(rows[0].id)).length!==1)return [];
 return rows;
};
'''
rep("window.POS7_R166_reconcileCommittedInventory=async function(eventId, payload){",helper+"window.POS7_R166_reconcileCommittedInventory=async function(eventId, payload){")
rep("const matches=local.products.filter(p=>String(p.id)===id&&String(p.barcode)===barcode);","const matches=window.POS7_R340_local(local.products,id,barcode);")
rep("const p=matches[0];\n const applied=", "const p=matches[0],localId=String(p.id);\n const applied=")
rep("if(!Number.isSafeInteger(expectedRevision)||((p.stock_revision_untrusted!==true)&&Number(p.stock_revision)!==expectedRevision))fail('local_revision_changed_manual_review');", """const guard=window.POS7_R340_guard;
 if(window.POS7_R213_COUNT_CORRECTION_ACTIVE){
  if(!guard||guard.eventId!==String(eventId)||guard.localId!==localId||guard.stock!==p.stock||guard.revision!==p.stock_revision)fail('local_changed_since_confirmation');
 }else if(!Number.isSafeInteger(expectedRevision)||((p.stock_revision_untrusted!==true)&&Number(p.stock_revision)!==expectedRevision))fail('local_revision_changed_manual_review');""")
rep("productId:id,before:beforeLocal,cloudBefore:baseline", "productId:localId,cloudProductId:id,before:beforeLocal,cloudBefore:baseline")
rep("verify.products.filter(x=>String(x.id)===id&&Number(x.stock)===after", "verify.products.filter(x=>String(x.id)===localId&&Number(x.stock)===after")
rep("const matches=data.products.filter(p=>String(p.id)===id&&String(p.barcode)===barcode);", "const matches=window.POS7_R340_local(data.products,id,barcode);")
start=s.index('const isSafe=(row,cloud)=>{',s.index('id="pos7-r212-batch-inventory"'));end=s.index('async function getCloud()',start)
s=s[:start]+'''const isSafe=(row,cloud)=>{
 const p=row.payload||{},bar=str(p.barcode);
 if(!bar||int(p.counted_qty)===null||int(p.counted_qty)<0)return false;
 const cs=Object.values(cloud).filter(c=>str(c.barcode)===bar);
 let local;try{local=JSON.parse(localStorage.getItem(DB)||'null')}catch(_){return false}
 const ls=(local?.products||[]).filter(c=>str(c.barcode)===bar);
 return cs.length===1&&ls.length===1&&int(ls[0].stock)!==null&&int(cs[0].stock)!==null&&int(cs[0].stock_revision)!==null&&cs[0].stock_revision_untrusted!==true;
};
'''+s[end:]
start=s.index('async function repairOne(row,snapshot,device){',s.index('id="pos7-r212-batch-inventory"'));end=s.index('let busy=false;',start)
s=s[:start]+'''async function repairOne(row,snapshot,device){
 const p=row.payload||{},local=JSON.parse(localStorage.getItem(DB)||'null');
 const entries=window.POS7_R340_local(local?.products,p.product_id,p.barcode);
 if(entries.length!==1)return {ok:false,reason:'باركود غير موجود أو مكرر؛ مراجعة هذا الصنف فقط'};
 const stored=entries[0];
 if(local.pos7InventoryApplied?.[row.event_id])return {ok:false,reason:'نفس الطلب معتمد سابقًا'};
 window.POS7_R340_guard={eventId:str(row.event_id),localId:str(stored.id),stock:stored.stock,revision:stored.stock_revision};
 return {ok:true};
}
'''+s[end:]
rep("const id=job.ids[0],row=rows.find", "const id=job.ids[0];let row=rows.find")
rep("const repaired=await repairOne(row,snapshot,device);", """const matches=Object.values(snapshot.sections.products).filter(x=>str(x.barcode)===str(row.payload.barcode));
  const prepared=await window.P7Cloud.rpc('pos7_inventory_prepare_r340',{p_event_id:row.event_id,p_device:device,p_product_id:str(matches[0].id),p_barcode:str(row.payload.barcode),p_counted:int(row.payload.counted_qty)});
  if(prepared.status!=='prepared'){job.issues.push(str(row.payload.barcode)+': '+str(prepared.reason));job.ids.shift();save(job);busy=false;return resume();}
  row={...row,payload:prepared.payload};snapshot.sections.products[str(row.payload.product_id)]=prepared.product;
  const repaired=await repairOne(row,snapshot,device);""")
rep("const result=await window.P7Cloud.rpc('pos7_inventory_commit_r155',{p_event_id:row.event_id,p_device:device});\n  if(!result", """job.current={row,guard:window.POS7_R340_guard};job.state='reconciling';save(job);
  const result=await window.P7Cloud.rpc('pos7_inventory_commit_r155',{p_event_id:row.event_id,p_device:device});
  if(!result""")
rep("const failed=load()||job;\n  failed.state='paused';", "const failed=load()||job;\n  if(failed.state!=='reconciling')failed.state='paused';\n  if(failed.state==='reconciling')window.POS7_R167_RECONCILIATION_PENDING=true;")
rep("async function preview(){", """async function recover(){
 const j=load();if(!j||busy)return;
 if(j.state==='reconciling'&&j.current){
  busy=true;
  try{
   const r=(await window.P7Cloud.req('/rest/v1/pos7_owner_commands?store_id=eq.pos7&event_id=eq.'+encodeURIComponent(j.current.row.event_id)+'&select=event_id,status,payload,result'))?.[0];
   if(!r)throw Error('تعذر تأكيد حالة الطلب');
   if(r.status==='processed'){
    window.POS7_R213_COUNT_CORRECTION_ACTIVE=true;window.POS7_R340_guard=j.current.guard;
    await window.POS7_R166_reconcileCommittedInventory(r.event_id,r.payload);
    j.approved.push({id:r.event_id,barcode:r.payload.barcode,after:r.result.after});j.ids.shift();
   }else if(r.status==='pending'){
    j.issues.push(j.current.row.payload.barcode+': لم يكتمل الاعتماد؛ يبقى الطلب متاحًا للمحاولة التالية');j.ids.shift();
   }else throw Error('حالة طلب غير متوقعة');
   window.POS7_R167_RECONCILIATION_PENDING=false;j.current=null;j.state='running';save(j);
  }catch(e){tell('تعذر استكمال تأكيد الحفظ: '+str(e.message));return}finally{busy=false}
 }else if(j.state==='paused'){j.state='running';save(j)}
 resume();
}
async function preview(){""")
a="el('r212-resume').onclick=()=>{const j=load();";start=s.index(a);end=s.index("\n el('r212-copy')",start);s=s[:start]+"el('r212-resume').onclick=recover;"+s[end:]
rep("if(window.POS7_R166_RELOAD_REQUIRED||window.POS7_R167_RECONCILIATION_PENDING)return false;if(afterCommit)","if(window.POS7_R166_RELOAD_REQUIRED||window.POS7_R167_RECONCILIATION_PENDING||window.POS7_R212_BATCH_ACTIVE)return false;if(afterCommit)")
rep("if(!confirm('R213: أؤكد", "if(window.P7TabletTest?.cashierBusy()){tell('أكمل الفاتورة المفتوحة أولًا ثم اعتمد الجرد');return;}\n    if(!confirm('R340: أؤكد")
s=s.replace('R213 — اعتماد الجرد الفعلي بضغطة واحدة','R340 — اعتماد الجرد الجديد')
s=s.replace('اختلاف السحابة أو هوية الصنف يوقف الصنف المتعارض.','اختلاف الكمية طبيعي، وكل طلب جديد يعتمد العدد المؤكد. تتم مطابقة الصنف بالباركود الفريد؛ الصنف الملتبس وحده يبقى للمراجعة.')
s=s.replace("'تعارض في الكمية أو هوية الصنف — ممنوع الاعتماد'","'تغيّرت الكمية أو الهوية؛ استخدم اعتماد الدفعة R340 أعلاه' بس".replace(' بس',''))
s=s.replace("'✅ اعتماد هذه الدفعة ('+safe.length+' مطابق)'","'✅ اعتماد الجرد الجديد ('+safe.length+' صنف)' م".replace(' م',''))
# On uncertain commit, retain a durable recovery record and block writes until resolved.
rep("const ss=()=>{try{return sessionStorage.getItem(KEY)}", "const ss=()=>{try{return localStorage.getItem(KEY)||sessionStorage.getItem(KEY)}")
rep("const save=o=>sessionStorage.setItem(KEY,JSON.stringify(o));", "const save=o=>{localStorage.setItem(KEY,JSON.stringify(o));sessionStorage.removeItem(KEY)};")
rep("const j=load();if(j&&j.state==='running'){", "const j=load();if(j?.state==='reconciling'){window.POS7_R167_RECONCILIATION_PENDING=true;tell('طلب محفوظ ينتظر تأكيد الحفظ؛ اضغط متابعة دفعة متوقفة');}\n if(j&&j.state==='running'){")
p.write_text(s)
print('R340 patched inventory preparation, barcode matching and recovery')
s=p.read_text()
s=s.replace("save({version:213,batch,ids,approved:[],issues:[],state:'running',ownerConfirmedCount:true})", "save({version:340,batch,ids,confirmed:Object.fromEntries(safe.map(r=>[str(r.event_id),{barcode:str(r.payload.barcode),count:int(r.payload.counted_qty)}])),approved:[],issues:[],state:'running',ownerConfirmedCount:true})")
s=s.replace("if(str(row.payload?.batch_id)!==str(job.batch))", "if(job.version!==340||!job.confirmed?.[id]||job.confirmed[id].barcode!==str(row.payload?.barcode)||job.confirmed[id].count!==int(row.payload?.counted_qty))throw Error('تغير الطلب بعد التأكيد؛ افحص الدفعة مجددًا');\n  if(str(row.payload?.batch_id)!==str(job.batch))")
p.write_text(s)
