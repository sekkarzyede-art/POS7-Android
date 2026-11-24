from pathlib import Path
import sys
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

app=Path(sys.argv[1])
java=app/'java/com/sokkarzeyedeh/pos7/MainActivity.java'
j=java.read_text(encoding='utf8')
anchor='        AndroidPrintBridge(Context context) { this.context = context; }'
assert j.count(anchor)==1 and 'pos322TrustedPage' in j and 'shareSalePng(' not in j
m=app/'AndroidManifest.xml'
s=m.read_text(encoding='utf8')
provider='<provider android:name=".SaleReceiptProvider" android:authorities="${applicationId}.saleimages" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/sale_image_paths"/></provider>'
assert s.count('</application>')==1 and 'SaleReceiptProvider' not in s
target=java.with_name('SaleReceiptProvider.java')
paths=app/'res/xml/sale_image_paths.xml'
assert not target.exists() and not paths.exists()
java.write_text(j.replace(anchor,anchor+'\n'+bridge,1),encoding='utf8')
m.write_text(s.replace('</application>',provider+'\n</application>',1),encoding='utf8')
target.write_text('package com.sokkarzeyedeh.pos7;\npublic class SaleReceiptProvider extends androidx.core.content.FileProvider {}\n',encoding='utf8')
paths.parent.mkdir(parents=True,exist_ok=True)
paths.write_text('<paths><cache-path name="receipts" path="sale-receipts/"/></paths>\n',encoding='utf8')
print('Tab2 native PNG sharing added with private cache-only FileProvider')
