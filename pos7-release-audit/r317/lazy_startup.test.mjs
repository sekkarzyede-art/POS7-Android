import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const h=fs.readFileSync('r305-android/tab2/POS7_Tablet/app/src/main/assets/index.html','utf8');
const between=(id)=>{const a='<script id="'+id+'">';assert.equal(h.split(a).length,2,id+' unique');return h.split(a)[1].split('</script>')[0];};
const originalBoot="refreshSelects();renderProducts();renderCart();renderPurchaseCart();refreshPurchaseBarcode();setPurchaseSource('daily');setExpenseSource('daily');renderExpenses();renderHome();";
const newBoot="refreshSelects();renderProducts();renderCart();renderPurchaseCart();refreshPurchaseBarcode();setPurchaseSource('daily');setExpenseSource('daily');/* R317: hidden expenses and home are rendered by openPage when shown. */";
assert.ok(!h.includes(originalBoot),'no duplicate eager home/expenses');
assert.ok(h.includes(newBoot),'critical sale and purchase initialization retained');
assert.ok(h.includes("if(id==='expenses')renderExpenses()"),'expenses still render on open');
assert.ok(h.includes("if(id==='home')renderHome()"),'home still renders on open');

const wallet=between('pos746-owner-wallet');
assert.ok(!wallet.includes("setTimeout(init,0);window.pos746Render();"),'wallet not rendered during script registration');
assert.ok(!wallet.includes("addEventListener('DOMContentLoaded',init)"),'wallet not rendered unconditionally on DOM ready');
assert.ok(wallet.includes("if(id==='ownerWalletPage')init();"),'wallet initialized on open');
assert.ok(wallet.includes("page&&page.classList.contains('active')"),'restored wallet page initializes after authorization');
assert.ok(wallet.includes('window.pos7OwnerAccess='),'owner accounting APIs preserved');

const footer=wallet.slice(wallet.lastIndexOf('function init(){')).replace(/\}\)\(\);\s*$/,'');
assert.ok(footer.startsWith('function init(){'));
const walletPage={classList:{active:false,contains(k){return this.active&&k==='active'}}};
const rateField={value:0},dateField={value:''},domCallbacks=[];
let walletRenders=0,formRefresh=0,opens=0;
const ctx={
  $:id=>({ownerWalletPage:walletPage,pos746Rate:rateField,pos746Date:dateField}[id]||null),
  today:()=> '2026-11-22',rateAt:()=>90000,
  document:{addEventListener:(name,fn)=>domCallbacks.push({name,fn})},
  window:{
    openPage:(id)=>{opens++;return id;},
    pos746Render:()=>{walletRenders++;},
    pos746FormChanged:()=>{formRefresh++;}
  }
};
vm.runInNewContext(footer,ctx);
assert.equal(walletRenders,0,'initially hidden wallet has no render');
assert.equal(domCallbacks.length,1,'single conditional wallet page-ready handler');
domCallbacks[0].fn();
assert.equal(walletRenders,0,'hidden wallet stays lazy on DOMContentLoaded');
assert.equal(ctx.window.openPage('home'),'home');
assert.equal(walletRenders,0,'home does not initialize wallet');
assert.equal(ctx.window.openPage('ownerWalletPage'),'ownerWalletPage');
assert.equal(walletRenders,1,'owner wallet initializes when opened');
assert.equal(formRefresh,1,'owner wallet form initializes when opened');
assert.equal(rateField.value,90000);
assert.equal(dateField.value,'2026-11-22');
walletPage.classList.active=true;
domCallbacks[0].fn();
assert.equal(walletRenders,2,'restored visible wallet initializes');
assert.equal(opens,2);

const compare=between('pos714-comparisons-engine');
assert.ok(!compare.includes("document.addEventListener('DOMContentLoaded',init)"),'no eager comparison selectors');
assert.ok(compare.includes('window.pos713CompareInit=init;'));
assert.ok(compare.includes('window.pos713CompareRender=function(type){init();'),'comparison report initializes selectors on demand');
const reports=between('pos712-report-engine');
assert.ok(!reports.includes("document.addEventListener('DOMContentLoaded',function(){refreshSelectorsIfNeeded()})"),'no eager reports selectors');
assert.ok(reports.includes("window.pos712Run=function(type){custom={type:type};window._pos712CurrentReport=custom;refreshSelectorsIfNeeded();render()"),'report selectors still initialize on report');
assert.ok(h.includes('POS7_RESTORE_PENDING_R305'),'backup restore guard preserved');
assert.ok(h.includes('window.pos310Installed=true'),'purchase single-commit preserved');
assert.ok(!h.includes('window.pos311SaleActive'),'unsafe sale path remains absent');
assert.ok(h.includes('485.7.229-r320-tab2'));
console.log('R317 PASS: hidden panels lazy, authorized navigation and ledger paths preserved');
