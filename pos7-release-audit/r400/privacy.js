function pos391TogglePrivacy(){
 if(document.getElementById('pos400PrivacyDialog'))return;
 const dialog=document.createElement('dialog');
 dialog.id='pos400PrivacyDialog';
 dialog.setAttribute('aria-labelledby','pos400PrivacyTitle');
 dialog.innerHTML='<form><h2 id="pos400PrivacyTitle"></h2><label for="pos400PrivacyPin">كلمة السر</label><input id="pos400PrivacyPin" type="password" inputmode="numeric" autocomplete="off" required><p role="status"></p><div><button type="submit" class="primary">تأكيد</button><button type="button" class="soft">إلغاء</button></div></form>';
 const opener=document.getElementById('pos391PrivacyToggle');
 dialog.querySelector('h2').textContent=pos391Private?'إطفاء وضع الخصوصية':'تشغيل وضع الخصوصية';
 const input=dialog.querySelector('input');
 dialog.querySelector('[type=button]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();opener?.focus({preventScroll:true});},{once:true});
 dialog.querySelector('form').onsubmit=event=>{
  event.preventDefault();
  if(input.value!=='1212'){
   dialog.querySelector('[role=status]').textContent='كلمة السر غير صحيحة';
   input.select();
   return;
  }
  input.value='';
  dialog.close();
  pos391Private=!pos391Private;
  try{localStorage.setItem('POS7_TAB1_PRIVACY_R391',pos391Private?'on':'off');}catch(_){}
  pos391ApplyPrivacy();
  pos391MarkCards();
  for(const id of ['reportsHub','queryList','accountantReport','pos170Profit']){
   const node=document.getElementById(id);
   if(node)node.replaceChildren();
  }
  window.pos713ClearReportCache?.();
  toast(pos391Private?'وضع الخصوصية ON':'وضع الخصوصية OFF');
 };
 document.body.appendChild(dialog);
 dialog.showModal();
}
