/* POS7 R351 prototype: local-only audit. No restore, network, database, or credential access. */
(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const norm=v=>{const s=String(v??'').trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c.charCodeAt(0)>=0x6f0?0x6f0:0x660)));return /^\d+$/.test(s)?s.replace(/^0+(?=\d)/,''):s};
const validRev=p=>Number.isSafeInteger(p.stock_revision)&&p.stock_revision>=0&&p.stock_revision<999999999999999&&p.stock_revision_untrusted!==true;
const validId=v=>Number.isSafeInteger(v)&&v>0;
function groups(a,key){const m=new Map();for(const p of a){const k=key(p);if(!m.has(k))m.set(k,[]);m.get(k).push(p)}return m}
function scan(x){
 if(!x||x.app!=='POS7'||!x.data||!Array.isArray(x.data.products)||!['sales','purchases','salesReturns'].every(k=>Array.isArray(x.data[k])))throw Error('صيغة نسخة POS7 غير مكتملة');
 const d=x.data,p=d.products;if(!p.every(v=>v&&typeof v==='object'&&!Array.isArray(v)))throw Error('سجل صنف غير صالح');
 const ids=groups(p,v=>String(v.id)),bars=groups(p,v=>norm(v.barcode)),exact=groups(p,v=>String(v.barcode??''));
 const collisions=[...ids].filter(([,v])=>v.length>1),ambiguous=[...bars].filter(([,v])=>v.length>1),refs=new Map(collisions.map(([id])=>[id,[]]));
 function walk(v,path){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach((z,i)=>walk(z,path.concat(i)));return}for(const [k,z] of Object.entries(v)){if(refs.has(k))refs.get(k).push({path:path.concat(k).join('.'),key:true,barcode:null});if((typeof z==='number'||typeof z==='string')&&refs.has(String(z)))refs.get(String(z)).push({path:path.concat(k).join('.'),field:k,barcode:typeof v.barcode==='string'?v.barcode:null});walk(z,path.concat(k))}}
 for(const [k,v] of Object.entries(d))if(k!=='products')walk(v,[k]);
 const history=[],blockedIds=new Set();
 for(const table of ['sales','purchases','salesReturns'])for(const doc of d[table]){if(!Array.isArray(doc.items)){history.push({table,number:doc.number,issue:'missing_items'});continue}for(const [idx,i] of doc.items.entries()){const b=String(i.barcode??'');const matches=exact.get(b)||[];if(!matches.length){history.push({table,number:doc.number,line:idx+1,barcode:b,name:i.name,issue:'historical_barcode_not_in_catalog'});if(i.id!=null&&table!=='purchases')blockedIds.add(String(i.id));}else if(table!=='purchases'&&(!matches.some(v=>String(v.id)===String(i.id))||('productId'in i&&String(i.productId)!==String(i.id)))){history.push({table,number:doc.number,line:idx+1,barcode:b,name:i.name,issue:'historical_identity_mismatch'});blockedIds.add(String(i.id));}}}
 return {d,p,ids,bars,collisions,ambiguous,refs,history,blockedIds,untrusted:p.filter(v=>!validRev(v)),fractional:p.filter(v=>typeof v.stock==='number'&&Number.isFinite(v.stock)&&!Number.isInteger(v.stock)),negative:p.filter(v=>typeof v.stock==='number'&&v.stock<0),invalidStock:p.filter(v=>typeof v.stock!=='number'||!Number.isFinite(v.stock)||Math.abs(v.stock)>Number.MAX_SAFE_INTEGER),invalidIds:p.filter(v=>!validId(v.id)),missingBarcodes:p.filter(v=>!norm(v.barcode)),duplicateDocuments:['sales','purchases','salesReturns'].flatMap(k=>[...groups(d[k],v=>String(v.number??''))].filter(([n,v])=>n&&v.length>1).map(([n,v])=>({table:k,number:n,count:v.length}))),journalUnbalanced:(d.doubleEntryJournal||[]).filter(v=>typeof v.totalDebitUSD!=='number'||typeof v.totalCreditUSD!=='number'||Math.abs(v.totalDebitUSD-v.totalCreditUSD)>1e-6).length};
}
root.POS7Tab1BackupAudit={scan};
})(globalThis);
function pos7R388AuditBackup(b){
 const d=b?.data;
 if(!validBackup(b))throw Error('صيغة نسخة POS7 غير صالحة');
 const audit=POS7Tab1BackupAudit.scan({...b,data:{...d,salesReturns:d.salesReturns??[]}});
 return {
  products:audit.p.length,sales:d.sales.length,purchases:d.purchases.length,
  duplicateIds:audit.collisions.length,invalidIds:audit.invalidIds.length,
  barcodeConflicts:audit.ambiguous.map(([barcode,rows])=>({barcode,products:rows.map(({id,name,stock})=>({id,name,stock}))})),
  missingBarcodes:audit.missingBarcodes.length,invalidStock:audit.invalidStock.length,
  fractionalStock:audit.fractional.length,negativeStock:audit.negative.length,
  untrustedRevisions:audit.untrusted.length,historicalLines:audit.history.length,
  duplicateDocuments:audit.duplicateDocuments.length,journalUnbalanced:audit.journalUnbalanced,
 };
}
function pos7R388ReadBackup(input){
 const file=input.files?.[0];
 input.value='';
 if(!file)return;
 const output=document.getElementById('pos7R388BackupResult');
 file.text().then(raw=>{
  const report=pos7R388AuditBackup(JSON.parse(raw));
  output.value=JSON.stringify(report,null,2);
  output.hidden=false;
 }).catch(e=>{output.value='تعذّر فحص النسخة: '+e.message;output.hidden=false});
}
function pos7R388BackupAction(action){
 const output=document.getElementById('pos7R388BackupResult');
 if(output.hidden)return;
 const name='POS7_Tab1_R388_backup_audit.json';
 if(action==='save'){
  if(typeof window.Pos7Android?.saveBackupJson==='function')window.Pos7Android.saveBackupJson(name,output.value);
  else window.P7Download(name,output.value);
 }else{
  const select=()=>{output.focus();output.select();document.execCommand('copy');};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(output.value).catch(select);
  else select();
 }
}
function pos7R388HasReferences(data,product){
 const ids=new Set([product.id,product.barcode,product.recordNo].filter(x=>x!=null&&x!=='').map(String));
 function scan(v){
  if(v==null)return false;
  if(Array.isArray(v))return v.some(scan);
  if(typeof v==='object')return Object.entries(v).some(([key,item])=>ids.has(key)||scan(item));
  return (typeof v==='number'||typeof v==='string')&&ids.has(String(v));
 }
 return Object.entries(data).some(([key,v])=>key==='products'?v.some(p=>p!==product&&scan(p)):scan(v));
}
