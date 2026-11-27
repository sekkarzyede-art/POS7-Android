const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
process.env.TZ = 'Asia/Beirut';
const html = readFileSync(process.argv[2], 'utf8');
function script(id) {
  const body = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'));
  assert.ok(body, id);
  return body[1];
}

const reportBox = {};
const reportRange = {from: new Date('2026-11-26T00:00:00'), to: new Date('2026-11-27T23:59:59.999')};
const data = {
  products: [],
  sales: [
    {date: '2026-11-25T22:00:00Z', totalUSD: 10.01},
    {date: '2026-11-26T12:01:00+02:00', total: 900000, currency: 'LBP', fxRate: 90000},
    {date: '2026-11-27T23:59:59.999+02:00', totalUSD: 5.49, total: 494100, currency: 'LBP'},
    {date: '2026-11-27T23:59:59.999+02:00', total: 200, status: 'canceled'},
    {date: '2026-11-27T21:59:59Z', totalUSD: 200, voided: true},
    {date: '2026-11-25T21:59:59.999Z', totalUSD: 300},
    {date: '2026-11-27T22:00:00Z', totalUSD: 400},
  ],
  salesReturns: [{date: '2026-11-27T12:00:00+02:00', total: 777}],
  purchases: [{date: '2026-11-27T12:00:00+02:00', total: 82.80}],
};
const box = {
  state: data,
  pos391AllowsReport: () => true,
  pos100ReportRange: () => reportRange,
  document: {getElementById: id => id === 'reportsHub' ? reportBox : null, addEventListener() {}},
};
box.window = box;
runInNewContext(script('pos712-report-engine'), box);
box.pos712Run('sale-daily');
assert.match(reportBox.innerHTML, /إجمالي الفترة<\/span><b>\$25\.50/);
assert.match(reportBox.innerHTML, /2026-11-26<\/td><td>2<\/td><td>\$20\.01/);
assert.match(reportBox.innerHTML, /2026-11-27<\/td><td>1<\/td><td>\$5\.49/);
assert.match(reportBox.innerHTML, /pos712Print/);
box.pos712Run('purchase-daily');
assert.match(reportBox.innerHTML, /مجموع المشتريات اليومية/);
assert.match(reportBox.innerHTML, /إجمالي الفترة<\/span><b>\$82\.80/);
reportRange.from = new Date('2026-11-28T00:00:00');
reportRange.to = new Date('2026-11-28T23:59:59.999');
box.renderReportsHub();
assert.match(reportBox.innerHTML, /لا توجد بيانات في الفترة المحددة/);
assert.match(reportBox.innerHTML, /\$0\.00/);
assert.match(html, /pos391SafeReports=new Set\(\['sale-daily','purchase-daily'/);

const storageScript = script('pos7-r322-native-state-storage');
class Storage {
  getItem() { return null; }
  setItem() { throw new Error('Unexpected legacy write'); }
  removeItem() {}
}
const localStorage = new Storage();
const initial = '{"products":[],"sales":[],"purchases":[]}';
const changed = '{"products":[],"sales":[{"id":1}],"purchases":[]}';
let writes = 0;
let fail = true;
const native = {
  pos322ReadState: () => initial,
  pos322WriteState: () => { writes++; return !fail; },
};
const nativeBox = { Storage, localStorage, Pos7Android: native,
  document: {readyState:'loading', addEventListener() {}}
};
nativeBox.window = nativeBox;
runInNewContext(storageScript, nativeBox);
assert.equal(nativeBox.POS7_R322_NATIVE_STORE.status().active, true);
const main = 'POS7_TRIAL188_CLEAN';
localStorage.setItem(main, initial);
assert.equal(writes, 0);
assert.throws(() => localStorage.setItem(main, changed));
assert.equal(localStorage.getItem(main), initial);
fail = false;
localStorage.setItem(main, changed);
localStorage.setItem(main, changed);
assert.equal(localStorage.getItem(main), changed);
assert.equal(writes, 2);
console.log('Daily reports, period boundaries, USD totals, and atomic write deduplication passed.');
