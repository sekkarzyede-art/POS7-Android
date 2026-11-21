/* POS7 R298 — offline backup preflight only. Does not write or authorize publication.
 * Compatible with legacy makeBackupObject(): {app:'POS7',version:110,createdAt,kind,data:state}.
 * All backup properties are untrusted input, including purported branch/metadata.
 */
(function(root,factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Pos7BackupPreflight=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const REQUIRED_ARRAYS=['products','sales','purchases','customerPayments','supplierPayments','expenses','cashTransfers','cashClosings','cashAdjustments'];
  const REQUIRED_OBJECTS=['customers','suppliers','cashOpening'];
  const MAX_BYTES=80*1024*1024;
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function safeId(x){return typeof x==='string'||typeof x==='number'?String(x).trim():'';}
  function inspect(text, selectedBranch, now=Date.now()){
    const errors=[],warnings=[];
    if(selectedBranch!=='tab1'&&selectedBranch!=='tab2')errors.push('invalid_branch');
    if(typeof text!=='string'||text.length>MAX_BYTES){errors.push('backup_file_too_large_or_invalid');return {ok:false,errors,warnings};}
    let backup;
    try{backup=JSON.parse(text);}catch(e){return {ok:false,errors:errors.concat('invalid_json'),warnings};}
    if(!object(backup)||backup.app!=='POS7')errors.push('not_pos7_backup');
    if(!object(backup?.data))errors.push('missing_data');
    let stamp=Date.parse(backup?.createdAt);
    if(!Number.isFinite(stamp))errors.push('invalid_backup_date');
    else if(stamp>now+10*60*1000)errors.push('future_backup_date');
    else if(now-stamp>24*60*60*1000)warnings.push('backup_older_than_24h');
    if(!Number.isInteger(backup?.version)||backup.version<1)warnings.push('unrecognized_backup_version');
    const data=object(backup?.data)?backup.data:{};
    for(const k of REQUIRED_ARRAYS)if(!Array.isArray(data[k]))errors.push('missing_array_'+k);
    for(const k of REQUIRED_OBJECTS)if(!object(data[k]))errors.push('missing_object_'+k);
    const counts={},duplicateIds={};
    for(const name of REQUIRED_ARRAYS){
      const records=Array.isArray(data[name])?data[name]:[];
      counts[name]=records.length;
      if(records.length>250000){errors.push('oversized_section_'+name);continue;}
      let ids=new Set(),dup=0;
      for(const item of records){
        if(!object(item)){errors.push('invalid_record_'+name);break;}
        const id=safeId(item.id);
        if(id&&(name==='products'||name==='sales'||name==='purchases')){
          if(ids.has(id))dup++;else ids.add(id);
        }
      }
      if(dup){errors.push('duplicate_ids_'+name);duplicateIds[name]=dup;}
    }
    const foreignMarkers=['branch','store','store_id','supabase_project_id','projectRef'];
    const foundMarkers=foreignMarkers.filter(x=>Object.prototype.hasOwnProperty.call(backup,x)||Object.prototype.hasOwnProperty.call(data,x));
    // Neither branch metadata nor a manually supplied checksum is trusted.
    if(foundMarkers.length)warnings.push('backup_store_marker_is_untrusted');
    warnings.push('cloud_revision_not_verified');
    warnings.push('local_pending_writes_not_verified');
    warnings.push('external_product_images_not_verified');
    return {
      ok:errors.length===0,
      safeToRestore: false,
      canPublish:false,
      selectedBranch,
      createdAt:Number.isFinite(stamp)?new Date(stamp).toISOString():null,
      errors,warnings,counts,duplicateIds,
      dataPresent:errors.filter(e=>e.startsWith('missing_')).length===0,
      requirement:'trusted_cloud_revision_and_device_proof_required'
    };
  }
  return Object.freeze({inspect,MAX_BYTES});
});
