from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text(encoding='utf8')
assert 'recoverLocalReviewsR362' in s and 'cashPurchaseDocumentR363' not in s
helper=r'''// R363: display-only purchase identity join. Never alter ledger, balances or snapshots.
function cashPurchaseIndexR363(snapshot){
 const index=new Map();
 for(const [key,doc] of Object.entries(snapshot?.purchases||{})){
  if(!doc||typeof doc!=='object')continue;
  const id=String(doc.id??key),ref=String(doc.ref||doc.number||'').trim(),date=P7.day(doc.date||doc.created_at||'');
  const entry={id,key,ref,date,doc};
  const aliases=new Set([ref.toUpperCase()]);
  if(/^\d{13}$/.test(id))aliases.add('P'+id.slice(-6));
  for(const alias of aliases){if(!alias)continue;if(!index.has(alias))index.set(alias,[]);index.get(alias).push(entry);}
 }
 return index;
}
function cashPurchaseDocumentR363(x,key,index){
 const ref=String(x.ref||x.documentRef||'').trim().toUpperCase();
 const note=String(x.note||x.title||'').replace(/[\u064b-\u065f\u0670]/g,'').trim();
 const legacy=/^P\d{6}$/.test(ref),canonical=/^PUR-\d+$/.test(ref);
 if(!legacy&&!canonical)return null;
 if(!/^(?:دفع|مدفوع|تسديد) فاتورة شراء(?:\s|$)|^مبلغ معاد من المورد(?:\s|$)/.test(note))return null;
 const missing={name:'',kind:'supplier',source:'purchase-unresolved',ref:''};
 const date=P7.day(x.date||x.created_at||'');if(!date)return missing;
 const rawId=String(x.id??key??''),ledgerKey=String(key??rawId);
 const stamp=rawId.match(/^(\d{13})(?:\.\d+)?(?:-\d+)?$/);
 if(legacy&&(!stamp||rawId!==ledgerKey))return missing;
 const candidates=(index.get(ref)||[]).filter(c=>c.date===date&&(!legacy||(/^\d{13}$/.test(c.id)&&c.id===c.key&&Math.abs(Number(stamp[1])-Number(c.id))<=120000)));
 if(candidates.length!==1)return missing;
 const c=candidates[0],d=c.doc;
 if(d.cancelled||d.canceled||d.voided||/^(cancelled|canceled|voided|rejected)$/i.test(String(d.status||'')))return missing;
 if(c.id!==c.key||!c.ref||[x.invoiceId,x.documentId].some(v=>v!=null&&String(v).trim()&&String(v)!==c.id))return missing;
 const name=String(d.party||d.supplier||'').trim(),direct=String(x.supplier||x.party||'').trim();
 if(!name||(direct&&direct!==name))return missing;
 return {name,kind:'supplier',ref:c.ref,source:'purchase-identity-r363'};
}
'''
a='function cashPartyMarkup(x){const p=cashMovementParty(x,s);'
assert s.count(a)==1
s=s.replace(a,helper+'function cashPartyMarkup(x,p=cashMovementParty(x,s)){',1)
a=' const detail=d.rows.map(r=>{\n  const x=r.x,raw='
assert s.count(a)==1
s=s.replace(a,' const purchaseIndexR363=cashPurchaseIndexR363(s);\n const detail=d.rows.map(r=>{\n  const x=r.x,raw=',1)
a="  return '<tr><td><b>'+esc(x.ref||x.documentRef||'حركة صندوق')+'</b>'+cashPartyMarkup(x)"
b="  const purchaseLinkR363=cashPurchaseDocumentR363(x,r.key,purchaseIndexR363);\n  return '<tr><td><b>'+esc(purchaseLinkR363?.ref||x.ref||x.documentRef||'حركة صندوق')+'</b>'+cashPartyMarkup(x,purchaseLinkR363??cashMovementParty(x,s))"
assert s.count(a)==1
s=s.replace(a,b,1)
p.write_text(s,encoding='utf8')
print('R363 purchase references, read-only display patch applied')
