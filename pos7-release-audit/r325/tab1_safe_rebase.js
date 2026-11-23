/* R325 Store1 ONLY: tablet-authoritative product reconciliation.
 * Publisher and inventory gate unchanged; pending inventory requests untouched.
 * After atomic remote archive+snapshot/catalog rewrite, repairs ONLY local
 * stock revision metadata (not quantities, products, invoices or money).
 */
(function(){
'use strict';
const MAIN='POS7_TRIAL188_CLEAN',PENDING='POS7_R325_REBASE_PENDING',VERIFIED='POS7_R174_SMART_CAS_SERVER_VERIFIED';
let busy=false;
function el(id){return document.getElementById(id)}
function note(s){const x=el('pos7R325Status');if(x)x.textContent=s}
function fail(s){throw Error('R325: '+s)}
function device(){return localStorage.getItem('POS7_CLOUD_DEVICE_V1')||''}
function kv(row,ids,bcs,names){
 const id=String(row.id??row.barcode??row.name??''),bc=String(row.barcode||'').trim(),nm=String(row.name||'').trim();
 if((ids.get(id)||0)>1){
  if(bc&&(bcs.get(bc)||0)===1)return 'barcode:'+bc;
  if(nm&&(names.get(nm)||0)===1)return 'name:'+nm;
  fail('معرّف صنف مكرر لا يمكن فصله بباركود أو اسم فريد: '+id);
 }
 return id;
}
function count(data,fn){
 const m=new Map();data.forEach(x=>{let k=fn(x);if(k)m.set(k,(m.get(k)||0)+1)});return m;
}
function plansFromSnapshot(raw,sections){
 const stored=JSON.parse(raw);
 if(!stored||!Array.isArray(stored.products)||!sections?.products)fail('نسخة التاب غير قابلة للقراءة');
 const items=stored.products;
 const ids=count(items,p=>String(p.id??p.barcode??p.name??''));
 const bcs=count(items,p=>String(p.barcode||'').trim());
 const names=count(items,p=>String(p.name||'').trim());
 const planned=[],keys=new Set();
 for(let i=0;i<items.length;i++){
  const p=items[i],key=kv(p,ids,bcs,names);
  if(keys.has(key))fail('مفتاح مزامنة مكرر: '+key);
  keys.add(key);
  const pub=sections.products[key];
  if(!pub||String(pub.barcode||'')!==String(p.barcode||'')||
   String(pub.name||'')!==String(p.name||'')||Number(pub.stock)!==Number(p.stock))
   fail('فشل مطابقة صنف قبل النشر: '+key);
  if(!Number.isFinite(Number(p.stock)))fail('كمية غير صالحة: '+key);
  const localRev=Number(p.stock_revision);
  const trusted=p.stock_revision_untrusted!==true&&p.stock_revision!=null&&
     Number.isSafeInteger(localRev)&&localRev>=0;
  const rev=trusted?localRev:0;
  if(rev>999999999999999)fail('تجاوز مراجعة المخزون: '+key);
  sections.products[key].stock_revision=rev;
  sections.products[key].stock_revision_untrusted=false;
  planned.push({index:i,key,name:String(p.name||''),barcode:String(p.barcode||''),
   qty:Number(p.stock),oldRev:p.stock_revision,oldUntrusted:p.stock_revision_untrusted,
   newRev:rev,requiresRepair:!trusted});
 }
 if(items.length!==keys.size||Object.keys(sections.products).length!==items.length)
   fail('لم تُحفظ جميع الأصناف مع المعرّفات المكررة؛ أوقفنا النشر');
 if(items.length<1||items.length>10000)fail('عدد الأصناف غير معقول');
 return {planned,productCount:items.length};
}
function patchMetadata(raw,planned){
 const data=JSON.parse(raw);
 for(const p of planned){
  const x=data.products[p.index];
  if(!x||String(x.name||'')!==p.name||String(x.barcode||'')!==p.barcode||
    Number(x.stock)!==p.qty)fail('تغير صنف أثناء إصلاح المراجعة: '+p.key);
  if(p.requiresRepair){x.stock_revision=p.newRev;x.stock_revision_untrusted=false}
 }
 return JSON.stringify(data);
}
function canon(x){
 if(Array.isArray(x))return x.map(canon);
 if(x&&typeof x==='object'){
  const out={};for(const k of Object.keys(x).sort())if(x[k]!==undefined)out[k]=canon(x[k]);
  return out;
 }
 return x;
}
function comparableSections(s){
 const out=JSON.parse(JSON.stringify(s));
 if(out.meta&&typeof out.meta==='object'&&out.meta.info&&typeof out.meta.info==='object')delete out.meta.info.generatedAt;
 return JSON.stringify(canon(out));
}
// R332: read-only full snapshot verification can exceed P7Cloud.req's 20s
// default timeout on the 4413-product store. Do not change normal sync RPCs.
async function readCloudForFinalVerification(){
 const cloud=window.P7Cloud;
 const path='/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=sections,revision';
 if(!cloud?.session||!cloud?.url||!cloud?.key)
  fail('جلسة Supabase غير متاحة للتحقق النهائي');
 const attempt=async function(retry){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),120000);
  try{
   const res=await fetch(cloud.url+path,{signal:ctl.signal,
    headers:{apikey:cloud.key,Authorization:'Bearer '+cloud.session.access_token,
     'Content-Type':'application/json'}});
   if(res.status===401&&retry&&cloud.session.refresh_token){
    await cloud.refresh();return attempt(false);
   }
   if(!res.ok)throw Error('فشل قراءة السحابة HTTP '+res.status+': '+(await res.text()).slice(0,250));
   return await res.json();
  }catch(e){
   if(ctl.signal.aborted)
    throw Error('انتهت مهلة قراءة التحقق (120 ثانية)؛ لم نعد النشر، بقيت حماية المخزون مفعلة');
   throw e;
  }finally{clearTimeout(timer)}
 };
 return attempt(true);
}
async function repairLocal(req,verified){
 const raw=localStorage.getItem(MAIN);
 if(!raw)fail('تعذر قراءة قاعدة التاب بعد النشر');
 const current=await window.pos7BuildOwnerSnapshot(()=>
   !window.P7TabletTest?.cashierBusy());
 if(localStorage.getItem(MAIN)!==raw)fail('تغيرت قاعدة التاب أثناء التحقق');
 const sections=JSON.parse(JSON.stringify(current.sections));
 const {planned,productCount}=plansFromSnapshot(raw,sections);
 if(productCount!==req.product_count)fail('تغير عدد الأصناف قبل الحفظ المحلي');
 if(!verified?.ok||!verified.same_device||
    verified.fingerprint!==verified.expected_fingerprint||
    Number(verified.catalog_count)!==productCount)
   fail('لم يثبت تطابق السحابة مع بيانات التاب');
 note('R332: نقرأ النسخة السحابية المؤرشفة للتحقق النهائي فقط؛ قد يستغرق التحميل وقتًا بسبب حجم البيانات...');
 const cloud=await readCloudForFinalVerification();
 if(!Array.isArray(cloud)||cloud.length!==1||
    Number(cloud[0].revision)!==Number(verified.revision)||
    comparableSections(cloud[0].sections)!==comparableSections(sections))
   fail('حالة السحابة بعد النشر لا تطابق النسخة المحلية؛ بقيت حماية المخزون. لم يتم نشر الأصناف مرة ثانية');
 if(localStorage.getItem(MAIN)!==raw)fail('حدثت تغييرات محلية أثناء التحقق النهائي');
 const updated=patchMetadata(raw,planned);
 if(updated!==raw){
  localStorage.setItem(MAIN,updated);
  if(localStorage.getItem(MAIN)!==updated)
    fail('فشلت قراءة التحديث المحلي بعد الحفظ؛ المزامنة ما زالت محجوبة');
 }
 const memory=(typeof state!=='undefined'&&state?.products)||null;
 if(memory&&memory.length===planned.length){
  for(const p of planned)if(p.requiresRepair){
   const x=memory[p.index];
   if(x&&String(x.barcode||'')===p.barcode&&Number(x.stock)===p.qty){
    x.stock_revision=p.newRev;x.stock_revision_untrusted=false;
   }
  }
 }
 localStorage.setItem(VERIFIED,'yes');
 if(localStorage.getItem(VERIFIED)!=='yes')fail('تعذر حفظ تحقق حماية R174');
 localStorage.removeItem(PENDING);
 alert('R325: تمت مطابقة سحابة سكر زيادة مع التاب 1 مع حماية الجرد.\n'
 +'النسخة السحابية القديمة مؤرشفة؛ لم تتغير كميات التاب ولا الفواتير أو الصناديق.\n'
 +'طلب جرد الهاتف المعلّق بقي للمراجعة، ولم ننقل صلاحيات النشر.');
 location.reload();
}
async function run(){
 if(busy){note('الفحص قيد التنفيذ، لم نبدأ عملية إضافية');return;}
 note('R327: استُقبل الضغط، نتحقق من اتصال المالك وحالة الفاتورة...');
 const cloud=window.P7Cloud;
 if(!cloud?.session){note('يجب تسجيل الدخول بحساب المالك قبل الإصلاح');return alert('سجّل دخول مالك متجر سكر زيادة أولًا.');}
 if(!navigator.onLine){note('الاتصال بالإنترنت غير متاح');return alert('الاتصال بالإنترنت ضروري للمطابقة الآمنة.');}
 if((typeof window.P7TabletTest?.cashierBusy==='function' && window.P7TabletTest.cashierBusy()) || (typeof window.P7TabletTest?.isBusy==='function' && window.P7TabletTest.isBusy()))return alert('أغلق الفاتورة الحالية أولًا.');
 if(!device()){note('معرّف الناشر المحلي غير متاح');return alert('معرّف التاب غير متاح؛ العملية متوقفة');}
 busy=true;
 try{
  const source=localStorage.getItem(MAIN);
  if(!source)fail('لا توجد بيانات تاب محفوظة');
  const rows=await cloud.req('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=revision,publisher_device');
  if(!Array.isArray(rows)||rows.length!==1)fail('تعذر قراءة سحابة المتجر الأول');
  if(rows[0].publisher_device!==device())fail('هذا التاب ليس الناشر المعتمد؛ لن نغيّر الصلاحيات');
  const existing=JSON.parse(localStorage.getItem(PENDING)||'null');
  let req=existing;
  if(req){
   if(req.device!==device()||!req.request_id)fail('طلب سابق غير متطابق');
   note('R328: فحص المحاولة السابقة قبل أي إجراء...');
   const status=await cloud.rpc('pos7_restore_same_device_status_r325',{p_request_id:req.request_id});
   if(status?.ok&&status.same_device)return await repairLocal(req,status);
   // A PostgreSQL statement_timeout rolls back the whole transaction, including
   // its archive receipt. Retry is only possible when the server confirms the
   // receipt is missing AND the cloud revision remains exactly the old value.
   if(status?.reason==='receipt_missing' &&
      Number(rows[0].revision)===Number(req.expected)){
     localStorage.removeItem(PENDING);
     if(localStorage.getItem(PENDING)!==null)
       fail('تعذر إلغاء رمز المحاولة الملغاة؛ لم نبدأ محاولة جديدة');
     note('R328: لم تُنفذ المحاولة السابقة؛ نجهز موافقة جديدة دون تغيير بيانات التاب...');
     req=null;
   }else{
     fail('لا يمكن تأكيد إلغاء المحاولة السابقة أو تغيّرت مراجعة السحابة؛ أوقفنا النشر حماية للبيانات');
   }
  }
  note('R327: فحص أصناف التاب وإنشاء بيانات المطابقة...');
  const snapshot=await window.pos7BuildOwnerSnapshot(()=>
   !window.P7TabletTest?.cashierBusy());
  if(localStorage.getItem(MAIN)!==source)fail('تغيرت بيانات التاب أثناء إنشاء النسخة');
  const sections=JSON.parse(JSON.stringify(snapshot.sections));
  const {planned,productCount}=plansFromSnapshot(source,sections);
  const normalize=planned.filter(p=>p.requiresRepair).length;
  const prompt='سيعتمد سكر زيادة (تاب 1) بياناته الحالية على سحابته فقط.\n'
   +'الأصناف: '+productCount+'، مراجعات مخزون ستبدأ مرجعًا جديدًا: '+normalize+'.\n'
   +'سنحفظ نسخة أرشيفية كاملة للسحابة، ولن نحذف بيانات التاب أو نغيّر صلاحيات النشر والجرد.\n'
   +'طلبات جرد الهاتف المتعارضة ستبقى معلقة للمراجعة، دون تطبيقها تلقائيًا.\n'
   +'هذا يغيّر بيانات سحابة المتجر الأول. هل توافق؟';
  note('R327: اكتمل الفحص المبدئي. انتظر رسالة التأكيد...');
  if(!confirm(prompt))return;
  const request={request_id:crypto.randomUUID(),device:device(),
    expected:Number(rows[0].revision),product_count:productCount};
  if(!Number.isSafeInteger(request.expected))fail('مراجعة السحابة غير صحيحة');
  // Persist the EXACT remote payload before any remote action for idempotent retry.
  localStorage.setItem(PENDING,JSON.stringify(request));
  if(localStorage.getItem(MAIN)!==source)fail('تغيرت البيانات قبل عملية النشر');
  note('أرشفة السحابة ونشر بيانات التاب 1 مع حماية المخزون...');
  const result=await cloud.rpc('pos7_restore_same_device_r325',{
   p_request_id:request.request_id,p_device:request.device,
   p_expected:request.expected,p_sections:sections
  });
  if(!result?.ok||result.publisher_device!==device()||result.approved_device!==device())
   fail('لم يؤكد الخادم هوية الجهاز ونجاح الحفظ');
  const status=await cloud.rpc('pos7_restore_same_device_status_r325',{p_request_id:request.request_id});
  if(!status?.ok||!status.same_device||Number(status.revision)!==Number(result.revision))
   fail('لم يكتمل تحقق السحابة؛ أبقينا المزامنة محمية');
  note('تثبيت مراجعات المخزون محليًا دون تغيير كمياته أو الفواتير...');
  await repairLocal(request,status);
 }catch(e){
  note('لم تكتمل المطابقة؛ لم نمس بيانات التاب: '+String(e?.message||e));
  alert('R325: توقفت المطابقة حمايةً للمتجر.\n'+String(e?.message||e));
 }finally{busy=false}
}
function mount(){
 if(el('pos7R325Panel'))return;
 const anchor=el('p57Now');
 if(!anchor)return;
 const panel=document.createElement('div');panel.id='pos7R325Panel';
 panel.dir='rtl';panel.style.cssText='margin:10px 0;padding:12px;background:#eef6ff;border:2px solid #1d4ed8;border-radius:12px;display:flex;flex-direction:column;gap:8px';
 const button=document.createElement('button');
 button.id='pos7R325Button';button.type='button';
 button.style.cssText='padding:12px;border-radius:8px;background:#1d4ed8;color:white;font:bold 15px Arial';
 button.textContent='☁ إصلاح نشر 4413 صنفًا R325 — التاب 1 فقط';
 button.onclick=run;
 const st=document.createElement('div');st.id='pos7R325Status';st.style.cssText='font-size:13px;color:#1e3a8a';
 st.textContent='مطابقة بأرشيف كامل وحماية مخزون، ولا تنقل صلاحيات النشر أو الجرد.';
 panel.appendChild(button);panel.appendChild(st);anchor.after(panel);
}
window.POS7_R325_SAFE_SYNC={run,status:()=>({
  device:device(),pending:!!localStorage.getItem(PENDING),
  serverCasVerified:localStorage.getItem(VERIFIED)==='yes'
})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
else mount();
if(window.MutationObserver)new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
})();
