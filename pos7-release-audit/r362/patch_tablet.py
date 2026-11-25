from pathlib import Path
import sys,hashlib
p=Path(sys.argv[1]);raw=p.read_bytes();s=raw.decode('utf-8')
assert 'function r362Evidence(' not in s
# Exact R361 candidate before release version labeling.
assert hashlib.sha256(raw).hexdigest()=='7dd730e608fcb1ce6570511c5698c138f675d93b7855b10b79015f373e5b50cc'
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:130],s.count(a))
 s=s.replace(a,b,1)
rep('const isSafe=(row,cloud)=>{', '''// R362: an old untrusted revision is not an identity conflict. The approved
// tablet can propose a baseline only after exact unique identity + durable/live proof.
function r362Evidence(row,cloud,anchor=null){
 const r=row.payload?.r340_original||row.payload||{},id=str(r.product_id),bc=str(r.barcode),p=cloud?.[id];
 if(!id||!bc||!p||str(p.id)!==id||str(p.barcode)!==bc||!Number.isSafeInteger(Number(id))||String(Number(id))!==id||Number(id)<=0||typeof p.stock!=='number'||!Number.isSafeInteger(p.stock)||!Number.isSafeInteger(r.counted_qty)||r.counted_qty<0||parkedMatch(id,bc))return null;
 const revOK=v=>v==null||(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=999999999999998);
 if(!revOK(p.stock_revision))return null;
 const n=normal(bc);if(!n)return null;
 const matches=rows=>{if(!Array.isArray(rows))return null;const byId=rows.filter(z=>str(z.id)===id),byBar=rows.filter(z=>normal(z.barcode)===n);return byId.length===1&&byBar.length===1&&byId[0]===byBar[0]&&str(byId[0].barcode)===bc?byId[0]:null};
 const c=matches(Object.values(cloud)),raw=localStorage.getItem(DB);let data;try{data=JSON.parse(raw||'null')}catch(_){return null;}
 const d=matches(data?.products),l=matches(state?.products);
 if(c!==p||!d||!l||typeof d.stock!=='number'||!Number.isSafeInteger(d.stock)||d.stock!==l.stock||!revOK(d.stock_revision)||d.stock_revision!==l.stock_revision||d.stock_revision_untrusted!==l.stock_revision_untrusted||data.pos7InventoryApplied?.[row.event_id]||state.pos7InventoryApplied?.[row.event_id]||(data.inventoryAdjustments||[]).some(x=>str(x.cloudEventId)===str(row.event_id)))return null;
 if(anchor){try{if(anchor.eventId!==str(row.event_id)||anchor.localId!==id||anchor.barcode!==bc||!Number.isSafeInteger(pos7R343Target(data,d,anchor,r.counted_qty)))return null;}catch(_){return null;}}
 return {id,barcode:bc,localStock:d.stock,localRevision:d.stock_revision??null,cloudStock:p.stock,cloudRevision:p.stock_revision??null,cloudUntrusted:p.stock_revision_untrusted===true};
}
const isSafe=(row,cloud)=>{''')
rep("return cs.length===1&&ls.length===1&&!parkedMatch(cs[0].id,cs[0].barcode)&&!parkedMatch(ls[0].id,ls[0].barcode)&&int(ls[0].stock)!==null&&int(cs[0].stock)!==null&&int(cs[0].stock_revision)!==null&&cs[0].stock_revision_untrusted!==true;", """const ordinary=cs.length===1&&ls.length===1&&!parkedMatch(cs[0].id,cs[0].barcode)&&!parkedMatch(ls[0].id,ls[0].barcode)&&int(ls[0].stock)!==null&&int(cs[0].stock)!==null&&int(cs[0].stock_revision)!==null&&cs[0].stock_revision_untrusted!==true;
 return ordinary||!!r362Evidence(row,cloud);""")
rep("const prepared=await window.P7Cloud.rpc('pos7_inventory_prepare_tab2_r345',{\n     p_event_id:row.event_id,p_device:device,p_product_id:str(matched.id),\n     p_barcode:requestBarcode,p_counted:int(row.payload.counted_qty)});", """let prepared;
   const args={p_event_id:row.event_id,p_device:device,p_product_id:str(matched.id),p_barcode:requestBarcode,p_counted:int(row.payload.counted_qty)};
   if(!trustedRev(matched)){
    const anchor=job.anchors?.[id],proof=anchor&&r362Evidence(row,cloud,anchor);
    if(!job.ownerConfirmedCount||!proof){await exclude(id,'هوية أو حركة الصنف تحتاج مراجعة قبل تأسيس الرقم',row);continue;}
    prepared=await window.P7Cloud.rpc('pos7_inventory_prepare_tab2_r362',{...args,p_local_stock:proof.localStock,p_local_revision:proof.localRevision,p_cloud_stock:proof.cloudStock,p_cloud_revision:proof.cloudRevision,p_cloud_untrusted:proof.cloudUntrusted});
   }else prepared=await window.P7Cloud.rpc('pos7_inventory_prepare_tab2_r345',args);""")
# Make actual progress/status visible without overwriting repair error.
rep("if(repair.error)tell('تصحيح المراجعات: '+repair.error+'؛ الأصناف السليمة متاحة.');\n  const job=load();if(job)tell(","const job=load();if(job)tell(")
rep("+(job.error?' | '+job.error:''));\n }catch(e){host.textContent='تعذر الفحص:","+(job.error?' | '+job.error:''));\n  if(repair.error)tell((el('r212-status')?.textContent||'')+'\\nتصحيح المراجعات: '+repair.error+'؛ الأصناف السليمة متاحة.');\n }catch(e){host.textContent='تعذر الفحص:")
rep('R344 — اعتماد الجرد الجماعي</h3>', 'R362 — اعتماد الجرد الجماعي</h3>')
p.write_text(s,'utf-8');print('R362 tablet patch OK',hashlib.sha256(p.read_bytes()).hexdigest())
