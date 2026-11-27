from pathlib import Path
import hashlib,sys
p=Path(sys.argv[1]);s=p.read_text();assert hashlib.sha256(s.encode()).hexdigest()=='16509b5547dda7328d76567c6447a72423af2852d1f2c1a0c6d6a40edbc99fb4'
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b,1)
rep('const old=p.id,key=String(old),matches=[],other=[];', '''const old=p.id,key=String(old),matches=[],other=[],preserved=[];
  const logs=d.inventoryAdjustments||[],markers=d.pos7InventoryApplied||{};
  function verifiedPair(log){
   const event=String(log?.cloudEventId||''),marker=markers[event];
   return event&&log.source==='owner_phone_inventory_r343'&&log.id==='INV-'+event&&String(log.productId)===key&&String(log.cloudProductId)===key&&marker?.source==='cloud_r155'&&String(marker.eventId)===event&&String(marker.productId)===key&&norm(marker.barcode)===norm(p.barcode)&&marker.reference==='INV-'+event&&Number.isFinite(Number(log.countedQty))&&Number(log.countedQty)===Number(marker.countedQty??marker.after)&&Number(log.after)===Number(marker.localAfter)&&logs.filter(x=>String(x.cloudEventId)===event).length===1;
  }''')
rep("if(allowed&&norm(v.barcode)&&norm(v.barcode)===norm(p.barcode))matches.push({v,k,path:at});\n     else other.push(at.join('.'));",'''if(allowed&&norm(v.barcode)&&norm(v.barcode)===norm(p.barcode))matches.push({v,k,path:at});
     else if(path.length===2&&path[0]==='inventoryAdjustments'&&verifiedPair(v)&&(k==='productId'||k==='cloudProductId')){
      if(k==='productId')matches.push({v,k,path:at});else preserved.push(at.join('.'));
     }else if(path.length===2&&path[0]==='pos7InventoryApplied'&&k==='productId'&&logs.some(log=>String(log.cloudEventId)===path[1]&&verifiedPair(log)))preserved.push(at.join('.'));
     else other.push(at.join('.'));''')
rep('references:matches.map(x=>x.path)});','references:matches.map(x=>x.path),preservedCloudReferences:preserved});')
rep("result.report.version='R385';","result.report.version='R386';")
rep("version:'R385',...report()","version:'R386',...report()")
rep("const VERSION='R385', MAX=250;","const VERSION='R386', MAX=250;")
rep("make('h3','تشخيص الأداء المتقدم — R385');","make('h3','تشخيص الأداء المتقدم — R386');")
rep('485.7.229-r385-tab2','485.7.229-r386-tab2')
s=s.replace('POS7_R385_RESTORE_REVIEW.json','POS7_R386_RESTORE_REVIEW.json').replace('POS7_R385_backup_audit.json','POS7_R386_backup_audit.json')
p.write_text(s)
if len(sys.argv)>2:
 Path('/tmp/r364-html.sha').write_text(hashlib.sha256(s.encode()).hexdigest());g=p.parents[3]/'build.gradle';raw=g.read_text();assert raw.count("versionName '485.7.229-r385-tab2'")==1;g.write_text(raw.replace("versionName '485.7.229-r385-tab2'","versionName '485.7.229-r386-tab2'"))
