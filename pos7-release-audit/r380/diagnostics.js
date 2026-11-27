(function(){'use strict';
const VERSION='R380', MAX=250;
const names=['openPage','renderHome','renderCashboxPage','renderSales','renderPurchase','renderCart','renderPurchaseCart','renderStock','renderLedger','renderReports','renderCustomers','renderSuppliers','customerBalanceUSD','supplierBalanceUSD','save','saveState','pos485SaveSession','pos307MarkHomeDirty','pos789SyncIsBusy','pos7PublishOwnerSnapshot','pos7OwnerPublish','pos100SalesInRange','pos100Group','renderProducts','searchProducts','renderSearchResults','pos322WriteState','pos322ReadState','pos178MountDate','pos7PostJournalEntry','pos7R354ShowCurrentAudit','pos398CustomerStatementBalanceUSD','renderSaleSettingsPage','renderSalesReport','renderPurchaseReport'];
const allowedPages=new Set(['home','sales','purchase','queries','stock','customers','suppliers','reports','cashbox','settings','saleSettingsPage','returns','salesReturns','purchaseReturns','accounting','ownerWallet','financialCenter','expenses','users','inventory','payments','receipts']);
const safePage=x=>allowedPages.has(x)?x:'other';
const page=()=>safePage(document.querySelector('.page.active')?.id||'other');
const clock=()=>performance.now();
const round=x=>Math.round(x*10)/10;
let running=null,lastReport=null;
function install(){
 const host=document.getElementById('saleSettingsPage');if(!host||document.getElementById('r380Perf'))return;
 const old=document.getElementById('r379Perf');if(old)old.remove();
 const panel=document.createElement('div');panel.id='r380Perf';panel.className='panel';
 const make=(tag,text,parent=panel)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;parent.append(el);return el};
 make('h3','تشخيص الأداء المتقدم — R380');
 make('p','قياس مؤقت دون تغيير الحسابات أو المزامنة. التقرير لا يتضمن بيانات العملاء أو الفواتير.');
 const sel=make('select');for(const n of [30,60,120]){const o=make('option',n+' ثانية',sel);o.value=n}sel.value='60';
 const start=make('button','بدء التشخيص');start.type='button';start.className='soft';
 const copy=make('button','نسخ التقرير');copy.type='button';copy.className='soft';copy.disabled=true;
 const out=make('pre','اختر المدة ثم اضغط بدء التشخيص.');out.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;direction:rtl';
 const manual=make('textarea',null);manual.hidden=true;manual.readOnly=true;manual.style.cssText='width:100%;min-height:180px;direction:ltr';
 host.append(panel);
 function addBound(a,x){if(a.length<MAX)a.push(x);else running.truncated++}
 function measure(seconds){
 const t0=clock(),r={start:t0,seconds,pageStart:page(),frames:0,slowFrames:0,maxFrameGap:0,clicks:[],scrolls:0,scrollPages:{},tasks:[],calls:{},samples:[],hooks:[],missing:[],truncated:0,storage:{},syncBusySamples:0,network:{onlineStart:navigator.onLine,onlineEnd:null},memoryStart:performance.memory?.usedJSHeapSize??null};
 running=r;let last=t0,raf=0,timer=0,obs=null,eventObs=null,interval=0,ended=false;const restore=[],pending=new Set();
 const record=(name,d,where,at)=>{if(ended)return;const k=name+' @ '+where,a=r.calls[k]||(r.calls[k]={function:name,page:where,count:0,totalMs:0,maxMs:0,over50ms:0});a.count++;a.totalMs+=d;a.maxMs=Math.max(a.maxMs,d);if(d>=50){a.over50ms++;addBound(r.samples,{function:name,page:where,startMs:round(at-t0),durationMs:round(d)})}};
 function wrap(obj,key,label,storage=false){let f;try{f=obj[key]}catch(e){return false}if(typeof f!=='function')return false;
  const wrapped=function(...args){const a=clock(),where=page();try{return Reflect.apply(f,this,args)}finally{const d=clock()-a;record(label,d,where,a);if(storage){const z=r.storage[label]||(r.storage[label]={count:0,totalMs:0,maxMs:0});z.count++;z.totalMs+=d;z.maxMs=Math.max(z.maxMs,d)}}};
  try{obj[key]=wrapped;if(obj[key]!==wrapped)return false;restore.push(()=>{if(obj[key]===wrapped)obj[key]=f});return true}catch(e){return false}
 }
 for(const n of names){if(wrap(window,n,n))r.hooks.push(n);else r.missing.push(n)}
 // Storage records duration only: no key or value is collected.
 for(const n of ['getItem','setItem','removeItem'])try{if(wrap(Storage.prototype,n,'Storage.'+n,true))r.hooks.push('Storage.'+n)}catch(e){}
 if(window.pako)for(const n of ['deflate','inflate','gzip','ungzip'])if(wrap(window.pako,n,'pako.'+n))r.hooks.push('pako.'+n);
 const onClick=e=>{const at=clock(),where=page(),target=e.target?.closest?.('button,[role="button"],.nav,.card');let id=target?.id||'';if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,48}$/.test(id)||!/(home|sale|purchase|report|search|cash|stock|settings|nav|sync|perf|cart|save|print|close|back)/i.test(id))id='';const row={page:where,control:id||target?.tagName||'other',atMs:round(at-t0),nextFrameMs:null};addBound(r.clicks,row);const token=requestAnimationFrame(()=>{pending.delete(token);if(!ended){row.nextFrameMs=round(clock()-at);row.pageAfter=page()}});pending.add(token)};
 const onScroll=()=>{r.scrolls++;const p=page();r.scrollPages[p]=(r.scrollPages[p]||0)+1};
 const onOnline=()=>{r.network.changes=(r.network.changes||0)+1};
 const frame=t=>{if(ended)return;const d=t-last;last=t;r.frames++;if(d>34){r.slowFrames++;if(d>=100)addBound(r.samples,{function:'frame-gap',page:page(),startMs:round(t-t0-d),durationMs:round(d)})}r.maxFrameGap=Math.max(r.maxFrameGap,d);raf=requestAnimationFrame(frame)};
 const readTasks=list=>{for(const e of list){if(e.startTime<t0)continue;addBound(r.tasks,{startMs:round(e.startTime-t0),durationMs:round(e.duration),attribution:e.attribution?.[0]?.containerType||'unknown'})}};
 try{obs=new PerformanceObserver(l=>readTasks(l.getEntries()));obs.observe({type:'longtask',buffered:false})}catch(e){obs=null}
 const interactions=[];
 function readEvents(list){for(const e of list){if(e.startTime<t0||!['click','pointerdown','pointerup','touchstart','touchend'].includes(e.name))continue;addBound(interactions,{event:e.name,startMs:round(e.startTime-t0),durationMs:round(e.duration),inputDelayMs:round(e.processingStart-e.startTime),processingMs:round(e.processingEnd-e.processingStart)})}}
 try{eventObs=new PerformanceObserver(l=>readEvents(l.getEntries()));eventObs.observe({type:'event',durationThreshold:16,buffered:false})}catch(e){eventObs=null}
 document.addEventListener('click',onClick,{capture:true,passive:true});document.addEventListener('scroll',onScroll,{capture:true,passive:true});window.addEventListener('online',onOnline);window.addEventListener('offline',onOnline);
 interval=setInterval(()=>{try{if(window.pos789SyncIsBusy?.())r.syncBusySamples++}catch(e){}},1000);
 raf=requestAnimationFrame(frame);start.textContent='إيقاف القياس';sel.disabled=true;copy.disabled=true;manual.hidden=true;out.textContent='القياس نشط. تنقل بين البطاقات ومرر وابحث بصورة طبيعية.';
 function finish(){if(ended)return;const end=clock();try{if(obs)readTasks(obs.takeRecords());if(eventObs)readEvents(eventObs.takeRecords())}catch(e){}ended=true;clearTimeout(timer);clearInterval(interval);cancelAnimationFrame(raf);for(const n of pending)cancelAnimationFrame(n);obs?.disconnect();eventObs?.disconnect();document.removeEventListener('click',onClick,true);document.removeEventListener('scroll',onScroll,true);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOnline);window.removeEventListener('pagehide',finish);for(const undo of restore.reverse())try{undo()}catch(e){}
 const duration=(end-t0)/1000;r.network.onlineEnd=navigator.onLine;
 const calls=Object.values(r.calls).sort((a,b)=>b.totalMs-a.totalMs).map(x=>({...x,totalMs:round(x.totalMs),maxMs:round(x.maxMs)}));
 const tasks=r.tasks.map(t=>({...t,overlappingFunctions:[...new Set(r.samples.filter(s=>s.function!=='frame-gap'&&s.startMs<t.startMs+t.durationMs&&s.startMs+s.durationMs>t.startMs).map(s=>s.function))]}));
 lastReport={version:VERSION,device:'TAB2',durationSeconds:round(duration),pageStart:r.pageStart,pageEnd:page(),frames:r.frames,averageFps:round(r.frames/duration),slowFrames:r.slowFrames,maxFrameGapMs:round(r.maxFrameGap),clickCount:r.clicks.length,maxClickToNextFrameMs:Math.max(0,...r.clicks.map(x=>x.nextFrameMs||0)),clicks:r.clicks,scrollEvents:r.scrolls,scrollPages:r.scrollPages,longTaskSupported:!!obs,longTasks:tasks,eventTimingSupported:!!eventObs,interactions,functions:calls,slowSamples:r.samples,storage:r.storage,syncBusySamples:r.syncBusySamples,network:r.network,memory:{startBytes:r.memoryStart,endBytes:performance.memory?.usedJSHeapSize??null},instrumented:r.hooks,unavailable:r.missing,truncated:r.truncated,notes:['Function timings are inclusive and may overlap.','Long task attribution is temporal correlation, not a stack trace.','Click-to-next-frame is not a paint-completion guarantee.','Sync activity sampled once per second; network state is browser connectivity, not server health.']};
 running=null;start.textContent='بدء التشخيص';sel.disabled=false;copy.disabled=false;out.textContent='مدة القياس: '+lastReport.durationSeconds+' ثانية\nمتوسط الإطارات: '+lastReport.averageFps+' FPS\nأطول فاصل: '+lastReport.maxFrameGapMs+' ms\nأقصى تأخير بعد الضغط: '+lastReport.maxClickToNextFrameMs+' ms\nالمهام الطويلة المسجلة: '+tasks.length+'\nأبرز الوظائف (زمن شامل):\n'+calls.slice(0,8).map(x=>x.function+' — '+x.page+' : '+x.totalMs+' ms / '+x.count).join('\n')+'\nاضغط نسخ التقرير لإرساله كاملاً.';stop=null;
 }
 window.addEventListener('pagehide',finish,{once:true});timer=setTimeout(finish,seconds*1000);return finish;
 }
 let stop=null;
 start.onclick=()=>{if(stop){stop();return}stop=measure(Number(sel.value)||60)};
 copy.onclick=async()=>{if(!lastReport)return;const txt=JSON.stringify(lastReport,null,2);let copied=false;try{await navigator.clipboard.writeText(txt);copied=true}catch(e){}if(!copied){manual.hidden=false;manual.value=txt;manual.focus();manual.select();try{copied=document.execCommand('copy')}catch(e){}}if(copied){copy.textContent='تم نسخ التقرير';manual.hidden=true}else{copy.textContent='حدد النص وانسخه';manual.hidden=false}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();