 function movementRows(p,range){
  const rows=[],seenReturns=new Set();
  const normalizeCode=v=>String(v??'').trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)&15)).replace(/^0+(?=\d)/,'');
  const barcode=normalizeCode(p.barcode),id=String(p.id);
  function matches(line){
   const productId=line.productId??line.product_id??line.itemId??line.id;
   if(productId!=null&&String(productId)===id)return true;
   const code=normalizeCode(line.barcode??line.productBarcode);
   if(code)return !!barcode&&code===barcode;
   return productId==null&&norm(line.name||line.productName||line.product)===norm(p.name);
  }
  for(const [key,label,incoming,isReturn] of [['purchases','شراء',true,false],['sales','بيع',false,false],['salesReturns','مرتجع بيع',true,true],['purchaseReturns','مرتجع شراء',false,true],['purchasesReturns','مرتجع شراء',false,true],['supplierReturns','مرتجع شراء',false,true]]){
   for(const doc of state[key]||[]){
    if(!doc||doc.cancelled||doc.voided||doc.reversed||/^(cancelled|canceled|voided)$/i.test(doc.status||''))continue;
    const ts=Date.parse(doc.date);if(!Number.isFinite(ts)||ts<range.from||ts>range.to)continue;
    const ref=doc.number||doc.invoiceNo||doc.ref||doc.recordNo||doc.id||'';
    if(isReturn&&ref){const identity=label+':'+ref;if(seenReturns.has(identity))continue;seenReturns.add(identity);}
    let qty=0;
    for(const line of doc.items||[]){
     if(!line||!matches(line))continue;
     const amount=Number((isReturn?line.stockQty:null)??line.qty??line.quantity);if(Number.isFinite(amount)&&amount>0)qty+=amount;
    }
    if(qty>0)rows.push({ts,date:doc.date,label,ref,party:doc.customer||doc.supplier||'',incoming:incoming?qty:0,outgoing:incoming?0:qty});
   }
  }
  return rows.sort((a,b)=>a.ts-b.ts||String(a.ref).localeCompare(String(b.ref)));
 }
 function renderMovement(p){
  const range=reportRange();
  if(range.from>range.to)return msg('تاريخ بداية الفترة بعد نهايتها');
  const box=document.getElementById('pos742ProductMovementResult');if(!box)return;
  const rows=movementRows(p,range),incoming=rows.reduce((s,r)=>s+r.incoming,0),outgoing=rows.reduce((s,r)=>s+r.outgoing,0);
  const body=rows.map(r=>'<tr><td>'+dateOnly(r.date)+'</td><td>'+r.label+'</td><td>'+esc(r.ref)+'</td><td>'+esc(r.party)+'</td><td>'+fmtQty(r.incoming)+'</td><td>'+fmtQty(r.outgoing)+'</td></tr>').join('');
  box.innerHTML='<div class="panel"><h3>حركة الصنف — '+esc(p.name)+'</h3><p>الفترة: '+esc(range.label)+'</p><div class="statement-wrap"><table class="statement-table"><thead><tr><th>التاريخ</th><th>الحركة</th><th>رقم المستند</th><th>الطرف</th><th>داخل</th><th>خارج</th></tr></thead><tbody>'+(body||'<tr><td colspan="6">لا توجد حركات في الفترة</td></tr>')+'</tbody><tfoot><tr><th colspan="4">مجموع الفترة</th><th>'+fmtQty(incoming)+'</th><th>'+fmtQty(outgoing)+'</th></tr></tfoot></table></div></div>';
  current={title:'حركة الصنف',product:p.name};
  box.scrollIntoView({behavior:'smooth',block:'start'});
 }
