/* R302: export 14 canonical cloud sections using ORIGINAL POS7 snapshot builder.
   No cloud lookup, no publishing privilege, no network changes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.Pos7BackupSectionsExport=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const REQUIRED=['cash','cashLedger','customers','expenses','meta','payments','products','purchases','receipts','returns','sales','suppliers','wallet','walletTx'];
 function assertSections(sections){
  if(!sections||typeof sections!=='object'||Array.isArray(sections))throw Error('invalid_sections');
  if(Object.keys(sections).length!==14)throw Error('invalid_section_count');
  for(const k of REQUIRED){
   if(!Object.prototype.hasOwnProperty.call(sections,k)||!sections[k]||typeof sections[k]!=='object'||Array.isArray(sections[k]))throw Error('invalid_section_'+k);
  }
  return true;
 }
 async function digestUtf8(s){
  if(!globalThis.crypto?.subtle)throw Error('secure_hash_unavailable');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
 }
 async function build({storage,branch,snapshotBuilder,expectedLocalRestored=true}){
  if(!storage||!['tab1','tab2'].includes(branch))throw Error('invalid_restore_context');
  const raw=storage.getItem('POS7_R299_OFFLINE_RESTORED');
  if(!raw)throw Error('no_confirmed_local_restore');
  let meta;
  try{meta=JSON.parse(raw);}catch{throw Error('invalid_restore_marker');}
  if(meta.branch!==branch||meta.offlineOnly!==true||meta.canPublish!==false)throw Error('branch_or_mode_mismatch');
  if(expectedLocalRestored!==true)throw Error('native_offline_not_attested');
  if(typeof snapshotBuilder!=='function')throw Error('original_snapshot_builder_missing');
  const snapshot=await snapshotBuilder(()=>true);
  if(!snapshot||snapshot.schema!==1)throw Error('invalid_snapshot_schema');
  assertSections(snapshot.sections);
  const state=storage.getItem('POS7_TRIAL188_CLEAN');
  if(typeof state!=='string'||!state.trim())throw Error('local_state_missing');
  const localStateSha256=await digestUtf8(state);
  const sectionsSha256=await digestUtf8(JSON.stringify(snapshot.sections));
  return Object.freeze({format:'POS7-R302-OFFLINE-SECTIONS',branch,source:'local-backup',
   canPublish:false,localStateSha256,sectionsSha256,sections:snapshot.sections});
 }
 return Object.freeze({build,assertSections});
});