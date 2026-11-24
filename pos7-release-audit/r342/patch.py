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
 job.softGuards=events.map(x=>x.guard);job.current=null;job.state='running';save(job);finish(job);
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
# R342 soft in-memory refresh: preserve native durable state, fall back to reload on ambiguity.
fin_start=section.index('function finish(job){')
fin_end=section.index('function resume(){',fin_start)
finish_code='''function pos342SoftRefresh(job){
 if(!job.approved.length)return true;
 if(window.P7TabletTest?.cashierBusy())return false;
 const raw=localStorage.getItem(DB),guards=job.softGuards||[];
 if(!raw||!guards.length||guards.length!==job.approved.length)return false;
 let durable;try{durable=JSON.parse(raw)}catch(e){return false}
 if(!Array.isArray(durable.products)||!Array.isArray(state?.products)||
    durable.products.length!==state.products.length||!durable.pos7InventoryApplied)return false;
 const candidates=[],seen=new Set();
 for(const guard of guards){
  if(!guard||seen.has(str(guard.localId)))return false;
  seen.add(str(guard.localId));
  const live=state.products.filter(p=>str(p.id)===str(guard.localId));
  const saved=durable.products.filter(p=>str(p.id)===str(guard.localId));
  if(live.length!==1||saved.length!==1||
     live[0].stock!==guard.stock||live[0].stock_revision!==guard.revision||
     !durable.pos7InventoryApplied[guard.eventId]||
     !Number.isSafeInteger(Number(saved[0].stock))||!Number.isSafeInteger(Number(saved[0].stock_revision)))return false;
  candidates.push({live:live[0],saved:saved[0]});
 }
 if(localStorage.getItem(DB)!==raw)return false;
 for(const {live,saved} of candidates){
  live.stock=saved.stock;live.stock_revision=saved.stock_revision;
  live.stock_revision_untrusted=saved.stock_revision_untrusted;
 }
 state.pos7InventoryApplied=durable.pos7InventoryApplied;
 state.inventoryAdjustments=durable.inventoryAdjustments;
 window.POS7_R166_RELOAD_REQUIRED=false;
 window.POS7_R167_RECONCILIATION_PENDING=false;
 try{
  if(typeof renderStock==='function')renderStock();
  if(typeof renderProducts==='function')renderProducts();
  if(typeof renderHome==='function')renderHome();
 }catch(e){return false}
 return true;
}
function finish(job){
 job.state='complete';save(job);
 window.POS7_R212_BATCH_ACTIVE=false;window.POS7_R213_COUNT_CORRECTION_ACTIVE=false;
 const softOk=pos342SoftRefresh(job);
 tell('انتهت الدفعة: اعتمد '+job.approved.length+'، استُبعد '+job.issues.length+
  '. '+(softOk?'تم تحديث التاب دون إعادة تشغيل.':'ستُحدّث الذاكرة بعد إعادة تحميل آمنة.'));
 if(job.approved.length&&!softOk)window.location.reload();
}
'''
section=section[:fin_start]+finish_code+section[fin_end:]
# Insert a new guarded product registration and purchase shim after the batch code.
# Extract its exact contents from the committed patch file's adjacent text-free Python constant.
sku_guard = r'''<script id="pos7-r342-no-duplicate-sku">
(function(){
 'use strict';
 // Product identities are case- and leading-zero-normalized for creation only.
 // Existing records and historical invoice references are never altered by this guard.
 const base=v=>typeof normalizeBarcode==='function'?normalizeBarcode(v):String(v??'').trim().toLowerCase();
 const key=v=>{const x=base(v);return /^[0-9]+$/.test(x)?x.replace(/^0+(?=\d)/,''):x};
 const matches=bc=>(state?.products||[]).filter(p=>key(p.barcode)===key(bc));
 const warn=(message)=>{if(typeof toast==='function')toast(message);else alert(message);return false};
 window.POS7_R342_duplicateCandidates=bc=>matches(bc).map(p=>({id:p.id,name:p.name,barcode:p.barcode,stock:p.stock}));
 const originalSave=window.saveProduct;
 if(typeof originalSave==='function'&&!originalSave._pos342BarcodeGuard){
  const wrapped=function(){
   const barcode=String(document.getElementById('mBarcode')?.value||'').trim() ||
    (typeof peekNextBarcode==='function'?String(peekNextBarcode()):'');
   if(!barcode)return warn('أدخل باركود الصنف');
   const current=typeof editingProductId==='undefined'?null:editingProductId;
   const existing=matches(barcode).filter(p=>String(p.id)!==String(current));
   if(existing.length)return warn('الباركود مستخدم لصنف موجود (قد يختلف بصفر في البداية). راجع الأصناف أولًا: '+existing.map(p=>p.name).join('، '));
   return originalSave.apply(this,arguments);
  };
  wrapped._pos342BarcodeGuard=true;window.saveProduct=saveProduct=wrapped;
 }
 const originalAdd=window.addPurchaseLine;
 if(typeof originalAdd==='function'&&!originalAdd._pos342BarcodeGuard){
  const wrapped=function(){
   const field=document.getElementById('pBarcode');const barcode=String(field?.value||'').trim();
   if(barcode){
    const list=matches(barcode),exact=list.filter(p=>String(p.barcode)===barcode);
    if(list.length&&exact.length===0){
     if(list.length===1){field.value=String(list[0].barcode);} // Existing SKU, never create a duplicate barcode.
     else return warn('الباركود يعود إلى أكثر من سجل؛ افتح تعريف الصنف واختر الباركود الأصلي قبل الشراء');
    }
   }
   return originalAdd.apply(this,arguments);
  };
  wrapped._pos342BarcodeGuard=true;window.addPurchaseLine=addPurchaseLine=wrapped;
 }
 const originalPurchase=window.savePurchase;
 if(typeof originalPurchase==='function'&&!originalPurchase._pos342BarcodeGuard){
  const wrapped=function(){
   for(const item of (typeof purchaseCart!=='undefined'?purchaseCart:[])){
    const barcode=String(item?.barcode||'').trim();if(!barcode)continue;
    const list=matches(barcode);
    if(list.length&&!list.some(p=>String(p.barcode)===barcode))
      return warn('تعذر حفظ صنف جديد بباركود مكرر بصفر مختلف. صحح الصنف أولًا: '+barcode);
   }
   return originalPurchase.apply(this,arguments);
  };
  wrapped._pos342BarcodeGuard=true;window.savePurchase=savePurchase=wrapped;
 }
 function attachReview(){
  const modal=document.getElementById('productModal');const content=modal?.querySelector('.modalbox')||modal;
  if(!content||document.getElementById('pos342BarcodeReview'))return;
  const section=document.createElement('div');section.id='pos342BarcodeReview';section.style.cssText='margin:8px 0;padding:8px;border:1px solid #bac8d7;border-radius:8px';
  section.innerHTML='<button type="button" id="pos342ReviewButton" style="padding:8px">مراجعة الباركود والأصناف المتطابقة</button><div id="pos342ReviewResult" style="margin-top:6px;white-space:pre-wrap"></div>';
  content.appendChild(section);
  document.getElementById('pos342ReviewButton').onclick=()=>{
   const barcode=String(document.getElementById('mBarcode')?.value||'').trim(),rows=matches(barcode);
   document.getElementById('pos342ReviewResult').textContent=!barcode?'أدخل الباركود أولًا':rows.length?
    'وجدت '+rows.length+' سجلًا. لا يتم دمج المخزون تلقائيًا.\n'+rows.map(p=>p.name+' | '+p.barcode+' | معرف '+p.id+' | الكمية '+p.stock).join('\n'):
    'لا توجد أصناف بنفس الباركود بعد توحيد الصفر.';
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachReview);else attachReview();
})();
</script>
'''
assert '<script id="pos7-r342-no-duplicate-sku">' not in after
p.write_text(pre+section+after+sku_guard,encoding='utf-8')
print('R342 atomic client patch applied')