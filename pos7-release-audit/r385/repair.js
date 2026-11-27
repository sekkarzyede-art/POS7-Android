function pos7R385RepairReferences(input,base){
 const candidate=JSON.parse(JSON.stringify(base.identityCandidate)),d=candidate.data, original=JSON.parse(JSON.stringify(d));
 const norm=POS7IdentityGuardR352.norm,allocate=POS7IdentityGuardR352.createAllocator(d),repairs=[],blocked=[];
 const targets=d.products.filter(p=>!Number.isSafeInteger(p.id)||p.id<=0);
 for(const p of targets){
  const old=p.id,key=String(old),matches=[],other=[];
  function walk(v,path){
   if(!v||typeof v!=='object')return;
   for(const [k,z] of Object.entries(v)){
    const at=path.concat(k);
    if(path.length===2&&path[0]==='products'&&k==='id'&&v===p)continue;
    if(!Array.isArray(v)&&k===key)other.push(at.join('.'));
    if((typeof z==='number'||typeof z==='string')&&String(z)===key){
     const allowed=/^(sales|purchases|salesReturns)\.\d+\.items\.\d+\.(id|productId|product_id)$/.test(at.join('.'))||/^recordRevisions\.\d+\.snapshot\.items\.\d+\.(id|productId|product_id)$/.test(at.join('.'));
     if(allowed&&norm(v.barcode)&&norm(v.barcode)===norm(p.barcode))matches.push({v,k,path:at});
     else other.push(at.join('.'));
    }
    walk(z,at);
   }
  }
  walk(d,[]);
  if(typeof old!=='number'||!Number.isFinite(old)||!norm(p.barcode)||d.products.filter(x=>String(x.id)===key).length!==1||d.products.filter(x=>norm(x.barcode)===norm(p.barcode)).length!==1||other.length){blocked.push({name:p.name,barcode:p.barcode,old,unverified:other,verified:matches.map(x=>x.path.join('.'))});continue;}
  const next=allocate(),index=d.products.indexOf(p);p.id=next;
  for(const m of matches)m.v[m.k]=typeof m.v[m.k]==='string'?String(next):next;
  repairs.push({name:p.name,barcode:p.barcode,old,new:next,index,references:matches.map(x=>x.path)});
 }
 const restored=JSON.parse(JSON.stringify(d));
 for(const r of repairs){restored.products[r.index].id=r.old;for(const path of r.references){let a=restored,b=original;for(const k of path.slice(0,-1)){a=a[k];b=b[k];}a[path.at(-1)]=b[path.at(-1)];}}
 if(JSON.stringify(restored)!==JSON.stringify(original))throw Error('R385 unexpected data change');
 const result=pos7R384PrepareBackup(candidate,POS7DataDoctorR351.run(candidate));
 result.report.version='R385';result.report.identityRepairs=base.changes;
 result.report.referenceRepairs=repairs;result.report.referenceBlocked=blocked;
 result.report.invariants.onlyVerifiedReferenceChanges=true;
 result.report.remaining.externalIdentityReview=!!(base.changes.length||repairs.length||input.pos7R354ExternalIdentityReviewRequired);
 result.candidate.pos7R354ExternalIdentityReviewRequired=result.report.remaining.externalIdentityReview;
 result.report.readyForOriginalRestore=!Object.values(result.report.remaining).some(Boolean);
 return result;
}
