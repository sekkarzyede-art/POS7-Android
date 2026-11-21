/* R299 POS7 offline-only recovery. MUST run only inside a WebView whose network
 * loads have been disabled from native Android BEFORE this page was loaded.
 * The recovered data is never an authorization to publish.
 */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('../r298/backup_preflight.js'):root.Pos7BackupPreflight);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.Pos7OfflineRestore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(preflight){
 'use strict';
 const DATA_KEY='POS7_TRIAL188_CLEAN';
 const ROLLBACK_KEY='POS7_R299_ROLLBACK_ONLY';
 const RESTORED_META='POS7_R299_OFFLINE_RESTORED';
 function hasRecords(state){
  if(!state||typeof state!=='object')return false;
  return ['sales','purchases','products','customerPayments','supplierPayments','expenses','cashTransfers','cashClosings','cashAdjustments'].some(k=>Array.isArray(state[k])&&state[k].length>0)
    || ['customers','suppliers'].some(k=>state[k]&&typeof state[k]==='object'&&Object.keys(state[k]).length>0);
 }
 function loadJson(s){try{return s?JSON.parse(s):null}catch(e){return null;}}
 function readCurrent(storage){
  const raw=storage.getItem(DATA_KEY);
  if(raw&&!loadJson(raw))throw Error('local_state_corrupt_keep_original');
  return raw;
 }
 function recover(text,branch,storage,options={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('storage_unavailable');
  if(options.nativeOfflineGate!==true)throw Error('native_network_isolation_required');
  if(storage.getItem(RESTORED_META))throw Error('already_restored_this_installation');
  const audit=preflight.inspect(text,branch);
  if(!audit.ok)throw Error('backup_preflight_failed:'+audit.errors.join(','));
  const parsed=JSON.parse(text);
  const candidate=JSON.stringify(parsed.data);
  const original=readCurrent(storage);
  if(hasRecords(loadJson(original)))throw Error('existing_live_records_preserved_use_verified_return_workflow');
  if(original!==null){
   // Reserve a rollback BEFORE any modification. On storage-quota error nothing changes.
   storage.setItem(ROLLBACK_KEY,original);
   if(storage.getItem(ROLLBACK_KEY)!==original)throw Error('rollback_reservation_failed');
  }
  // No privileged cloud creds, publisher IDs or branch metadata are copied.
  try{
   storage.setItem(DATA_KEY,candidate);
   if(storage.getItem(DATA_KEY)!==candidate)throw Error('storage_write_verification_failed');
   const meta=JSON.stringify({branch,createdAt:parsed.createdAt,appliedAt:new Date().toISOString(),offlineOnly:true,canPublish:false});
   storage.setItem(RESTORED_META,meta);
   if(storage.getItem(RESTORED_META)!==meta)throw Error('restore_marker_not_durable');
  }catch(e){
   if(original===null)storage.removeItem(DATA_KEY);
   else storage.setItem(DATA_KEY,original);
   storage.removeItem(RESTORED_META);
   throw e;
  }
  return Object.freeze({ok:true,offlineOnly:true,canPublish:false,branch,counts:audit.counts});
 }
 return Object.freeze({recover,DATA_KEY,ROLLBACK_KEY,RESTORED_META,hasRecords});
});
