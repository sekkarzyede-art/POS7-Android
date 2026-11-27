/* R387 Tab2. Reconcile an isolated copy before committing it locally. */
const pos7R387Pairs = new Map([
 ['7622400001710',[1791754307184,1791754445965]],
 ['4008400264004',[1791754129679,1791754350187]],
 ['8000500380642',[1791754511142,1791754016462]],
 ['8000500224403',[1791754238159,1791754676462]],
 ['8000500121443',[1794065603603,1791754111401]]
]);
function pos7R387Refs(data,p){
 const refs=[],values=new Set([p.id,p.barcode,p.recordNo].filter(x=>x!=null&&x!=='').map(String));
 function scan(value,path){
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){
   const next=path.concat(key);
   if(path[0]==='products'&&data.products[path[1]]===p)continue;
   if(!Array.isArray(value)&&values.has(key))refs.push({path:next,kind:'key'});
   if((typeof item==='string'||typeof item==='number')&&values.has(String(item)))refs.push({path:next,row:value,key,item});
   scan(item,next);
  }
 }
 scan(data,[]);
 return refs;
}
function pos7R387Prepare(input,base,bienno=false){
 const prepared=pos7R385RepairReferences(input,base),data=prepared.candidate.data;
 const initial=POS7DataDoctorR351.scan(prepared.candidate);
 const merges=[],review=[];
 const inventoryValue=()=>data.products.reduce((total,p)=>total+p.stock*nv(p.cost),0);
 const before=inventoryValue();
 for(const [code,group] of initial.ambiguous){
  const pair=pos7R387Pairs.get(code), keep=group.find(p=>p.id===pair?.[0]), retire=group.find(p=>p.id===pair?.[1]);
  const reviewedCount=code==='8000500121443'&&bienno;
  const hold=reason=>review.push({code,reason,products:group.map(({id,name,barcode,stock,cost,piecesPerBox})=>({id,name,barcode,stock,cost,piecesPerBox}))});
  if(group.length!==2||!keep||!retire||keep.piecesPerBox!==retire.piecesPerBox){hold('identity_or_package_review');continue;}
  if((retire.stock!==0||retire.expiryBatches?.some(b=>b.qty!==0))&&!reviewedCount){hold('count_required');continue;}
  const refs=pos7R387Refs(data,retire),keptBarcode=keep.barcode;
  const allowed=/^(?:(?:sales|purchases|salesReturns|purchaseReturns|purchasesReturns|supplierReturns)\.\d+|(?:recordRevisions|deletedRecords)\.\d+\.snapshot)\.items\.\d+\.(?:id|productId|product_id|barcode)$/;
  if(refs.length&&(!reviewedCount||refs.some(r=>!r.row||!allowed.test(r.path.join('.'))||String(r.row.barcode)!==String(retire.barcode)||[r.row.id,r.row.productId,r.row.product_id].some(id=>id!=null&&String(id)!==String(retire.id))))){hold('references_require_review');continue;}
  const rows=new Set();
  for(const r of refs){
   rows.add(r.row);
   if(r.key!=='barcode')r.row[r.key]=typeof r.item==='string'?String(keep.id):keep.id;
  }
  // Legacy purchase lines can have a barcode without an ID.
  for(const row of rows)if(row.id==null)row.id=keep.id;
  const entry={code,keptId:keep.id,keptBarcode,keptStock:keep.stock,retired:{...retire},referencePaths:refs.map(r=>r.path.join('.')),requiresCount:retire.stock!==keep.stock};
  data.products=data.products.filter(p=>p!==retire);
  keep.stock_revision=null;keep.stock_revision_untrusted=true;
  merges.push(entry);
 }
 if(merges.length)data.pos7R387BarcodeMerges=[...(data.pos7R387BarcodeMerges||[]),...merges];
 const audit=POS7DataDoctorR351.scan(prepared.candidate);
 prepared.report.version='R387';
 prepared.report.barcodeMerges=merges;
 prepared.report.barcodeReview=review;
 prepared.report.inventoryValueBefore=before;
 prepared.report.inventoryValueAfter=inventoryValue();
 prepared.report.remaining.barcodeGroups=audit.ambiguous.length;
 prepared.report.readyForLocalRestore=!['duplicateIdGroups','invalidIds','missingBarcodes','invalidStock','duplicateDocuments','journalUnbalanced'].some(k=>prepared.report.remaining[k]);
 prepared.report.readyForOriginalRestore=!Object.values(prepared.report.remaining).some(Boolean);
 return prepared;
}
function pos7R387ProductForLine(line){
 const all=state.products||[],id=line.productId??line.id,bc=String(line.barcode??'');
 const exact=bc?all.filter(p=>String(p.barcode)===bc):[];
 const equivalent=bc?all.filter(p=>pos7R353BarcodeKey(p.barcode)===pos7R353BarcodeKey(bc)):[];
 const byId=id==null?[]:all.filter(p=>String(p.id)===String(id));
 if(byId.length===1&&(!bc||(exact.length===1&&exact[0]===byId[0])||(equivalent.length===1&&equivalent[0]===byId[0])))return byId[0];
 if(id!=null)return null;
 return exact.length===1?exact[0]:equivalent.length===1?equivalent[0]:null;
}
function pos7R387CommitLocal(b){
 if(!validBackup(b))return false;
 if(window.P7TabletTest?.isBusy()||window.pos310PurchaseActive?.()||window.pos789SyncIsBusy?.()||window.POS7_R348_SYNC_RESERVED||window.POS7_R212_BATCH_ACTIVE||window.POS7_R166_RELOAD_REQUIRED||window.POS7_R167_RECONCILIATION_PENDING||saleCart.length||purchaseCart.length||editingSaleId||editingPurchaseId)return toast('أغلق الفواتير المفتوحة وانتظر اكتمال الحفظ والمزامنة قبل الاستعادة');
 const audit=POS7DataDoctorR351.scan(b);
 if(audit.collisions.length||audit.invalidIds.length||audit.missingBarcodes.length||audit.invalidStock.length||audit.duplicateDocuments.length||audit.journalUnbalanced)return toast('بقي تعارض يمنع الاستعادة المحلية');
 if(!confirm('استبدال بيانات تاب 2 بالنسخة المعالجة محليًا؟ ستبقى المزامنة السحابية معلّقة.'))return false;
 const flags=['POS7_RESTORE_PENDING_R305','POS7_RESTORE_LOCAL_ONLY_R323','POS7_TRANSFER_REQUEST_R305','POS7_V485_SESSION','POS7_TABLET_THREE_SALE_BASKETS_V1'];
 const previous=flags.map(k=>localStorage.getItem(k));
 const next=JSON.parse(JSON.stringify(b.data));
 next.pos7R387LocalRestore=true;
 for(const p of next.products){p.stock_revision=null;p.stock_revision_untrusted=true;}
 const safety=makeBackupObject('before-r387-local-restore');
 let changingFlags=false;
 try{
  if(window.POS7_R322_NATIVE_STORE?.status().active){
   if(window.Pos7Android?.pos387SaveRestoreSafety(JSON.stringify(safety))!==true)throw Error('تعذّر حفظ نسخة الأمان');
  }else if(!pos340StoreBackups([safety,...getBackupList()]))throw Error('تعذّر حفظ نسخة الأمان');
  changingFlags=true;
  localStorage.setItem(flags[0],'yes');
  localStorage.setItem(flags[1],'yes');
  for(const key of flags.slice(2))localStorage.removeItem(key);
  localStorage.setItem(KEY,JSON.stringify(next));
 }catch(e){
  if(changingFlags)for(const [index,key] of flags.entries()){
   try{if(previous[index]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[index]);}catch(_){}
  }
  toast('تعذرت الاستعادة المحلية: '+e.message);
  return false;
 }
 state=next;
 pos7R354Allocator=null;
 pos7R353CreatedProducts=undefined;
 location.reload();
 return true;
}
