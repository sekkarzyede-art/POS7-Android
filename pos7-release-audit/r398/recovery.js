function restoreFreshBackup(backup){
 if(!backup||backup.app!=='POS7'||!backup.data||typeof backup.data!=='object')
  throw Error('اختر ملف JSON من نسخة احتياطية لبرنامج POS7');
 const next=backup.data;
 valid(JSON.stringify(next));
 if(next.products.some(p=>!p||typeof p!=='object'||Array.isArray(p)))
  throw Error('بنية سجل الأصناف غير صالحة');
 verifyStoredProject();
 if(nativeRead()!==null||oldGet.call(window.localStorage,MAIN)!==null)
  throw Error('ظهرت بيانات محلية؛ أعد فتح التطبيق قبل المتابعة');
 next.pos7R387LocalRestore=true;
 for(const product of next.products){
  product.stock_revision=null;
  product.stock_revision_untrusted=true;
 }
 const raw=JSON.stringify(next);
 if(bridge.pos322WriteState(raw)!==true)throw Error('تعذّر حفظ النسخة على الجهاز');
 if(nativeRead()!==raw)throw Error('تعذر التحقق من النسخة المكتوبة؛ أعد فتح التطبيق');
}
function showFreshRestore(){
 document.addEventListener('DOMContentLoaded',()=>{
  const box=document.createElement('div');
  box.id='pos7R322FreshRestore';box.dir='rtl';box.setAttribute('role','dialog');
  box.style.cssText='position:fixed;inset:8%;z-index:2147483647;padding:24px;background:white;color:#183047;overflow:auto;border:3px solid #28714c;border-radius:14px;font:18px Arial';
  box.innerHTML='<h2>استعادة تاب ٢ بعد التثبيت</h2><p>لم يجد التطبيق بيانات محلية. اختر أحدث نسخة احتياطية JSON لتاب ٢. إذا كانت النسخة ZIP، فك الضغط واختر ملف JSON بداخلها.</p><button type="button">اختيار نسخة تاب ٢</button><input type="file" hidden accept=".json,application/json"><p role="status" aria-live="polite"></p>';
  const input=box.querySelector('input'),button=box.querySelector('button'),status=box.querySelector('[role=status]');
  button.onclick=()=>input.click();
  input.onchange=async()=>{
   const file=input.files?.[0];input.value='';if(!file)return;
   button.disabled=true;
   try{
    const backup=JSON.parse(await file.text());
    if(prompt('أدخل كلمة مرور الاستعادة')!=='1212'){status.textContent='أُلغيت الاستعادة أو كلمة المرور غير صحيحة';return;}
    if(!confirm('هل تؤكد أن '+file.name+' هي نسخة تاب ٢؟ ستبدأ الاستعادة محليًا والمزامنة معلّقة.'))return;
    restoreFreshBackup(backup);
    status.textContent='تم التحقق من النسخة. جارٍ إعادة فتح تاب ٢…';
    location.reload();
   }catch(e){status.textContent='تعذرت الاستعادة. '+e.message;}
   finally{button.disabled=false;}
  };
  document.body.appendChild(box);
 },{once:true});
}
