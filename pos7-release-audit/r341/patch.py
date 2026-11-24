from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
old="""window.POS7_R340_local=function(products,id,barcode){
 const rows=(products||[]).filter(x=>String(x.barcode)===String(barcode));
 if(rows.length!==1)return [];
 if(!window.POS7_R213_COUNT_CORRECTION_ACTIVE&&String(rows[0].id)!==String(id))return [];
 if((products||[]).filter(x=>String(x.id)===String(rows[0].id)).length!==1)return [];
 return rows;
};"""
new="""window.POS7_R341_normalizeBarcode=function(barcode){
 const raw=String(barcode??'').trim();
 return /^[0-9]+$/.test(raw)?raw.replace(/^0+(?=\\\\d)/,''):raw;
};
window.POS7_R340_local=function(products,id,barcode){
 const norm=window.POS7_R341_normalizeBarcode;
 const rows=(products||[]).filter(x=>norm(x.barcode)===norm(barcode));
 // A leading-zero collision with two independent local records is not silently merged.
 if(rows.length!==1)return [];
 if(!window.POS7_R213_COUNT_CORRECTION_ACTIVE&&String(rows[0].id)!==String(id))return [];
 if((products||[]).filter(x=>String(x.id)===String(rows[0].id)).length!==1)return [];
 return rows;
};"""
# Backslash in JavaScript regex should be a single slash; Python triple-string currently escaped.
new=new.replace('\\\\d','\\d')
assert s.count(old)==1, 'expected R340 local resolver missing or duplicated'
s=s.replace(old,new,1)
old2="const matches=Object.values(snapshot.sections.products).filter(x=>str(x.barcode)===str(row.payload.barcode));"
new2="""const matches=Object.values(snapshot.sections.products).filter(x=>window.POS7_R341_normalizeBarcode(x.barcode)===window.POS7_R341_normalizeBarcode(row.payload.barcode));
  // Never call R340 with matches[0] if no unique unambiguous cloud product exists.
  if(matches.length!==1){
   job.issues.push(str(row.payload.barcode)+': هوية الصنف بحاجة إلى مراجعة؛ لا دمج تلقائي');
   job.ids.shift();save(job);busy=false;return resume();
  }
  // R340 cloud preparation is exact-barcode only. The approved alias server RPC
  // will be used by a future upgraded commit protocol; fail closed in this release.
  if(str(matches[0].barcode)!==str(row.payload.barcode)){
   job.issues.push(str(row.payload.barcode)+': الباركود البديل يحتاج ربط الاعتماد');
   job.ids.shift();save(job);busy=false;return resume();
  }"""
assert s.count(old2)==1, 'R340 cloud matcher missing'
s=s.replace(old2,new2,1)
old3="const cs=Object.values(cloud).filter(c=>str(c.barcode)===bar);"
new3="const cs=Object.values(cloud).filter(c=>window.POS7_R341_normalizeBarcode(c.barcode)===window.POS7_R341_normalizeBarcode(bar));"
assert s.count(old3)==1,'cloud isSafe matcher missing'
s=s.replace(old3,new3,1)
old4="const ls=(local?.products||[]).filter(c=>str(c.barcode)===bar);"
new4="const ls=(local?.products||[]).filter(c=>window.POS7_R341_normalizeBarcode(c.barcode)===window.POS7_R341_normalizeBarcode(bar));"
assert s.count(old4)==1,'local isSafe matcher missing'
s=s.replace(old4,new4,1)
p.write_text(s,encoding='utf-8')
print('R341 safe barcode collision guard installed')
