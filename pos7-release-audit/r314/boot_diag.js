(function(){
'use strict';
if(window.POS7_BOOT_DIAG_R314)return;
var t0=performance.now(), D={
 version:'R314 tablet2 boot diagnostics',startRelativeMs:Math.round(t0),
 startEpoch:new Date().toISOString(),longTasks:[],metrics:{},
 storage:{reads:0,writes:0,readMs:0,writeMs:0,readMaxMs:0,writeMaxMs:0},
 compression:{inflates:0,deflates:0,inflateMs:0,deflateMs:0},
 functions:{},events:[],startup:{},state:{},cloud:{}
};
window.POS7_BOOT_DIAG_R314=D;
function round(x){return Math.round((Number(x)||0)*10)/10}
D.mark=function(n){D.events.push({name:n,atMs:round(performance.now()-t0)});D.startup[n+'Ms']=round(performance.now()-t0)};
D.report=function(){
 var p=performance.getEntriesByType('navigation')[0]||{};
 var finish=window.POS7_SPLASH_TIMING||{};
 var v=performance.now();
 var f={};
 Object.keys(D.functions).forEach(function(k){var x=D.functions[k];f[k]={count:x.count,totalMs:round(x.totalMs),maxMs:round(x.maxMs)}});
 var long=D.longTasks.slice().sort(function(a,b){return b.durationMs-a.durationMs});
 return {
 version:D.version,created:new Date().toISOString(),browser:navigator.userAgent,
 source:'Actual tablet APK WebView, local measurements, not HTML simulation',
 fromNavigationToReportMs:round(v),
 domContentLoadedMs:round((p.domContentLoadedEventEnd||0)),
 windowLoadMs:round((p.loadEventEnd||0)),
 splashReadyMs:finish.uiReadyAt!=null?round(finish.uiReadyAt):null,
 splashHiddenMs:finish.hiddenAt!=null?round(finish.hiddenAt):null,
 splashMinimumMs:finish.minimumMs||5000,
 startup:D.startup,state:D.state,
 storage:{reads:D.storage.reads,writes:D.storage.writes,readMs:round(D.storage.readMs),
 writeMs:round(D.storage.writeMs),maxReadMs:round(D.storage.readMaxMs),maxWriteMs:round(D.storage.writeMaxMs)},
 compression:{inflateCalls:D.compression.inflates,deflateCalls:D.compression.deflates,
 inflateMs:round(D.compression.inflateMs),deflateMs:round(D.compression.deflateMs)},
 functions:f,longTasksCount:D.longTasks.length,
 longTasksTotalMs:round(D.longTasks.reduce(function(s,x){return s+x.durationMs},0)),
 longestTasks:long.slice(0,15),events:D.events.slice(),cloud:(function(){
 var records=performance.getEntriesByType('resource')||[],numbers=[];
 records.forEach(function(x){if(/\\.supabase\\.co|supabase\\.in/.test(String(x.name||''))){
  numbers.push({startMs:round(x.startTime),durationMs:round(x.duration)});
 }});
 return {requestCount:numbers.length,totalResourceMs:round(numbers.reduce(function(a,x){return a+x.durationMs},0)),
 recentRequests:numbers.slice(-15)};
})(),
 notice:'fromNavigationToReportMs is NOT startup time; use splashHiddenMs. Network and delayed work may continue after splash.'
 };
};
try{
 var observer=new PerformanceObserver(function(list){
 list.getEntries().forEach(function(e){
 D.longTasks.push({startMs:round(e.startTime),durationMs:round(e.duration)});
 if(D.longTasks.length>200)D.longTasks.shift();
 });
 });
 observer.observe({entryTypes:['longtask']});
}catch(e){D.startup.longTaskObserverUnavailable=true}
document.addEventListener('DOMContentLoaded',function(){D.mark('domReadyCallback')},{once:true});
window.addEventListener('load',function(){D.mark('windowLoadedCallback')},{once:true});
window.addEventListener('error',function(){D.startup.scriptErrors=(D.startup.scriptErrors||0)+1});
window.addEventListener('unhandledrejection',function(){D.startup.promiseRejections=(D.startup.promiseRejections||0)+1});
window.pos314HookStorage=function(){
 if(D.startup.storageHookInstalled)return;
 D.startup.storageHookInstalled=true;
 var proto=Storage.prototype;
 ['getItem','setItem'].forEach(function(method){
 var previous=proto[method],isRead=method==='getItem';
 proto[method]=function(){
 var tick=performance.now();
 try{return previous.apply(this,arguments)}
 finally{
 if(this===window.localStorage){
 var ms=performance.now()-tick,s=D.storage;
 if(isRead){s.reads++;s.readMs+=ms;s.readMaxMs=Math.max(s.readMaxMs,ms)}
 else{s.writes++;s.writeMs+=ms;s.writeMaxMs=Math.max(s.writeMaxMs,ms)}
 }
 }
 };
 });
 if(window.pako){
 ['inflate','deflate'].forEach(function(name){
 var prev=window.pako[name];
 if(typeof prev!=='function')return;
 window.pako[name]=function(){
 var tick=performance.now();
 try{return prev.apply(this,arguments)}
 finally{
 var ms=performance.now()-tick,c=D.compression;
 if(name==='inflate'){c.inflates++;c.inflateMs+=ms}
 else{c.deflates++;c.deflateMs+=ms}
 }
 };
 });
 }
};
window.pos314HookFunctions=function(){
 var names=['renderHome','renderProducts','renderCart','renderPurchaseCart',
 'renderCustomers','renderSuppliers','renderSales','renderPurchases',
 'renderReports','renderCash','renderInventory','pos99EnsureAll','pos99FindDuplicateRecordNos',
 'persist','pos7R102SaveStateDirect','pos7R100PrepareStockRevisions','pos7BuildOwnerSnapshot'];
 names.forEach(function(name){
 var previous=window[name];
 if(typeof previous!=='function'||previous.__pos314Wrapped)return;
 var wrapped=function(){
 var tick=performance.now();
 try{return previous.apply(this,arguments)}
 finally{
 var ms=performance.now()-tick,x=D.functions[name]||(D.functions[name]={count:0,totalMs:0,maxMs:0});
 x.count++;x.totalMs+=ms;x.maxMs=Math.max(x.maxMs,ms);
 }
 };
 wrapped.__pos314Wrapped=true;
 window[name]=wrapped;
 try{if(name==='renderHome')renderHome=wrapped;
 else if(name==='renderProducts')renderProducts=wrapped;
 else if(name==='renderCart')renderCart=wrapped;
 else if(name==='renderPurchaseCart')renderPurchaseCart=wrapped;
 else if(name==='persist')persist=wrapped;
 else if(name==='pos7R102SaveStateDirect')pos7R102SaveStateDirect=wrapped;
 }catch(e){}
 });
 // Cloud requests remain untouched; report only passive resource timing.

};
function mount(){
 if(document.getElementById('pos314BootButton'))return;
 var btn=document.createElement('button');
 btn.id='pos314BootButton';btn.type='button';btn.textContent='⏱ قياس الإقلاع';
 btn.style.cssText='position:fixed;left:10px;bottom:14px;z-index:2147482000;background:#0f766e;color:white;border:2px solid #fff;border-radius:14px;padding:12px 15px;box-shadow:0 3px 18px #0005;font:700 15px Tahoma,sans-serif';
 var panel=document.createElement('div');panel.id='pos314BootPanel';panel.dir='rtl';
 panel.style.cssText='display:none;position:fixed;inset:3%;z-index:2147482999;background:#fff;color:#15212c;border:2px solid #0f766e;border-radius:16px;box-shadow:0 0 0 100vmax #0008;padding:15px;overflow:auto;font:14px/1.6 Tahoma,sans-serif';
 var title=document.createElement('div');title.textContent='تقرير قياس إقلاع POS7 — R314';
 title.style.cssText='font-size:20px;font-weight:bold;margin:6px 0';
 var close=document.createElement('button');close.textContent='إغلاق';close.type='button';
 var copy=document.createElement('button');copy.textContent='نسخ التقرير';copy.type='button';
 var refresh=document.createElement('button');refresh.textContent='تحديث القياس';refresh.type='button';
 [close,copy,refresh].forEach(function(b){b.style.cssText='padding:10px;margin:5px;border-radius:9px;background:#e0f2f1;color:#064e3b;font-weight:bold'});
 var pre=document.createElement('pre');pre.style.cssText='direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;background:#eef2f6;border-radius:8px;padding:12px;user-select:text';
 function draw(){pre.textContent=JSON.stringify(D.report(),null,2)}
 btn.onclick=function(){draw();panel.style.display='block'};
 close.onclick=function(){panel.style.display='none'};
 refresh.onclick=draw;
 copy.onclick=function(){var value=JSON.stringify(D.report(),null,2);
 if(navigator.clipboard&&navigator.clipboard.writeText){
 navigator.clipboard.writeText(value).then(function(){copy.textContent='تم النسخ ✓'},function(){prompt('انسخ التقرير',value)})
 }else prompt('انسخ التقرير',value);
 };
 panel.append(title,close,copy,refresh,pre);
 document.body.append(btn,panel);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
