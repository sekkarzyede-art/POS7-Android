from pathlib import Path
from zipfile import ZipFile
import re
root=Path('r305-android')
for branch,archive in [('tab1','POS7_Tablet_v485.7.229_R213_Project.zip'),('tab2','POS7_المتجر_الثاني_TAB_R215_Android_Source.zip')]:
    destination=root/branch
    with ZipFile(archive) as z:
        for member in z.infolist():
            if not (destination/member.filename).resolve().is_relative_to(destination.resolve()):
                raise ValueError('Invalid ZIP path')
        z.extractall(destination)
    app=destination/'POS7_Tablet'
    assets=app/'app/src/main/assets'
    target=assets/'index.html'
    html=target.read_text()
    old="state=b.data;persist();toast('تمت استعادة النسخة بنجاح')"
    new="""if(window.P7TabletTest?.isBusy())return toast('انتظر اكتمال المزامنة ثم أعد الاستعادة');
localStorage.setItem('POS7_RESTORE_PENDING_R305','yes');
localStorage.removeItem('POS7_TRANSFER_REQUEST_R305');
state=b.data;persist();toast('تمت استعادة النسخة؛ اعتمد نقل الصلاحيات من صفحة المزامنة')"""
    assert html.count(old)==1
    html=html.replace(old,new)
    old='async function sync(auto=false,afterCommit=false){'
    assert html.count(old)==1
    html=html.replace(old,old+"""
 if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;
""")
    old='window.P7TabletTest={apply,delta,cashierBusy}'
    assert html.count(old)==1
    html=html.replace(old,'window.P7TabletTest={apply,delta,cashierBusy,isBusy:()=>busy}')
    if branch=='tab2':
        old='async function pos7Store2ActivateFirstTablet(){'
        assert html.count(old)==1
        html=html.replace(old,old+"""
 if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return;
 if(localStorage.getItem('POS7_TRANSFER_COMPLETED_R305')===device){
  const transferred=await C.req('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=publisher_device,revision');
  if(transferred[0]?.publisher_device===device)return Number(transferred[0].revision);
 }
""")
    html+='\n<script src="restore_transfer.js"></script>\n'
    if branch=='tab2':
        # R306: preserve all R305 restore/transfer operations; only remove
        # redundant diagnostic serialization and switch to lossless fast deflate.
        old_deflate='window.pako.deflate(value);'
        if html.count(old_deflate)!=1:
            raise RuntimeError('R306: unexpected compression path')
        html=html.replace(old_deflate,'window.pako.deflate(value,{level:1});',1)
        lines=html.splitlines(keepends=True)
        matches=[i for i,line in enumerate(lines) if 'var pos185Serialized=JSON.stringify(state);' in line]
        if len(matches)!=1:
            raise RuntimeError('R306: diagnostic-only duplicate stringify not unique')
        i=matches[0]
        if i==0 or i+1==len(lines) or 'var pos185SerializationStart=' not in lines[i-1] or 'if(pos185SerializationStart>=0)' not in lines[i+1]:
            raise RuntimeError('R306: unrecognized diagnostic instrumentation')
        del lines[i-1:i+2]
        html=''.join(lines)
        assert 'POS7_RESTORE_PENDING_R305' in html
        assert 'pos7_inventory_commit_r155' in html
        assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in html
    if branch=='tab2':
        # R307: coalesce only redundant home-dashboard renders inside
        # synchronous invoice saves. Every durable localStorage write remains.
        old_persist="""function persist(){
  pos7R102SaveStateDirect();
  renderHome();
}"""
        new_persist="""function persist(){
  pos7R102SaveStateDirect();
  if(!window.pos307MarkHomeDirty || !window.pos307MarkHomeDirty())renderHome();
}"""
        if html.count(old_persist)!=1:
            raise RuntimeError('R307 safety stop: base persist did not match')
        html=html.replace(old_persist,new_persist,1)
        marker='<script id="pos185-invoice-save-diagnostics">'
        if html.count(marker)!=1:
            raise RuntimeError('R307 safety stop: diagnostics insertion point not unique')
        add_script="""<script id="pos7-r307-invoice-home-coalesce">
(function(){
 'use strict';
 if(window.pos307HomeBatchInstalled)return;
 let depth=0,dirty=false;
 window.pos307MarkHomeDirty=function(){
   if(!depth)return false;
   dirty=true;
   return true;
 };
 function wrap(name){
   const prior=window[name];
   if(typeof prior!=='function')throw Error('R307 missing '+name);
   const guarded=function(){
     depth++;
     try{return prior.apply(this,arguments);}
     finally{
       depth--;
       if(depth===0&&dirty){
         dirty=false;
         renderHome();
       }
     }
   };
   window[name]=guarded;
   if(name==='saveSale')saveSale=guarded;
   else savePurchase=guarded;
 }
 wrap('saveSale');
 wrap('savePurchase');
 window.pos307HomeBatchInstalled=true;
})();
</script>
"""
        html=html.replace(marker,add_script+marker,1)
        # R309: defer ALL direct home renders during invoice saves, not just
        # renderHome calls originating in persist(). Durable writes untouched.
        original=" let depth=0,dirty=false;\n window.pos307MarkHomeDirty=function(){"
        replacement=""" let depth=0,dirty=false;
 window.pos309HomeBatchActive=()=>depth>0;
 const originalHome=window.renderHome;
 if(typeof originalHome!=='function')throw Error('R309 missing renderHome');
 const batchedHome=function(){
   if(depth>0){dirty=true;return;}
   return originalHome.apply(this,arguments);
 };
 window.renderHome=renderHome=batchedHome;
 window.pos307MarkHomeDirty=function(){"""
        if html.count(original)!=1:raise RuntimeError('R309: home batching insertion point mismatch')
        html=html.replace(original,replacement,1)
        # The existing R185 profiler should count executed renders, not the
        # suppressed direct renderHome calls during one invoice transaction.
        profiler="""  var wrapped=function(){
    if(!active)return original.apply(this,arguments);
    var start=perf();"""
        corrected="""  var wrapped=function(){
    if(!active)return original.apply(this,arguments);
    if(name==='renderHome' && window.pos309HomeBatchActive?.())return original.apply(this,arguments);
    var start=perf();"""
        if html.count(profiler)!=1:raise RuntimeError('R309: profiler insertion point mismatch')
        html=html.replace(profiler,corrected,1)
        if 'window.pos309HomeBatchActive=()=>depth>0;' not in html or "if(name==='renderHome' && window.pos309HomeBatchActive?.())" not in html:
            raise RuntimeError('R309: batching/profile instrumentation missing')
    if branch=='tab2':
        # R310 trial: batch NEW PURCHASE invoices only. Cash/credit invoice
        # edits, sales and auto-print keep the proven R309 write path.
        # Keep R213 inventory gate: only defer AFTER its safety check.
        guard="""  if(window.POS7_R166_RELOAD_REQUIRED||window.POS7_R167_RECONCILIATION_PENDING||window.POS7_R212_BATCH_ACTIVE)throw Error('R213: اعتماد دفعة الجرد جارٍ؛ لا تغيّر المخزون حتى انتهاء الدفعة');"""
        if html.count(guard)!=1:raise RuntimeError('R310: unexpected direct-save safety gate')
        html=html.replace(guard,guard+"\n  if(window.pos310DeferSave?.())return;",1)
        # The purchase journal MUST be added to memory before the sole durable
        # state write. Preserve the old direct-write path outside the trial.
        journal_old="localStorage.setItem(KEY,JSON.stringify(state));return r}catch(e){var restored=JSON.parse(beforeState)"
        journal_new="(window.pos310PurchaseActive?.()?pos7R102SaveStateDirect():localStorage.setItem(KEY,JSON.stringify(state)));return r}catch(e){var restored=JSON.parse(beforeState)"
        if html.count(journal_old)!=1:raise RuntimeError('R310: purchase journal commit path changed')
        html=html.replace(journal_old,journal_new,1)
        rollback_old="purchaseCart=cartBefore;try{localStorage.setItem(KEY,beforeState)}catch(storageError){}"
        rollback_new="purchaseCart=cartBefore;try{if(!window.pos310PurchaseActive?.())localStorage.setItem(KEY,beforeState)}catch(storageError){}"
        if html.count(rollback_old)!=1:raise RuntimeError('R310: purchase journal rollback path changed')
        html=html.replace(rollback_old,rollback_new,1)
        # Hold auto-cloud publish until the local invoice transaction commits.
        sync_marker="if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;"
        if html.count(sync_marker)!=1:raise RuntimeError('R310: missing cloud gate')
        html=html.replace(sync_marker,sync_marker+"\n if(window.pos310PurchaseActive?.())return false;",1)
        trial_script="""<script id="pos7-r310-purchase-single-commit">
(function(){
 'use strict';
 if(window.pos310Installed)return;
 const original=window.savePurchase;
 if(typeof original!=='function')throw Error('R310: purchase save function missing');
 let active=false,committing=false,deferred=0;
 window.pos310PurchaseActive=()=>active;
 window.pos310DeferSave=function(){
   if(!active||committing)return false;
   deferred++;
   return true;
 };
 window.pos310Last=null;
 function restoreState(raw,cartRaw,mode,source){
   const restored=JSON.parse(raw);
   Object.keys(state).forEach(k=>delete state[k]);
   Object.assign(state,restored);
   purchaseCart=JSON.parse(cartRaw);
   purchasePayment=mode;
   purchaseSource=source;
 }
 const wrapped=function(){
   // Safer first trial: avoid legacy edit paths and pre-commit auto printing.
   if(editingPurchaseId!=null||window.pos408GetSettings?.().autoPrint)
     return original.apply(this,arguments);
   if(active){toast('عملية حفظ الشراء قيد التنفيذ');return false;}
   const oldState=JSON.stringify(state);
   const oldCart=JSON.stringify(purchaseCart||[]);
   const oldMode=purchasePayment,oldSource=purchaseSource;
   const existingIds=new Set((state.purchases||[]).map(x=>String(x.id)));
   let result,committed=false;
   deferred=0;active=true;
   try{
     result=original.apply(this,arguments);
     const created=(state.purchases||[]).filter(x=>!existingIds.has(String(x.id)));
     if(result===false||created.length===0){
       // No new invoice is not a successful transaction. All suppressed
       // writes must be discarded, including validation/ledger rollback.
       if(deferred)restoreState(oldState,oldCart,oldMode,oldSource);
       window.pos310Last={status:'skipped',deferred:deferred};
       return result;
     }
     if(created.length!==1)throw Error('R310: invoice identity is ambiguous');
     const inv=created[0];
     if(!inv||inv.cancelled||!inv.number)throw Error('R310: incomplete invoice');
     if((state.purchases||[]).filter(x=>String(x.number)===String(inv.number)).length!==1)
       throw Error('R310: duplicate purchase invoice number');
     const sourceKey='purchase:'+String(inv.id);
     const journal=(state.doubleEntryJournal||[]).find(x=>x.sourceKey===sourceKey&&!x.reversed);
     if(!journal||!journal.balanced||!journal.posted||
        Math.abs(Number(journal.totalDebitUSD)-Number(journal.totalCreditUSD))>0.000001)
       throw Error('R310: balanced accounting entry missing');
     if(deferred===0)throw Error('R310: expected deferred writes absent');
     committing=true;
     pos7R102SaveStateDirect(); // one revision stamp + one compressed local write
     committing=false;committed=true;
     window.pos310Last={status:'committed',reference:inv.number,
                         deferred:deferred,durableWrites:1};
     return result;
   }catch(err){
     if(!committed){
       try{restoreState(oldState,oldCart,oldMode,oldSource)}
       catch(rollbackError){console.error('R310 local rollback',rollbackError)}
     }
     window.pos310Last={status:'failed',deferred:deferred,error:String(err?.message||err)};
     console.error('R310 purchase commit rejected',err);
     toast('لم يُعتمد حفظ الشراء؛ أُعيدت الحالة السابقة. '+String(err?.message||err));
     return false;
   }finally{
     active=false;committing=false;
     if(window.pos310Last?.status==='failed'){
       try{renderPurchaseCart();renderHome()}catch(e){console.warn(e)}
     }
   }
 };
 window.savePurchase=savePurchase=wrapped;
 window.pos310Installed=true;
})();
</script>
"""
        diag_marker='<script id="pos185-invoice-save-diagnostics">'
        if html.count(diag_marker)!=1:raise RuntimeError('R310: diagnostic script not unique')
        html=html.replace(diag_marker,trial_script+diag_marker,1)
        assert html.count('id="pos7-r310-purchase-single-commit"')==1
        assert 'POS7_RESTORE_PENDING_R305' in html
        assert 'window.pos309HomeBatchActive' in html
    build_tag='r310' if branch=='tab2' else 'r305'
    if branch=='tab2':
        # R308: the on-screen version is generated from the SAME build tag
        # used for Android versionName, instead of the old R215 text.
        # R215 RPC/function names remain untouched; those are protocol IDs.
        build_version=f'485.7.229-{build_tag}-{branch}'
        banner=r'(<div id="pos7-store2-r215-banner" dir="rtl">)([^<]*)(</div>)'
        html,count=re.subn(banner,lambda m:m.group(1)+'المتجر الثاني — قاعدة مستقلة • '+build_version+m.group(3),html,count=1)
        if count!=1:raise RuntimeError('R308: failed to locate exact home version banner')
        if not html.count('المتجر الثاني — قاعدة مستقلة • '+build_version)==1:
            raise RuntimeError('R308: home version banner is not unique')
    target.write_text(html)
    (assets/'restore_transfer.js').write_text(Path('pos7-release-audit/r305/restore_transfer.js').read_text())
    gradle=app/'app/build.gradle'
    gradle.write_text(re.sub(r"versionName\s+['\"][^'\"]+['\"]",f"versionName '485.7.229-{build_tag}-{branch}'",gradle.read_text(),count=1))
print('Prepared both operational Android sources with restored-backup transfer entrypoint')
