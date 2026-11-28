from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
assert 'pos404DebtNames' not in s
for kind in ('customer','supplier'):
 old=f'''<button type="button" class="pos783-print-button" onclick="pos783PrintMenuReport('{kind}')">🖨️ طباعة / حفظ PDF</button>'''
 assert s.count(old)==1
 new='<div class="pos404-print-actions">'+old+f'''<button type="button" class="primary" onclick="pos404DebtNames('{kind}')">🖨️ عرض / طباعة Bluetooth — الأسماء ذات الرصيد</button></div>'''
 s=s.replace(old,new)
native=r'''
window.pos404PrintNames=async function(report){
 const bridge=window.Pos7Android;
 if(typeof bridge?.printBluetoothBase64!=='function'||!bridge.getSelectedBluetoothPrinterAddress?.())return toast('اختر طابعة Bluetooth المعتمدة من إعدادات الطباعة');
 if(btBusy)return toast('الطابعة تنفذ عملية أخرى؛ انتظر حتى تنتهي');
 if(!report.names.length)return false;
 btBusy=true;
 try{
  const width=Number(read().paperDots)===384?384:576,parts=[];
  for(let start=0;start<report.names.length;start+=80){
   const first=start===0,last=start+80>=report.names.length,canvas=document.createElement('canvas');
   canvas.width=width;
   const ctx=canvas.getContext('2d'),lines=[];
   ctx.font='bold 25px Arial,Tahoma,sans-serif';
   for(const name of report.names.slice(start,start+80)){
    let line='';
    for(const char of name){if(line&&ctx.measureText(line+char).width>width-36){lines.push(line);line='';}line+=char;}
    lines.push(line);lines.push('');
   }
   canvas.height=(first?100:0)+lines.reduce((n,line)=>n+(line?36:10),0)+10;
   ctx.fillStyle='#fff';ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle='#000';
   ctx.direction='rtl';ctx.textAlign='right';ctx.font='bold 25px Arial,Tahoma,sans-serif';
   let y=0;
   if(first){ctx.textAlign='center';ctx.fillText(report.title,width/2,32,width-24);ctx.font='20px Arial,Tahoma,sans-serif';ctx.fillText(report.date,width/2,65,width-24);ctx.fillRect(12,80,width-24,1);ctx.textAlign='right';ctx.font='bold 25px Arial,Tahoma,sans-serif';y=100;}
   for(const line of lines){if(line){ctx.fillText(line,width-18,y+27);y+=36;}else y+=10;}
   const bytes=escPosBytes(canvas);parts.push(bytes.subarray(first?0:2,last?bytes.length:bytes.length-6));
   canvas.width=1;canvas.height=1;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const ok=await pos7SendNativeBluetooth(bytes,report.title,true);
  toast(ok?'أُرسلت الأسماء إلى طابعة Bluetooth':'تعذرت الطباعة؛ تحقّق من الطابعة قبل إعادة المحاولة');return ok;
 }catch(e){console.error(e);toast('تعذر تجهيز قائمة الأسماء للطباعة');return false;}finally{btBusy=false;}
};
'''
assert s.count('window.pos408GetSettings=read;')==1
s=s.replace('window.pos408GetSettings=read;',native+'\nwindow.pos408GetSettings=read;')
ui=r'''
<style id="pos404-debt-names-style">
.pos404-print-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.pos404-print-actions>button{flex:1;min-width:180px;width:auto!important;margin:0!important}
#pos404NamesDialog{width:min(540px,94vw);max-height:90vh;box-sizing:border-box;border:1px solid #b7cdbd;border-radius:14px;padding:14px;color:#183047}
#pos404NamesDialog::backdrop{background:#10271ba8}#pos404NamesDialog header{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#pos404NamesDialog h3{flex:1;margin:0}#pos404NamesDialog ol{max-height:58vh;overflow:auto;padding-inline-start:32px}#pos404NamesDialog li{padding:9px 3px;border-bottom:1px solid #ddd;overflow-wrap:anywhere;color:#182d50}#pos404NamesDialog button{min-height:44px}
</style>
<script id="pos404-debt-names">
(()=>{
'use strict';
function allowed(kind){if(!['customer','supplier'].includes(kind))return false;if(!window.v250Can?.(kind==='customer'?'customers':'suppliers')){toast('لا توجد صلاحية لعرض هذه القائمة');return false;}return true;}
window.pos404DebtNameSnapshot=function(kind){
 const customer=kind==='customer',party=kind,table=customer?'customers':'suppliers';
 const names=new Set(Object.keys(state[table]||{}));
 for(const key of customer?['sales','salesReturns','customerPayments']:['purchases','purchaseReturns','supplierPayments'])for(const row of state[key]||[])if(row?.[party])names.add(row[party]);
 for(const row of state.openingBalanceEntries||[])if(row&&!row.cancelled&&row.partyType===kind)names.add(row.partyName);
 const balance=customer?window.pos398CustomerStatementBalanceUSD:window.pos265SupplierBalanceUSD;
 if(typeof balance!=='function')throw Error('تعذر قراءة الأرصدة الحالية');
 const collect=()=>[...names].filter(n=>typeof n==='string'&&n.trim()&&n!=='زبون نقدي').filter(n=>{const v=Number(balance(n));if(!Number.isFinite(v))throw Error('تعذر قراءة رصيد '+n);return Math.round(v*100)>0;}).sort((a,b)=>a.localeCompare(b,'ar',{numeric:true,sensitivity:'base'}));
 return {kind,title:customer?'العملاء — أرصدة مستحقة':'الموردون — أرصدة مستحقة',date:new Date().toLocaleString('ar-LB'),names:customer&&window.pos389WithBalanceIndex?window.pos389WithBalanceIndex(collect,null,[]):collect()};
};
window.pos404DebtNames=function(kind){
 if(!allowed(kind))return;
 let report;try{report=window.pos404DebtNameSnapshot(kind);}catch(e){toast(e.message);return;}
 document.getElementById('pos404NamesDialog')?.close();
 const d=document.createElement('dialog');d.id='pos404NamesDialog';d.dir='rtl';d.setAttribute('aria-labelledby','pos404NamesTitle');
 const add=(parent,tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.appendChild(el);return el;};
 const head=add(d,'header');add(head,'h3',report.title).id='pos404NamesTitle';
 const close=add(head,'button','إغلاق ×');close.type='button';close.className='soft';close.onclick=()=>d.close();
 add(d,'p','أسماء فقط، دون مبالغ — '+report.names.length+' اسم');
 const print=add(d,'button','🖨️ طباعة Bluetooth');print.type='button';print.className='primary';print.disabled=!report.names.length;
 print.onclick=async()=>{if(print.disabled||!allowed(kind))return;print.disabled=true;try{await window.pos404PrintNames(report);}finally{print.disabled=false;}};
 if(report.names.length){const list=add(d,'ol');for(const name of report.names)add(list,'li',name);}else add(d,'p','لا توجد أرصدة مستحقة.');
 d.addEventListener('close',()=>d.remove(),{once:true});document.body.appendChild(d);d.showModal();
};
})();
</script>
'''
s+='\n'+ui
s=s.replace('485.7.229-r403-tab1','485.7.229-r404-tab1').replace("VERSION='R403', MAX=250","VERSION='R404', MAX=250").replace('تشخيص الأداء المتقدم — R403','تشخيص الأداء المتقدم — R404')
p.write_text(s)
if len(sys.argv)>2:
 g=p.parents[3]/'build.gradle';v=g.read_text();assert '485.7.229-r403-tab1' in v;g.write_text(v.replace('485.7.229-r403-tab1','485.7.229-r404-tab1'))
