 function canPrint(){
  if(!document.getElementById('home')?.classList.contains('active'))return false;
  if(pos391Private){pos391Blocked();return false;}
  if(!window.v250Can?.('cash')){toast('لا توجد صلاحية لعرض حركة الصندوق');return false;}
  return true;
 }
 function append(parent,tag,text){
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  parent.appendChild(node);
  return node;
 }
 function signedMoney(cents){
  return (cents>0?'+':cents<0?'−':'')+'$'+(Math.abs(cents)/100).toFixed(2);
 }
 function showPreview(report){
  if(document.getElementById('pos399CashPreview'))return;
  const dialog=document.createElement('dialog');
  dialog.id='pos399CashPreview';dialog.dir='rtl';
  dialog.setAttribute('aria-labelledby','pos399CashTitle');
  const title=append(dialog,'h2','معاينة جرد الصندوق اليومي');
  title.id='pos399CashTitle';
  const timestamp=append(dialog,'p',report.displayDay+' · '+report.displayTime);
  timestamp.dir='ltr';
  const summary=append(dialog,'div');
  summary.className='pos399-cash-summary';
  for(const [label,cents] of [['الداخل',report.incoming],['الخارج',-report.outgoing],['صافي النقد اليوم',report.balance]]){
   const item=append(summary,'div');
   append(item,'span',label);
   append(item,'b',signedMoney(cents)).dir='ltr';
  }
  const actions=append(dialog,'div');
  actions.className='pos399-cash-actions';
  const print=append(actions,'button','🖨️ طباعة عبر Bluetooth');
  print.type='button';print.className='primary';
  const close=append(actions,'button','إغلاق ×');
  close.type='button';close.className='soft';
  close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('pos397DailyCash')?.focus({preventScroll:true});},{once:true});
  print.onclick=async()=>{
   if(print.disabled||!canPrint())return;
   print.disabled=true;
   try{await window.pos397SendCashReceipt(report);}
   finally{print.disabled=false;}
  };
  const area=append(dialog,'div');
  area.className='pos399-cash-rows';
  if(report.estimated)append(area,'p','بعض قيود الليرة محسوبة بسعر الصرف الحالي.');
  if(!report.rows.length)append(area,'p','لا توجد حركة نقدية اليوم.');
  else{
   const table=append(area,'table'),head=append(append(table,'thead'),'tr'),body=append(table,'tbody');
   append(head,'th','الحركة');append(head,'th','المبلغ');
   for(const movement of report.rows){
    const row=append(body,'tr');
    append(row,'td',[movement.label,movement.party,movement.ref].filter(Boolean).join(' · '));
    append(row,'td',signedMoney(movement.cents)).dir='ltr';
   }
  }
  document.body.appendChild(dialog);
  dialog.showModal();
 }
 window.pos397PrintDailyCash=function(){
  if(canPrint())showPreview(snapshot(state,new Date()));
 };
