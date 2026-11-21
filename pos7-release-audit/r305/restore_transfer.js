/* Loaded after the original application. Uses its authenticated owner session and snapshot builder. */
(() => {
  'use strict';
  const markerKey = 'POS7_RESTORE_PENDING_R305';
  const requestKey = 'POS7_TRANSFER_REQUEST_R305';
  let transferring = false;
  const cloud = window.P7Cloud;
  if (!cloud) throw Error('owner_cloud_client_missing');
  const rpc = cloud.rpc.bind(cloud);
  cloud.rpc = function (name, args) {
    if (localStorage.getItem(markerKey) && name !== 'pos7_restore_transfer_r305') {
      return Promise.reject(Error('اعتمد النسخة المستعادة على هذا التاب أولًا'));
    }
    return rpc(name, args);
  };

  async function transfer() {
    if (transferring) return;
    if (!localStorage.getItem(markerKey)) throw Error('استعد النسخة الاحتياطية أولًا');
    if (!cloud.session) throw Error('سجّل دخول المالك أولًا');
    if (window.P7TabletTest.cashierBusy() || window.P7TabletTest.isBusy()) {
      throw Error('أكمل العملية الجارية ثم أعد المحاولة');
    }
    if (!confirm('سيعتمد هذا المتجر بيانات النسخة المستعادة، وينقل النشر والجرد إلى هذا التاب. ستُحفظ السحابة السابقة وحركاتها في أرشيف، وتُغلق طلبات الهاتف المعلقة السابقة حتى لا تُضاف فوق النسخة المستعادة. هل تعتمد النقل؟')) return;
    transferring = true;
    try {
      let request = JSON.parse(localStorage.getItem(requestKey) || 'null');
      if (!request) {
        const snapshot = await window.pos7BuildOwnerSnapshot(() => !window.P7TabletTest.cashierBusy());
        const rows = await cloud.req('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=revision');
        if (rows.length !== 1) throw Error('تعذر قراءة رقم مراجعة المتجر');
        request = {
          p_request_id: crypto.randomUUID(),
          p_device: localStorage.getItem('POS7_CLOUD_DEVICE_V1'),
          p_expected: Number(rows[0].revision),
          p_sections: snapshot.sections
        };
        localStorage.setItem(requestKey, JSON.stringify(request));
      }
      const result = await rpc('pos7_restore_transfer_r305', request);
      const rows = await cloud.req('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=publisher_device');
      if (!result.ok || rows[0]?.publisher_device !== request.p_device) {
        throw Error('لم يؤكد الخادم اعتماد هذا التاب');
      }
      localStorage.setItem('POS7_TRANSFER_COMPLETED_R305', request.p_device);
      localStorage.removeItem(markerKey);
      localStorage.removeItem(requestKey);
      localStorage.setItem('POS7_R174_SMART_CAS_SERVER_VERIFIED', 'yes');
      alert('تم اعتماد النسخة ونقل صلاحية المزامنة والجرد إلى هذا التاب');
      location.reload();
    } finally {
      transferring = false;
    }
  }

  function install() {
    const anchor = document.getElementById('p57Now');
    if (!anchor || document.getElementById('pos7TransferR305')) return;
    const button = document.createElement('button');
    button.id = 'pos7TransferR305';
    button.textContent = 'اعتماد النسخة المستعادة ونقل صلاحيات التاب';
    button.onclick = () => transfer().catch(error => alert(error.message));
    anchor.after(button);
  }
  new MutationObserver(install).observe(document.documentElement, {childList:true, subtree:true});
  install();
})();
