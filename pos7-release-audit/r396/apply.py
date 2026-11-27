from hashlib import sha256
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
raw = path.read_bytes()
assert sha256(raw).hexdigest() == 'ef9f3f8ed7193dbdb0ecc2f04192b7614ad4714fce9966f6755f9b78c53c9975'
html = raw.decode()

def edit(old, new):
    global html
    assert html.count(old) == 1, old[:200]
    html = html.replace(old, new, 1)

edit('''    <div class="row2" style="margin-top:7px">
      <button class="primary" onclick="pos286PrintCashReport()">🖨️ طباعة</button>
      <button class="soft" onclick="pos286ShareCashReport()">🟢 إرسال / واتساب</button>
    </div>
''', '')
edit('function actionFooter(){return \'<div class="pos713-report-actions"><button class="soft" onclick="pos712Print()">🖨️ طباعة التقرير</button><button class="soft" onclick="pos713WhatsApp()">🟢 مشاركة عبر واتساب</button></div>\'}', '')
edit('buttonBar()+invoiceSelectorReport()+actionFooter()', 'buttonBar()+invoiceSelectorReport();window.pos396ResetProductPrint?.()')
edit("window.setReportMode=setReportMode=function(mode){if(mode==='expenses')", "window.setReportMode=setReportMode=function(mode){window.pos396ResetProductPrint?.();if(mode==='expenses')")
edit('<button class="pos742-share" type="button" onclick="pos742ShareProductMovement()">إرسال / واتساب</button>', '')
edit('<button class="primary" onclick="printCashStatement()">🖨️ طباعة التقرير</button>', '')
edit('<button class="soft" onclick="pos383PrintAccuracy()">طباعة التقرير</button>', '')

def replace_line(prefix, replacement):
    old = next(line for line in html.splitlines() if line.startswith(prefix))
    edit(old, replacement)

replace_line(' window.pos712Print=function(){', ''' window.pos712Print=function(){
  var box=document.getElementById('reportsHub');
  if(custom&&!pos391AllowsReport(custom.type))return pos391Blocked();
  if(box?.innerHTML.trim())return window.pos396PreviewReport(box,custom?titleFor(custom.type):'التقارير');
  toast('اعرض التقرير أولاً');
 };''')
replace_line(' window.pos713WhatsApp=function(){', '')
replace_line(' var originalPrint=window.pos712Print;', ''' var originalPrint=window.pos712Print;
 window.pos396ResetProductPrint=function(){current=null;};
 window.pos712Print=function(){
  var box=document.getElementById('pos742ProductMovementResult');
  if(current&&box?.innerHTML.trim())return window.pos396PreviewReport(box,current.title+' — '+current.product);
  return originalPrint.apply(this,arguments);
 };''')
replace_line(' window.pos742ShareProductMovement=function(){', '')
start = html.index('  var w=window.open', html.index('window.pos286PrintCashReport=function(){'))
end = html.index('\n};',start)
edit(html[start:end], '''  fillCashHistory();
  return window.pos396PreviewReport(p,'حركة الصندوق');
'''.rstrip())
replace_line(' function printReport(){var page=activePage();', ''' function printReport(){
  var page=activePage();if(!page)return;
  if(page.id==='cashMovement286')return window.pos286PrintCashReport();
  if(page.id==='queries')return window.pos712Print();
  if(page.id==='cashStatementPage'&&pos391Private)return pos391Blocked();
  var root=genericReportRoot(page);
  if(!root){toast('اعرض التقرير أولاً ثم اطبعه أو احفظه PDF');return;}
  var title=(root.querySelector('h2,h3,h4')||page.querySelector('h2,h3'))?.textContent||'تقرير متجر سكر زيادة';
  return window.pos396PreviewReport(root,title);
 }''')

preview = '''
<style id="pos396-report-preview-style">
#queries button[onclick*="Print"],#queries button[onclick*="WhatsApp"],#queries button[onclick*="Share"],#queries .pos713-report-actions,#queries .pos486-report-back{display:none!important}
#pos396ReportPreview{width:min(1060px,96vw);height:min(94vh,950px);max-width:96vw;max-height:94vh;padding:0;border:1px solid #bbd5c5;border-radius:14px;background:#fff;overflow:hidden;color:#182c23}
#pos396ReportPreview::backdrop{background:#10271bb3}
#pos396ReportPreview[open]{display:flex;flex-direction:column}
#pos396ReportPreview .pos396-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #d6e3db}
#pos396ReportTitle{flex:1;min-width:110px}
#pos396ReportPreview button{min-height:44px;padding:6px 12px;border-radius:9px;white-space:nowrap}
#pos396ReportPreview iframe{display:block;flex:1;min-height:0;width:100%;border:0}
</style>
<script id="pos396-report-preview">
(function(){
 'use strict';
 var dialog,frame,titleNode,printButton,reportDocument='',origin=null;
 function mount(){
  dialog=document.createElement('dialog');dialog.id='pos396ReportPreview';dialog.dir='rtl';
  dialog.setAttribute('aria-labelledby','pos396ReportTitle');
  dialog.innerHTML='<div class="pos396-toolbar"><strong id="pos396ReportTitle">معاينة التقرير</strong><button type="button" class="primary" id="pos396Print">🖨️ طباعة / حفظ PDF</button><button type="button" class="soft" id="pos396Close" autofocus>إغلاق ×</button></div><iframe title="معاينة التقرير" sandbox="allow-same-origin allow-modals"></iframe>';
  frame=dialog.querySelector('iframe');
  titleNode=dialog.querySelector('#pos396ReportTitle');printButton=dialog.querySelector('#pos396Print');
  dialog.querySelector('#pos396Close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
   frame.removeAttribute('srcdoc');reportDocument='';
   if(origin?.isConnected)origin.focus({preventScroll:true});
   origin=null;
  });
  frame.addEventListener('load',()=>{if(dialog.open&&frame.contentDocument?.querySelector('[data-pos396-paper]'))printButton.disabled=false;});
  printButton.onclick=()=>{
   if(!reportDocument)return;
   if(typeof window.Pos7Android?.printReportHtml==='function'){
    window.Pos7Android.printReportHtml(reportDocument,titleNode.textContent);
   }else frame.contentWindow.print();
  };
  document.body.appendChild(dialog);
 }
 window.pos396PreviewReport=function(root,title){
  if(!root?.innerHTML.trim()){toast('اعرض التقرير أولاً');return;}
  var clone=root.cloneNode(true);
  clone.querySelectorAll('button,.actions,.pos713-report-actions,.pos486-report-back,script,style,iframe').forEach(x=>x.remove());
  var heading=document.createElement('h2');heading.textContent=title||'التقرير';
  var content=clone.tagName==='TABLE'?clone.outerHTML:clone.innerHTML;
  reportDocument='<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:14px Arial,Tahoma,sans-serif;color:#182c23;padding:12px}h2,h3{text-align:center;color:#155b3c}table{width:100%;border-collapse:collapse;font-size:11px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #aebbb3;padding:6px;text-align:center;overflow-wrap:anywhere}th{background:#eaf4ee}.panel{margin:8px 0;padding:8px}.statement-wrap,.cash-stmt-wrap{overflow:visible!important}.cash-stmt-summary,.pos712-report-summary,.pos713-totals,.pos742-kpis{display:flex;flex-wrap:wrap;gap:8px}.cash-stmt-summary>div,.pos712-report-summary>div,.pos713-totals>div,.pos742-kpis>div{padding:5px;border:1px solid #ddd}.cash-stmt-summary b,.pos712-report-summary b,.pos713-totals b,.pos742-kpis b{display:block}</style></head><body data-pos396-paper>'+heading.outerHTML+content+'</body></html>';
  if(!dialog)mount();
  printButton.disabled=true;titleNode.textContent=title||'التقرير';frame.srcdoc=reportDocument;
  if(!dialog.open){origin=document.activeElement;dialog.showModal();}
 };
})();
</script>
'''
edit('<style id="pos741-report-dock-style">',preview+'\n<style id="pos741-report-dock-style">')
edit("const VERSION='R395', MAX=250;", "const VERSION='R396', MAX=250;")
edit('تشخيص الأداء المتقدم — R395','تشخيص الأداء المتقدم — R396')
html = html.replace('485.7.229-r395-tab1','485.7.229-r396-tab1')
path.write_bytes(html.encode())
if len(sys.argv)>2:
    app=path.parents[3]
    gradle=app/'build.gradle'
    old=gradle.read_text()
    assert old.count('485.7.229-r395-tab1')==1
    gradle.write_text(old.replace('485.7.229-r395-tab1','485.7.229-r396-tab1'))
    java=app/'src/main/java/com/sokkarzeyedeh/pos7/MainActivity.java'
    source=java.read_text()
    signature='    private void openSystemPrint(String html, String jobName) {'
    assert source.count(signature)==1
    source=source.replace(signature,signature+'''
        openSystemPrint(html, jobName, false);
    }

    private void openSystemPrint(String html, String jobName, boolean report) {''')
    marker='        @JavascriptInterface public void chooseBluetoothPrinter() {'
    assert source.count(marker)==1
    source=source.replace(marker,'''        @JavascriptInterface public void printReportHtml(String html, String jobName) {
            if (html == null || html.trim().isEmpty()) return;
            runOnUiThread(() -> openSystemPrint(html, jobName, true));
        }

'''+marker)
    thermal='new PrintAttributes.MediaSize("POS7_80MM", "80 mm thermal", 3150, 11000)'
    assert source.count(thermal)==1
    java.write_text(source.replace(thermal,'report ? PrintAttributes.MediaSize.ISO_A4 : '+thermal))
