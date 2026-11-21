/** POS7 R300 server-side WebCrypto proof validator. No database access. */
const DOMAIN = 'POS7-ROTATE-R300';
export const PROJECTS = Object.freeze({tab1:'jdcolkgzwqpwbfvcrdje',tab2:'rmskuolsiqbzxuakofpb'});
function validUuid(s) { return typeof s==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s); }
function hex64(s){return typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);}
function safeInt(n){return Number.isSafeInteger(n)&&n>=0;}
export function challengePayload(p){
  if(!Object.hasOwn(PROJECTS,p.branch)||p.project!==PROJECTS[p.branch]) throw Error('branch_project_mismatch');
  if(!validUuid(p.device)||!validUuid(p.challenge)||!hex64(p.nonce)||!hex64(p.sectionsSha256))throw Error('bad_challenge_input');
  if(!safeInt(p.revision)||!safeInt(p.epoch)||!safeInt(p.iat)||!safeInt(p.exp)||p.iat<=0||p.exp<=p.iat||p.exp-p.iat>300)throw Error('bad_challenge_interval');
  const msg=`${DOMAIN}\nbranch=${p.branch}\nproject=${p.project}\ndevice=${p.device}\nchallenge=${p.challenge}\nnonce=${p.nonce}\nrevision=${p.revision}\nepoch=${p.epoch}\nsections_sha256=${p.sectionsSha256}\niat=${p.iat}\nexp=${p.exp}\n`;
  return new TextEncoder().encode(msg);
}
function decode64(s){if(typeof s!=='string'||s.length>4096||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('base64_invalid');
 const raw=Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 if(btoa(String.fromCharCode(...raw))!==s)throw Error('base64_noncanonical');return raw;
}
/** Native Android SHA256withECDSA uses ASN.1 DER; WebCrypto expects P1363 raw r||s. */
export function derP256ToRaw(der){
 const a=der instanceof Uint8Array?der:new Uint8Array(der);let pos=0;
 function length(){if(pos>=a.length)throw Error('der_length');let n=a[pos++];if(n<128)return n;if(n!==0x81||pos>=a.length)throw Error('der_noncanonical_length');let v=a[pos++];if(v<128)throw Error('der_short_form_required');return v;}
 if(a[pos++]!==0x30)throw Error('der_sequence');const seqLen=length();if(seqLen!==a.length-pos)throw Error('der_sequence_size');
 function integer(){if(a[pos++]!==0x02)throw Error('der_integer');let n=length();if(n<1||n>33||pos+n>a.length)throw Error('der_integer_length');let b=a.slice(pos,pos+n);pos+=n;
  if((b[0]&128)!==0)throw Error('der_negative');if(n>1&&b[0]===0&&(b[1]&128)===0)throw Error('der_nonminimal');
  if(b[0]===0){b=b.slice(1);}if(b.length>32)throw Error('der_integer_overflow');const out=new Uint8Array(32);out.set(b,32-b.length);return out;
 }
 const r=integer(),s=integer();if(pos!==a.length)throw Error('der_trailing');const raw=new Uint8Array(64);raw.set(r);raw.set(s,32);return raw;
}
export function normalizeJson(v){
 if(Array.isArray(v))return v.map(normalizeJson);
 if(v&&typeof v==='object'){
  const out={};for(const key of Object.keys(v).sort()){if(key==='__proto__'||key==='constructor'||key==='prototype')throw Error('unsafe_json_key');out[key]=normalizeJson(v[key]);}return out;
 }
 if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return v;
 throw Error('unsupported_json_value');
}
export async function canonicalSha256(value){const json=JSON.stringify(normalizeJson(value));const bytes=new TextEncoder().encode(json);const result=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return Array.from(result,b=>b.toString(16).padStart(2,'0')).join('');}
export async function verifyAndroidSignature({params,spkiBase64,signatureBase64,nowSeconds=Math.floor(Date.now()/1000)}){
 if(!Number.isSafeInteger(nowSeconds)||nowSeconds<params.iat-10||nowSeconds>=params.exp)throw Error('challenge_expired_or_not_yet_issued');
 const bytes=challengePayload(params);
 const der=decode64(signatureBase64),keyDer=decode64(spkiBase64);
 if(keyDer.length>512)throw Error('spki_too_large');
 const pub=await crypto.subtle.importKey('spki',keyDer,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const sig=derP256ToRaw(der);
 return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,sig,bytes);
}