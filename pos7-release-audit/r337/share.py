from pathlib import Path
import sys

def edit(html):
    start=html.index('async function shareCurrentSaleWhatsApp(){')
    end=html.index('function printCurrentSaleInvoice()',start)
    html=html[:start]+"function shareCurrentSaleWhatsApp(){return window.shareSaleReceiptImage();}\n"+html[end:]
    start=html.index(' window.shareCurrentSaleWhatsAppLBP=async function(){')
    end=html.index(' function buttons()',start)
    html=html[:start]+" window.shareCurrentSaleWhatsAppLBP=function(){return window.shareSaleReceiptImage('LBP')};\n"+html[end:]
    pos=html.index('function printSaleFromReport(')
    html=html[:pos]+"""let sharingSaleImage=false;
window.shareSaleReceiptImage=async function(currency){
 if(sharingSaleImage)return;
 const inv=state.sales.find(item=>item.id===currentSaleReportId);
 if(!inv)return toast('الفاتورة غير موجودة');
 const tile=document.getElementById('saleDeliveryTile');
 const copy=Object.assign({},inv,{includePrintDelivery:tile.getAttribute('aria-pressed')==='true'});
 const cur=currency||inv.receiptCurrency||inv.currency||read().currency||'USD';
 const filename='Invoice-'+String(inv.number||'sale').replace(/[^a-z0-9_-]/gi,'_')+'-'+cur+'.png';
 sharingSaleImage=true;
 try{
  const canvas=await canvasReceipt('sale',copy,cur,true);
  const bridge=window.Pos7Android;
  if(bridge && typeof bridge.shareSalePng==='function'){
   if(!bridge.shareSalePng(canvas.toDataURL('image/png').split(',')[1],filename))throw Error('PNG');
  }else{
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw Error('PNG');
   const file=new File([blob],filename,{type:'image/png'});
   if(navigator.canShare && navigator.canShare({files:[file]})){
    await navigator.share({files:[file]});
   }else{
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),60000);
    toast('تم تجهيز صورة PNG للتنزيل والمشاركة');
   }
  }
 }catch(error){if(error.name!=='AbortError')toast('تعذر تجهيز صورة الفاتورة للمشاركة')}
 finally{sharingSaleImage=false}
};
"""+html[pos:]
    start=html.index('function canvasReceipt(');end=html.index('function escPosBytes',start)
    sub=html[start:end].replace('currencyOverride){','currencyOverride,forImage){',1)
    sub=sub.replace("c.width=W;c.height=H;var x=c.getContext('2d');","var scale=forImage&&H<=6000?2:1;c.width=W*scale;c.height=H*scale;var x=c.getContext('2d');if(scale!==1)x.scale(scale,scale);")
    sub=sub.replace('cropped.width=W;cropped.height=Math.ceil(Math.max(200,y+line));','cropped.width=W*scale;cropped.height=Math.ceil(Math.max(200,y+line)*scale);')
    assert 'if(scale!==1)' in sub and 'cropped.width=W*scale' in sub
    return html[:start]+sub+html[end:]

bridge="""
        @JavascriptInterface public boolean shareSalePng(String encoded, String name) {
            if (!pos322TrustedPage || encoded == null || encoded.length() > 32*1024*1024 ||
                name == null || !name.matches("Invoice-[a-zA-Z0-9_-]+[.]png")) return false;
            java.io.File image = null;
            try {
                byte[] data = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
                if (data.length < 24 || data[0] != (byte)137 || data[1] != 80 || data[2] != 78 || data[3] != 71) return false;
                java.io.File dir = new java.io.File(context.getCacheDir(), "sale-receipts");
                if (!dir.isDirectory() && !dir.mkdirs()) return false;
                java.io.File[] old = dir.listFiles();
                if (old != null) for (java.io.File f : old)
                    if (f.lastModified() < System.currentTimeMillis()-86400000L) f.delete();
                image = java.io.File.createTempFile("invoice-", ".png", dir);
                try (java.io.FileOutputStream out = new java.io.FileOutputStream(image)) { out.write(data); }
                android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(
                    context,context.getPackageName()+".saleimages",image);
                android.content.Intent send = new android.content.Intent(android.content.Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(android.content.Intent.EXTRA_STREAM,uri);
                send.setClipData(android.content.ClipData.newRawUri(name,uri));
                send.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                MainActivity.this.runOnUiThread(() -> {
                    for (String pkg : new String[]{"com.whatsapp","com.whatsapp.w4b"}) {
                        try { MainActivity.this.startActivity(new android.content.Intent(send).setPackage(pkg)); return; }
                        catch (android.content.ActivityNotFoundException ignored) { }
                    }
                    try { MainActivity.this.startActivity(android.content.Intent.createChooser(send,"مشاركة صورة الفاتورة")); }
                    catch (RuntimeException e) { android.widget.Toast.makeText(context,"تعذر فتح تطبيق المشاركة",android.widget.Toast.LENGTH_LONG).show(); }
                });
                return true;
            } catch (Exception e) { if (image != null) image.delete(); return false; }
        }
"""
if __name__=='__main__':
    app=Path(sys.argv[1]);html=app/'assets/index.html'
    html.write_text(edit(html.read_text()))
    java=app/'java/com/sokkarzeyedeh/pos7/MainActivity.java'
    j=java.read_text();anchor='        AndroidPrintBridge(Context context) { this.context = context; }'
    assert j.count(anchor)==1
    java.write_text(j.replace(anchor,anchor+'\n'+bridge))
    m=app/'AndroidManifest.xml'
    s=m.read_text()
    provider='<provider android:name=".SaleReceiptProvider" android:authorities="${applicationId}.saleimages" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/sale_image_paths"/></provider>'
    m.write_text(s.replace('</application>',provider+'\n</application>'))
    java.with_name('SaleReceiptProvider.java').write_text('package com.sokkarzeyedeh.pos7;\npublic class SaleReceiptProvider extends androidx.core.content.FileProvider {}\n')
    paths=app/'res/xml/sale_image_paths.xml';paths.parent.mkdir(exist_ok=True)
    paths.write_text('<paths><cache-path name="receipts" path="sale-receipts/"/></paths>\n')
