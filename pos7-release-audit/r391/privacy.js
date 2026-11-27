let pos391Private=false;
try{pos391Private=localStorage.getItem('POS7_TAB1_PRIVACY_R391')==='on';}catch(_){}
const pos391BlockedPages=new Set(['chartAccounts','cashbox','cashMovement286','cashStatementPage','pos7CashInventoryReports','backupPage','ownerWalletPage','pos408Settings','usersPermissions','customerViability']);
const pos391SafeReports=new Set(['store-invoices','store-items','store-customer','store-category','sale-all','sale-cash','sale-credit','sale-customer','sale-returns','purchase-all','purchase-cash','purchase-credit','purchase-supplier','purchase-returns','expenses','cmp-expiry','cmp-customer-debt-age','cmp-purchase-prices']);
function pos391AllowsReport(type){return !pos391Private||pos391SafeReports.has(type);}
function pos391Blocked(){toast('هذا القسم معطّل في وضع الخصوصية');return false;}
function pos391ApplyPrivacy(){
 document.documentElement.classList.toggle('pos391-private',pos391Private);
 const button=document.getElementById('pos391PrivacyToggle');
 if(button){
  button.textContent=pos391Private?'ON':'OFF';
  button.setAttribute('aria-pressed',String(pos391Private));
 }
}
function pos391TogglePrivacy(){
 if(!pos391Private){
  const pin=prompt('أدخل كلمة السر لتشغيل وضع الخصوصية');
  if(pin===null)return;
  if(pin!=='1212'){toast('كلمة السر غير صحيحة');return;}
 }
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
}
function pos391MarkCards(){
 for(const card of document.querySelectorAll('#home .home-tile')){
  const label=card.querySelector(':scope > :nth-child(2)')?.textContent?.trim();
  if(label&&!card.hasAttribute('aria-label'))card.setAttribute('aria-label',label);
  if(card.hasAttribute('data-pos391-disabled'))card.setAttribute('aria-disabled',String(pos391Private));
 }
}
document.addEventListener('DOMContentLoaded',pos391MarkCards,{once:true});
function pos391GuardCard(event){
 if(!pos391Private||!event.target?.closest?.('#home [data-pos391-disabled]'))return;
 event.preventDefault();
 event.stopImmediatePropagation();
 pos391Blocked();
}
document.addEventListener('click',pos391GuardCard,true);
document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')pos391GuardCard(event);},true);
pos391ApplyPrivacy();
