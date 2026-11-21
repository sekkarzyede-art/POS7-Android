from pathlib import Path
from zipfile import ZipFile
import re
root=Path('r305-android')
for branch,archive in [('tab1','POS7_Tablet_v485.7.229_R213_Project.zip'),('tab2','POS7_المتجر_الثاني_TAB_R215_Android_Source.zip')]:
    destination=root/branch
    with ZipFile(archive) as z:
        for member in z.infolist():
            if not (destination/member.filename).resolve().is_relative_to(destination.resolve()):
                raise ValueError('Invalid ZIP path')
        z.extractall(destination)
    app=destination/'POS7_Tablet'
    assets=app/'app/src/main/assets'
    target=assets/'index.html'
    html=target.read_text()
    old="state=b.data;persist();toast('تمت استعادة النسخة بنجاح')"
    new="""if(window.P7TabletTest?.isBusy())return toast('انتظر اكتمال المزامنة ثم أعد الاستعادة');
localStorage.setItem('POS7_RESTORE_PENDING_R305','yes');
localStorage.removeItem('POS7_TRANSFER_REQUEST_R305');
state=b.data;persist();toast('تمت استعادة النسخة؛ اعتمد نقل الصلاحيات من صفحة المزامنة')"""
    assert html.count(old)==1
    html=html.replace(old,new)
    old='async function sync(auto=false,afterCommit=false){'
    assert html.count(old)==1
    html=html.replace(old,old+"""
 if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;
""")
    old='window.P7TabletTest={apply,delta,cashierBusy}'
    assert html.count(old)==1
    html=html.replace(old,'window.P7TabletTest={apply,delta,cashierBusy,isBusy:()=>busy}')
    if branch=='tab2':
        old='async function pos7Store2ActivateFirstTablet(){'
        assert html.count(old)==1
        html=html.replace(old,old+"""
 if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return;
 if(localStorage.getItem('POS7_TRANSFER_COMPLETED_R305')===device){
  const transferred=await C.req('/rest/v1/pos7_owner_snapshot?store_id=eq.pos7&select=publisher_device,revision');
  if(transferred[0]?.publisher_device===device)return Number(transferred[0].revision);
 }
""")
    html+='\n<script src="restore_transfer.js"></script>\n'
    target.write_text(html)
    (assets/'restore_transfer.js').write_text(Path('pos7-release-audit/r305/restore_transfer.js').read_text())
    gradle=app/'app/build.gradle'
    gradle.write_text(re.sub(r"versionName\s+['\"][^'\"]+['\"]",f"versionName '485.7.229-r305-{branch}'",gradle.read_text(),count=1))
print('Prepared both operational Android sources with restored-backup transfer entrypoint')
