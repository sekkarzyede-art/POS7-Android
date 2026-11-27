const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const html = readFileSync(process.argv[2], 'utf8');
const purchase = html.slice(html.indexOf('<section id="purchase"'), html.indexOf('<div id="purchaseCalculatorModal"'));
const sale = html.slice(html.indexOf('<section id="sales"'), html.indexOf('<section id="purchase"'));
assert.match(html, /<header class="top homeTop">[\s\S]*?<button id="pos151CalcToggle"[^>]*><svg[\s\S]*?<\/header>/);
assert.equal((purchase.match(/class="pos394-round"/g)||[]).length, 5);
for (const action of ['pos369Inquiry()', 'openPurchaseNewProduct()', 'pos417OpenReprint()', "openPage('home')"])
  assert.ok(purchase.includes('onclick="' + action + '"'));
const picker = purchase.match(/<aside class="sale-picker-pane">([\s\S]*?)<\/aside>/)[1];
assert.match(picker, /^\s*<div class="search[^"]*"><input id="pSearch"/);
assert.doesNotMatch(picker, /<label|picker-title|تركيز البحث/);
for (const [page, cart, clear, action] of [[sale,'cart','pos390ClearCart','clearSaleCart'],[purchase,'purchaseCart','pos394ClearPurchase','clearPurchaseCart']])
  assert.match(page, new RegExp('pos394-cart-area"><div id="'+cart+'"[^>]*></div><button id="'+clear+'"[^>]*onclick="'+action+'\\(\\)"'));
assert.match(html, /position:absolute;left:4px;right:auto;bottom:4px/);
const code = html.match(/<script id="pos156-drag-keyboard">([\s\S]*?)<\/script>/)[1];
const attr = new Map();
const keyboard = {addEventListener(){},setAttribute(k,v){attr.set(k,v)}};
const input = {getAttribute:k=>attr.get(k),setAttribute(k,v){attr.set(k,v)},focus(){}};
vm.runInNewContext(code,{document:{getElementById:id=>({pSearch:input,pos394PurchaseKeyboard:keyboard})[id]}});
const tap = {preventDefault(){},stopPropagation(){}};
keyboard.onclick(tap);
assert.equal(attr.get('inputmode'), 'none');
assert.equal(attr.get('aria-pressed'), 'true');
keyboard.onclick(tap);
assert.equal(attr.get('inputmode'), 'text');
assert.equal(attr.get('aria-pressed'), 'false');
console.log('R394 markup, retained actions and purchase keyboard checked');
