import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalSha256, challengePayload, PROJECTS } from '../../r300/edge/verify_proof.mjs';
import { prepareRestoredBackup } from './prepare_restored_backup.mjs';
import exporter from '../../r302/backup_sections_export.js';

const project = PROJECTS.tab1;
const owner = crypto.randomUUID();
const device = crypto.randomUUID();
const keys = generateKeyPairSync('ec', {namedCurve:'prime256v1'});
const backup = {
  format:'POS7-R304-RESTORED-BACKUP', branch:'tab1', localStateSha256:'a'.repeat(64),
  sections:Object.fromEntries('cash cashLedger customers expenses meta payments products purchases receipts returns sales suppliers wallet walletTx'.split(' ').map(key => [key, {}])),
};
backup.sections.products = { items:[{name:'backup product'}] };
let handler;
let challenge;
let applied = 0;
globalThis.Deno = {
  env:{get:key => ({
    SUPABASE_URL:'https://'+project+'.supabase.co',
    SUPABASE_ANON_KEY:'anon-test', SUPABASE_SERVICE_ROLE_KEY:'service-test', POS7_STORE_BRANCH:'tab1',
  })[key]},
  serve:fn => {handler=fn;},
};
globalThis.fetch = async (url, init) => {
  const path = new URL(url).pathname;
  const data = init.body && JSON.parse(init.body);
  if(path==='/auth/v1/user')return Response.json({id:owner});
  if(path.endsWith('/pos7_is_member'))return Response.json(true);
  if(path.endsWith('/pos7_owner_snapshot')){
    assert.equal(new URL(url).searchParams.get('select'),'revision');
    return Response.json([{revision:7}]);
  }
  if(path.endsWith('/pos7_handoff_begin_service')){
    challenge={
      challenge_id:data.p_challenge_id, owner_id:owner, device_id:device,
      branch_id:'tab1', project_id:project, sections_sha256:data.p_sections_hash,
      nonce_hex:data.p_nonce, expected_revision:7, expected_epoch:0,
      issued_at:data.p_issued_at, expires_at:data.p_expires_at,
      public_key_spki_base64:data.p_public_key_spki,
    };
    return Response.json({challenge_id:challenge.challenge_id});
  }
  if(path.endsWith('/pos7_handoff_get_service'))return Response.json(challenge);
  if(path.endsWith('/pos7_backup_finalize_service')){
    assert.equal(data.p_backup_hash, challenge.sections_sha256);
    assert.deepEqual(data.p_replacement_sections, backup.sections);
    applied++;
    challenge.consumed_at = new Date().toISOString();
    return Response.json({ok:true});
  }
  throw Error('unexpected path '+path);
};
await import('./index.ts');
const call = body => handler(new Request('https://edge.invalid', {
  method:'POST', headers:{Authorization:'Bearer owner-test'}, body:JSON.stringify(body),
}));
const storage = {getItem: key => ({
  POS7_R299_OFFLINE_RESTORED: JSON.stringify({branch:'tab1', offlineOnly:true, canPublish:false}),
  POS7_TRIAL188_CLEAN: '{"products":[]}',
})[key] ?? null};
const prepared = await prepareRestoredBackup({
  exporter, storage, branch:'tab1', nativeOfflineGate:true,
  snapshotBuilder: async () => ({schema:1, sections:backup.sections}),
});
backup.localStateSha256 = prepared.backup.localStateSha256;
assert.deepEqual(prepared.backup,backup);
const digest = prepared.sectionsSha256;
assert.equal(digest, await canonicalSha256(backup));
const begun = await call({
  action:'begin', branch:'tab1', device, epoch:0, pendingLocalWrites:false,
  sectionsSha256:digest,
  publicKeySpkiBase64:keys.publicKey.export({type:'spki',format:'der'}).toString('base64'),
});
assert.equal(begun.status,200);
const payload = challengePayload({
  branch:'tab1', project, device, challenge:challenge.challenge_id, nonce:challenge.nonce_hex,
  revision:7, epoch:0, sectionsSha256:digest, iat:challenge.issued_at, exp:challenge.expires_at,
});
const finalize = {action:'finalize', challengeId:challenge.challenge_id,
  signatureBase64:sign('sha256',payload,keys.privateKey).toString('base64'), backup};
const altered = structuredClone(backup);
altered.sections.products.items[0].name = 'altered';
assert.equal((await (await call({...finalize,backup:altered})).json()).error,'restored_backup_changed');
assert.equal(applied,0);
assert.equal((await call(finalize)).status,200);
assert.equal((await call(finalize)).status,403);
assert.equal(applied,1);
console.log('PASS backup proof, tampering rejection and replay rejection at the Edge boundary');
