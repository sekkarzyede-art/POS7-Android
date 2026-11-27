function pos7R384PrepareBackup(input, base){
 const candidate=JSON.parse(JSON.stringify(base.identityCandidate));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const valid=id=>Number.isSafeInteger(id)&&id>0;
 const data=candidate.data, before=input.data, products=data.products;
 const used=new Set(), hits=new Map(), invalid=products.map((p,i)=>({p,i})).filter(x=>!valid(x.p.id));
 const targets=new Set(invalid.map(x=>String(x.p.id)));
 function walk(v,path,skip){
  if(v&&typeof v==='object'){
   for(const [k,z] of Object.entries(v)){
    used.add(k);
    const at=path.concat(k);
    if(targets.has(k)&&!Array.isArray(v))record(k,at,'key');
    if(skip&&path.length===2&&path[0]==='products'&&k==='id'){used.add(String(z));continue;}
    walk(z,at,skip);
   }
  }else if(typeof v==='number'||typeof v==='string'){const k=String(v);used.add(k);if(targets.has(k))record(k,path,'value');}
 }
 function record(key,path,kind){if(!hits.has(key))hits.set(key,{count:0,examples:[]});const h=hits.get(key);h.count++;if(h.examples.length<20)h.examples.push({path:path.join('.'),kind});}
 walk(data,[],true);
 const allocate=POS7IdentityGuardR352.createAllocator(data);
 const invalidRepairs=[],invalidBlocked=[];
 for(const {p,i} of invalid){
  const key=String(p.id),refs=hits.get(key)||{count:0,examples:[]};
  const entry={index:i,name:p.name,barcode:p.barcode,old:p.id??null,idType:typeof p.id,referenceCount:refs.count,references:refs.examples};
  if(p.id==null||refs.count||products.filter(x=>String(x.id)===key).length!==1){invalidBlocked.push({...entry,reason:'missing_or_referenced_or_ambiguous_id'});continue;}
  p.id=allocate();invalidRepairs.push({...entry,new:p.id});
 }
 const audit=POS7DataDoctorR351.scan(candidate);
 const invariants={allNonProductDataUnchanged:Object.keys(before).filter(k=>k!=='products').every(k=>same(before[k],data[k])),allProductFieldsExceptIdUnchanged:before.products.length===products.length&&before.products.every((p,i)=>{const a={...p},b={...products[i]};delete a.id;delete b.id;return same(a,b)}),originalHistoryUnchanged:['sales','purchases','salesReturns','customerPayments','supplierPayments','doubleEntryJournal'].every(k=>same(before[k],data[k]))};
 if(!Object.values(invariants).every(Boolean))throw Error('فشل ضمان حفظ البيانات');
 const barcodeReview=audit.ambiguous.map(([normalized,ps])=>({normalized,products:ps.map(p=>({id:p.id,name:p.name,barcode:p.barcode,stock:p.stock,category:p.category,piecesPerBox:p.piecesPerBox})),decision:'review_required_no_automatic_merge'}));
 const blockers={duplicateIdGroups:audit.collisions.length,invalidIds:audit.invalidIds.length,barcodeGroups:audit.ambiguous.length,missingBarcodes:audit.missingBarcodes.length,invalidStock:audit.invalidStock.length,duplicateDocuments:audit.duplicateDocuments.length,journalUnbalanced:audit.journalUnbalanced,externalIdentityReview:input.pos7R354ExternalIdentityReviewRequired===true||base.changes.length>0||invalidRepairs.length>0};
 const report={version:'R384',mode:'offline_restore_review',identityRepairs:base.changes,invalidRepairs,invalidBlocked,barcodeReview,remaining:blockers,revisionPlan:base.revisionPlan,revisionBlocked:base.revisionBlocked,historicalLines:audit.history,invariants,readyForOriginalRestore:!Object.values(blockers).some(Boolean)};
 return {candidate:{...candidate,pos7R354ExternalIdentityReviewRequired:blockers.externalIdentityReview},report};
}
