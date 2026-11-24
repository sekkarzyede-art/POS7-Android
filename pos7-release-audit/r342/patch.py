from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
start=s.index('<script id="pos7-r212-batch-inventory">')
end=s.index('</script>',start)
pre=s[:start]; section=s[start:end]; after=s[end:]
section=section.replace('const MAX_BATCH=100;', 'const MAX_BATCH=30;')
assert 'const MAX_BATCH=30;' in section
first=section.index('async function step(){')
last=section.index('function finish(job){',first)
replacement='''async function reconcileAtomicBatch(job){
 const events=job.current?.events||[];
 if(job.current?.type!=='atomic'||events.length<1)throw Error('لا توجد دفعة معتمدة قابلة للمصالحة');
 window.POS7_R212_BATCH_ACTIVE=true;
 window.POS7_R213_COUNT_CORRECTION_ACTIVE=true;
 while(job.current.index<events.length){
  const event=events[job.current.index];
  window.POS7_R340_guard=event.guard;
  const result=await window.POS7_R166_reconcileCommittedInventory(event.id,event.payload);
  if(!['already_reconciled','local_reconciled_reload_required'].includes(result?.status))
    throw Error('لم يُؤكد تحديث التاب للصنف '+event.payload.barcode);
  if(!job.approved.some(x=>str(x.id)===str(event.id)))
   job.approved.push({id:event.id,barcode:event.payload.barcode,after:int(event.payload.counted_qty),reconciled:result.status});
  job.ids=job.ids.filter(x=>str(x)!==str(event.id));
  job.current.index++;
  save(job); // crash-safe durable cursor; R166 is itself idempotent.
  tell('تم تثبيت '+job.current.index+' من '+events.length+' صنفًا؛ جارٍ إكمال الدفعة');
 }
 job.current=null;job.state='running';save(job);finish(job);
}
async function step(){
 if(busy)return;
 const job=load();if(!job||job.state!=='running'||!job.ids?.length)return;
 busy=true;window.POS7_R212_BATCH_ACTIVE=true;window.POS7_R213_COUNT_CORRECTION_ACTIVE=!!job.ownerConfirmedCount;
 try{
  if(job.ids.length>30)throw Error('الحد الأقصى لدفعة الجرد 30 صنفًا');
  const {rows,snapshot,device}=await getCloud();
  const cloud=snapshot.sections.products;const events=[],distinctProducts=new Set();
  for(const id of job.ids){
   let row=rows.find(x=>str(x.event_id)===str(id));
   if(!row)throw Error('أحد طلبات الجرد لم يعد معلقًا؛ افحص حالته قبل إعادة المحاولة: '+id);
   if(![340,342].includes(job.version)||!job.confirmed?.[id]||
      job.confirmed[id].barcode!==str(row.payload?.barcode)||job.confirmed[id].count!==int(row.payload?.counted_qty))
      throw Error('تغير أحد الطلبات بعد التأكيد؛ افحص الدفعة مجددًا');
   if(str(row.payload?.batch_id)!==str(job.batch))throw Error('تغيرت هوية دفعة الجرد');
   if(!isSafe(row,cloud))throw Error('صنف ملتبس أو غير صالح للجرد: '+str(row.payload?.barcode));
   const matches=Object.values(cloud).filter(x=>str(x.barcode)===str(row.payload.barcode));
   if(matches.length!==1)throw Error('الباركود غير فريد على السحابة: '+str(row.payload.barcode));
   const matched=matches[0];
   if(distinctProducts.has(str(matched.id)))throw Error('الصنف مكرر مرتين في دفعة واحدة');
   distinctProducts.add(str(matched.id));
   const prepared=await window.P7Cloud.rpc('pos7_inventory_prepare_r340',{
     p_event_id:row.event_id,p_device:device,p_product_id:str(matched.id),
     p_barcode:str(row.payload.barcode),p_counted:int(row.payload.counted_qty)});
   if(prepared?.status!=='prepared')throw Error('لم يمكن تحضير '+str(row.payload.barcode)+': '+str(prepared?.reason));
   row={...row,payload:prepared.payload};cloud[str(row.payload.product_id)]=prepared.product;
   const repaired=await repairOne(row,snapshot,device);
   if(!repaired.ok)throw Error('فشل تثبيت هوية '+str(row.payload.barcode)+': '+repaired.reason);
   const check=window.POS7_R188_preflightInventory?.(row.event_id,row.payload,prepared.product);
   if(!check?.ok)throw Error('تعارض في بيانات التاب: '+str(check?.reason));
   events.push({id:str(row.event_id),payload:row.payload,guard:{...window.POS7_R340_guard}});
  }
  // The in-flight transaction identity is persisted BEFORE the RPC. If the reply is lost,
  // the client checks each server ACK and never starts a new commit blindly.
  job.current={type:'atomic',events,index:0,device};job.state='committing';save(job);
  tell('اعتماد '+events.length+' أصناف بمعاملة سحابية واحدة...');
  const result=await window.P7Cloud.rpc('pos7_inventory_commit_batch_atomic_r341',{
   p_ids:events.map(x=>x.id),p_device:device,p_verified_tablet_stock:true});
  if(result?.status!=='committed'||int(result?.count)!==events.length||!Array.isArray(result?.items)||result.items.length!==events.length)
    throw Error('نتيجة اعتماد الدفعة غير مؤكدة؛ سيتم فحص سجل السحابة قبل الاستكمال');
  job.state='reconciling';save(job);
  await reconcileAtomicBatch(job);
 }catch(e){
  const failed=load()||job;
  if(failed.state==='running')failed.state='paused';
  if(['committing','reconciling'].includes(failed.state))window.POS7_R167_RECONCILIATION_PENDING=true;
  failed.error=str(e.message||e);
  window.POS7_R212_BATCH_ACTIVE=false;window.POS7_R213_COUNT_CORRECTION_ACTIVE=false;
  save(failed);tell('دفعة محفوظة: '+failed.error+'؛ اضغط متابعة للتحقق من حالة اعتمادها');
 }finally{busy=false;}
}
'''
section=section[:first]+replacement+section[last:]
first=section.index('async function recover(){')
last=section.index('async function preview(){',first)
replacement='''async function recover(){
 const job=load();if(!job||busy)return;
 busy=true;
 try{
  if(['committing','reconciling'].includes(job.state)){
   const events=job.current?.events||[];
   if(job.current?.type!=='atomic'||events.length!==job.current.events.length)
     throw Error('سجل الدفعة غير مكتمل؛ لا يمكن إعادة إرسالها');
   const states=await Promise.all(events.map(async event=>{
    const found=await window.P7Cloud.req('/rest/v1/pos7_owner_commands?store_id=eq.pos7&event_id=eq.'+
     encodeURIComponent(event.id)+'&select=event_id,status,payload,result&limit=1');
    if(found?.length!==1)throw Error('تعذر التحقق من الطلب '+event.id);
    return found[0];
   }));
   const committed=states.every((r,i)=>r.status==='processed'&&r.result?.commit_protocol==='r155'&&
      str(r.result.event_id)===str(events[i].id)&&r.result.status==='committed');
   const pending=states.every(r=>r.status==='pending');
   if(committed){
    job.state='reconciling';save(job);
    window.POS7_R167_RECONCILIATION_PENDING=false;
    await reconcileAtomicBatch(job);return;
   }
   if(pending){
    job.state='paused';save(job);window.POS7_R167_RECONCILIATION_PENDING=false;
    tell('الدفعة لم تثبت في السحابة؛ راجعها ثم اضغط متابعة مرة ثانية لإعادة المحاولة');return;
   }
   throw Error('الدفعة بحالة مختلفة أو غير مؤكدة؛ أوقف الاعتماد حتى مراجعة السحابة');
  }
  if(job.state==='paused'){
    job.state='running';job.current=null;save(job);
    window.POS7_R167_RECONCILIATION_PENDING=false;
  }
 }catch(e){
  const failed=load()||job;
  failed.error=str(e.message||e);save(failed);
  tell('تعذر استكمال الدفعة بأمان: '+failed.error);return;
 }finally{busy=false;}
 resume();
}
'''
section=section[:first]+replacement+section[last:]
section=section.replace("if(j?.state==='reconciling'){window.POS7_R167_RECONCILIATION_PENDING=true;", "if(['reconciling','committing'].includes(j?.state)){window.POS7_R167_RECONCILIATION_PENDING=true;")
section=section.replace("save({version:340,batch,ids,confirmed:","save({version:342,batch,ids,confirmed:")
section=section.replace("'R340 — اعتماد الجرد الجديد'","'R342 — اعتماد الجرد الجديد'")
section=section.replace('R340 — اعتماد الجرد الجديد','R342 — اعتماد الجرد الجماعي')
section=section.replace('R340: أؤكد أن الكميات المجرودة','R342: أؤكد أن الكميات المجرودة')
section=section.replace("'هناك دفعة يجري اعتمادها؛ أكملها أولًا'", "'هناك دفعة سابقة محفوظة؛ أكملها أولًا'")
assert 'pos7_inventory_commit_batch_atomic_r341' in section
assert 'version:342' in section
p.write_text(pre+section+after,encoding='utf-8')
print('R342 atomic client patch applied')