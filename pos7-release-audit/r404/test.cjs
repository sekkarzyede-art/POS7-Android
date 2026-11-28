const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2],'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);for(const script of scripts)new vm.Script(script);
const ui=html.match(/<script id="pos404-debt-names">([\s\S]*?)<\/script>/)[1];
const native=html.slice(html.indexOf('window.pos404PrintNames='),html.indexOf('window.pos408GetSettings=read;'));
(async()=>{
 const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:800,height:1100}});
 await page.setContent('<html dir="rtl"><body></body></html>');
 await page.evaluate(()=>{
 window.toasts=[];window.toast=x=>toasts.push(x);window.state={customers:{'علي':0,'صفر':99,'دائن':20,'زبون نقدي':100,'<b>اسم</b>':1},suppliers:{'مورد موجب':0,'مورد صفر':80,'مورد دائن':90},sales:[{customer:'من فاتورة'}],openingBalanceEntries:[{partyType:'supplier',partyName:'افتتاحي'}]};
 window.pos398CustomerStatementBalanceUSD=n=>({'علي':50,'صفر':0,'دائن':-3,'زبون نقدي':100,'<b>اسم</b>':1,'من فاتورة':4}[n]||0);
 window.pos265SupplierBalanceUSD=n=>({'مورد موجب':7,'مورد صفر':0,'مورد دائن':-2,'افتتاحي':3}[n]||0);
 window.v250Can=()=>true;window.calls=[];window.pos404PrintNames=async r=>{calls.push(r)};
 });
 await page.addScriptTag({content:ui});
 await page.evaluate(()=>pos404DebtNames('customer'));
 assert.equal(await page.locator('#pos404NamesDialog li').count(),3);assert.equal(await page.locator('#pos404NamesDialog li b').count(),0);assert.equal(await page.evaluate(()=>calls.length),0);
 await page.getByRole('button',{name:'🖨️ طباعة Bluetooth',exact:true}).click();assert.equal(await page.evaluate(()=>calls.length),1);
 await page.getByRole('button',{name:'إغلاق ×'}).click();assert.equal(await page.locator('#pos404NamesDialog').count(),0);
 await page.evaluate(()=>pos404DebtNames('supplier'));assert.equal(await page.locator('#pos404NamesDialog li').count(),2);
 await page.getByRole('button',{name:'إغلاق ×'}).click();await page.evaluate(()=>{pos265SupplierBalanceUSD=()=>0;pos404DebtNames('supplier')});assert(await page.getByRole('button',{name:'🖨️ طباعة Bluetooth',exact:true}).isDisabled());
 await page.getByRole('button',{name:'إغلاق ×'}).click();await page.evaluate(()=>{v250Can=()=>false;pos404DebtNames('customer')});assert.equal(await page.locator('#pos404NamesDialog').count(),0);
 // Exercise native renderer with real canvas and existing raster encoding, stub only transport.
 const raster=html.slice(html.indexOf('function escPosBytes(canvas)'),html.indexOf('\n',html.indexOf('function escPosBytes(canvas)')));
 await page.addScriptTag({content:`let btBusy=false;const read=()=>({paperDots:384,graphicsMode:'gs_v0'});let sent=[];async function pos7SendNativeBluetooth(bytes,title){sent.push({length:bytes.length,title,start:Array.from(bytes.slice(0,2)),end:Array.from(bytes.slice(-6))});return true;}window.Pos7Android={printBluetoothBase64(){},getSelectedBluetoothPrinterAddress(){return 'printer'}};${raster}\n${native}\nwindow.getSent=()=>sent;`});
 await page.evaluate(()=>pos404PrintNames({title:'أسماء العملاء',date:'اليوم',names:Array.from({length:161},(_,i)=>'اسم طويل لاختبار طباعة الأسماء العربية كاملة '+i)}));
 const sent=await page.evaluate(()=>getSent());assert.equal(sent.length,1);assert(sent[0].length>10000);assert.deepEqual(sent[0].start,[27,64]);assert.deepEqual(sent[0].end,[27,100,3,29,86,0]);
 await browser.close();console.log('PASS: scripts, customer/supplier balances, escaping, preview-before-print, close, empty/permission cases, multi-band Arabic native raster.');
})().catch(e=>{console.error(e);process.exit(1)});
