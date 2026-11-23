/* R331: move storage maintenance controls from fixed sale overlays to
 * the existing saleSettingsPage. Same buttons and click handlers; NO data writes.
 */
(function(){
'use strict';
function attach(){
 const settings=document.getElementById('saleSettingsPage');
 if(!settings)return false;
 let panel=document.getElementById('pos7R331StorageSettings');
 if(!panel){
  panel=document.createElement('section');
  panel.className='panel';
  panel.id='pos7R331StorageSettings';
  panel.dir='rtl';
  panel.style.cssText='margin:14px 0;padding:14px;border:1px solid #cbd5e1;border-radius:12px';
  const title=document.createElement('h3');
  title.textContent='💾 صيانة التخزين — أدوات متقدمة';
  const help=document.createElement('p');
  help.textContent='للصيانة فقط. لا تحذف بيانات التطبيق؛ احتفظ بنسخة احتياطية خارجية قبل تحرير النسخ.';
  help.style.cssText='font:13px Arial;color:#475569;margin:8px 0';
  const actions=document.createElement('div');
  actions.id='pos7R331StorageActions';
  actions.style.cssText='display:flex;flex-wrap:wrap;gap:10px';
  panel.appendChild(title);panel.appendChild(help);panel.appendChild(actions);
  settings.appendChild(panel);
 }
 const actions=document.getElementById('pos7R331StorageActions');
 for(const id of ['pos7R321Toggle','pos7R322Info']){
  const button=document.getElementById(id);
  if(button&&button.parentElement!==actions){
    actions.appendChild(button);
    // Remove the fixed-position UI while keeping ORIGINAL onclick unchanged.
    button.style.cssText='position:static;bottom:auto;left:auto;right:auto;z-index:auto;box-shadow:none;display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;margin:0;max-width:100%;white-space:normal;border:1px solid #94a3b8;border-radius:9px;background:#f1f5f9;color:#0f172a;font:bold 14px Arial;';
  }
 }
 return !!document.getElementById('pos7R321Toggle');
}
function mount(){
 attach();
 // For slow devices, R321/R322 may mount after DOMContentLoaded.
 if(window.MutationObserver){
  const observer=new MutationObserver(function(){attach()});
  const settings=document.getElementById('saleSettingsPage');
  if(settings)observer.observe(settings,{childList:true,subtree:true});
  // The two original controls can be initially appended under body by their
  // deferred mount handlers. Observe additions only, and never modify data.
  observer.observe(document.body,{childList:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
else mount();
window.POS7_R331_STORAGE_SETTINGS={attach:attach};
})();