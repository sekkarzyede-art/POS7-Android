declare const Deno: any;
// R304 staging: authorize the restored backup for atomic cutover.
// Requires production-safe schema migration, native-client integration,
// old writer RPC fencing, and tested restore before deployment.
import { PROJECTS, canonicalSha256, verifyAndroidSignature } from '../../r300/edge/verify_proof.mjs';

const ENV = (key: string): string => Deno.env.get(key) || '';
const API = ENV('SUPABASE_URL').replace(/\/$/, '');
const ANON = ENV('SUPABASE_ANON_KEY');
const SERVICE = ENV('SUPABASE_SERVICE_ROLE_KEY');
const STORE_BRANCH = ENV('POS7_STORE_BRANCH'); // tab1 / tab2, configured separately per store.
function error(message: string, status = 400) { return new Response(JSON.stringify({ok:false,error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}); }
function json(payload: unknown) { return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}); }
function clean(value: unknown): Record<string,any> {if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_body');return value as Record<string,any>;}
function uuid(s:any) {return typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);}
function hex64(s:any){return typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);}
async function request(path:string, token:string, body?:unknown, method?:string){
 const isService=token===SERVICE;
 const response=await fetch(API+path,{method:method||(body===undefined?'GET':'POST'),headers:{
 'apikey':isService?SERVICE:ANON,'Authorization':'Bearer '+token,
 'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-store'},
 body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await response.text();let val:any;
 try{val=raw?JSON.parse(raw):null}catch{throw Error('supabase_invalid_json');}
 if(!response.ok)throw Error('supabase_request_failed_'+response.status+':'+String(val?.code||''));
 return val;
}
const REQUIRED = ['cash','cashLedger','customers','expenses','meta','payments','products','purchases','receipts','returns','sales','suppliers','wallet','walletTx'];
async function backupDigest(value: unknown) {
 const backup = clean(value);
 const sections = clean(backup.sections);
 if(backup.format!=='POS7-R304-RESTORED-BACKUP'||backup.branch!==STORE_BRANCH||
   !hex64(backup.localStateSha256)||Object.keys(sections).length!==REQUIRED.length)
  throw Error('invalid_backup_export');
 for(const key of REQUIRED){
  if(!Object.hasOwn(sections,key))throw Error('missing_backup_section');
  clean(sections[key]);
 }
 return canonicalSha256(backup);
}
async function currentRevision(){
 const rows=await request('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=revision',SERVICE);
 if(!Array.isArray(rows)||rows.length!==1||!Number.isSafeInteger(rows[0]?.revision))
  throw Error('cloud_revision_unavailable');
 return rows[0].revision;
}
async function verifiedOwner(token:string){
 const user=await request('/auth/v1/user',token);
 if(!uuid(user?.id))throw Error('invalid_authenticated_user');
 const member=await request('/rest/v1/rpc/pos7_is_member',token,{p_store_id:'pos7',p_roles:['owner']});
 if(member!==true)throw Error('owner_access_required');
 return user.id;
}
async function handler(req:Request):Promise<Response>{
 if(req.method!=='POST')return error('POST_only',405);
 if(!API||!ANON||!SERVICE||!Object.hasOwn(PROJECTS,STORE_BRANCH))return error('service_not_configured',503);
 const expectedProject=PROJECTS[STORE_BRANCH];
 if(API!=='https://'+expectedProject+'.supabase.co')return error('store_project_mismatch',503);
 const header=req.headers.get('Authorization')||'';
 if(!/^Bearer [^ ]+$/.test(header))return error('missing_owner_access_token',401);
 const token=header.slice(7);
 if(token===SERVICE||token===ANON)return error('client_credentials_not_allowed',401);
 let body:Record<string,any>;
 try{const reader=req.body?.getReader();
  if(!reader)return error('missing_body');
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let raw='',size=0;
  while(true){
   const chunk=await reader.read();
   if(chunk.done)break;
   size+=chunk.value.byteLength;
   if(size>16*1024*1024){await reader.cancel();return error('request_too_large',413);}
   raw+=decoder.decode(chunk.value,{stream:true});
  }
  body=clean(JSON.parse(raw+decoder.decode()));}
 catch{return error('invalid_request_json');}
 try{
  const ownerId=await verifiedOwner(token);
  if(body.action==='begin'){
   if(body.branch!==STORE_BRANCH||!uuid(body.device)||typeof body.publicKeySpkiBase64!=='string'||body.publicKeySpkiBase64.length>1024||!hex64(body.sectionsSha256)||!Number.isSafeInteger(body.epoch)||body.epoch<0||body.pendingLocalWrites!==false)
    return error('invalid_begin_fields_or_unresolved_local_writes');
   const revision=await currentRevision();
   const challengeId=crypto.randomUUID();const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   const iat=Math.floor(Date.now()/1000),exp=iat+120;
   const receipt=await request('/rest/v1/rpc/pos7_handoff_begin_service',SERVICE,{
    p_challenge_id:challengeId,p_branch:STORE_BRANCH,p_project:expectedProject,p_owner_id:ownerId,p_device_id:body.device,
    p_public_key_spki:body.publicKeySpkiBase64,p_nonce:nonce,p_expected_revision:revision,p_expected_epoch:body.epoch,
    p_sections_hash:body.sectionsSha256,p_issued_at:iat,p_expires_at:exp});
   return json({ok:true,challenge:receipt,branch:STORE_BRANCH,project:expectedProject,revision:revision,epoch:body.epoch,sectionsSha256:body.sectionsSha256});
  }
  if(body.action==='finalize'){
   if(!uuid(body.challengeId)||typeof body.signatureBase64!=='string'||body.signatureBase64.length>512)return error('invalid_finalize_input');
   const challenge=await request('/rest/v1/rpc/pos7_handoff_get_service',SERVICE,{p_challenge_id:body.challengeId});
   if(!challenge||challenge.owner_id!==ownerId||challenge.branch_id!==STORE_BRANCH||challenge.project_id!==expectedProject||challenge.consumed_at)
     return error('challenge_owner_or_store_mismatch',403);
   const digest=await backupDigest(body.backup);
   if(digest!==challenge.sections_sha256)return error('restored_backup_changed');
   const params={branch:STORE_BRANCH,project:expectedProject,device:challenge.device_id,challenge:challenge.challenge_id,
    nonce:challenge.nonce_hex,revision:challenge.expected_revision,epoch:challenge.expected_epoch,sectionsSha256:challenge.sections_sha256,
    iat:Number(challenge.issued_at),exp:Number(challenge.expires_at)};
   const valid=await verifyAndroidSignature({params,spkiBase64:challenge.public_key_spki_base64,signatureBase64:body.signatureBase64});
   if(!valid)return error('invalid_keystore_signature',403);
   const result=await request('/rest/v1/rpc/pos7_backup_finalize_service',SERVICE,{p_challenge_id:body.challengeId,p_owner_id:ownerId,p_backup_hash:digest,p_replacement_sections:body.backup.sections});
   return json(result);
  }
  return error('unknown_action');
 }catch(e){
  // Do not leak privileged database errors, JWTs or internal rows.
  const msg=e instanceof Error?e.message:'unknown';
  console.error('POS7 R304 handoff error category:',msg.split(':')[0]);
  return error('handoff_denied',409);
 }
}
Deno.serve(handler);