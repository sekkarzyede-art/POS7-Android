#!/usr/bin/env python3
"""R339 scoped presentation-only patch: red customer name on sale WhatsApp PNG."""
from pathlib import Path
import sys

source = Path(sys.argv[1])
text = source.read_text(encoding='utf-8')
old = "rule();draw((isSale?'العميل: ':'المورد: ')+(isSale?inv.customer||'زبون نقدي':inv.supplier||'—'),true,'right');"
new = """rule();if(isSale&&forImage){
  var customerPrefix='السيد المحترم: ',customerName=String(inv.customer||'زبون نقدي');
  x.font='bold '+fs+'px Arial,Tahoma,sans-serif';x.textAlign='right';x.direction='rtl';
  x.fillStyle='#000';x.fillText(customerPrefix,right,y);
  var prefixWidth=x.measureText(customerPrefix).width;
  x.fillStyle='#c62828';x.fillText(customerName,right-prefixWidth-8,y,Math.max(24,usable-prefixWidth-8));
  x.fillStyle='#000';next();
 }else{draw((isSale?'العميل: ':'المورد: ')+(isSale?inv.customer||'زبون نقدي':inv.supplier||'—'),true,'right')}"""
assert text.count(old)==1, 'R339 receipt anchor must appear exactly once; abort'
assert 'window.shareSaleReceiptImage=async function' in text
assert "canvasReceipt('sale',copy,cur,true)" in text
assert 'المجموع النهائي' in text and 'عليكم مبلغ' not in text
text = text.replace(old,new,1)
assert text.count("x.fillStyle='#c62828';x.fillText(customerName") == 1
source.write_text(text,encoding='utf-8')
print('R339: customer name drawn in red after السيد المحترم only in sale WhatsApp image')
