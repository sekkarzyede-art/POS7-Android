window.pos397SendCashReceipt=async function(report){
 const bridge=window.Pos7Android;
 if(typeof bridge?.printBluetoothBase64!=='function'||!bridge.getSelectedBluetoothPrinterAddress?.())return toast('اختر طابعة Bluetooth المعتمدة من إعدادات الطباعة');
 if(btBusy)return toast('الطابعة تنفذ عملية أخرى؛ انتظر حتى تنتهي');
 btBusy=true;
 try{
  const config=read(),width=Number(config.paperDots)===384?384:576;
  const money=(cents,signed=false)=>(cents<0?'−':signed&&cents>0?'+':'')+(Math.abs(cents)/100).toFixed(2).replace(/\.00$/,'')+'$';
  const parts=[],lineHeight=34,margin=9;
  const rowText=(row)=>[row.label,row.party,row.ref].filter(Boolean).join('  ');
  for(let start=0;start<Math.max(1,report.rows.length);start+=100){
   const band=report.rows.slice(start,start+100),first=start===0,last=start+band.length>=report.rows.length;
   const canvas=document.createElement('canvas');
   canvas.width=width;canvas.height=(band.length||1)*lineHeight+(first?109:0)+(last?(report.estimated?142:114):0);
   const ctx=canvas.getContext('2d');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle='#000';
   let y=0;
   function text(value,x,base,align,dir,size,maxWidth){
    ctx.direction=dir;ctx.textAlign=align;ctx.font='bold '+size+'px Arial,Tahoma,sans-serif';ctx.fillText(value,x,base,maxWidth);
   }
   function rule(top){ctx.fillRect(margin,top,width-2*margin,1);}
   if(first){
    text('جرد الصندوق اليومي',width/2,29,'center','rtl',28,width-18);
    text(report.displayDay+'  '+report.displayTime,width/2,57,'center','ltr',21,width-18);
    rule(68);
    text('الحركة',width-margin,94,'right','rtl',22,width-120);
    text('المبلغ',margin,94,'left','rtl',21,100);
    y=109;
   }
   for(const row of band){
    const value=money(row.cents,true);
    ctx.font='bold 21px Arial,Tahoma,sans-serif';
    const amountWidth=Math.max(78,Math.min(width*.42,ctx.measureText(value).width+8));
    text(value,margin,y+24,'left','ltr',21,amountWidth);
    text(rowText(row),width-margin,y+24,'right','rtl',22,width-2*margin-amountWidth-10);
    rule(y+lineHeight-1);y+=lineHeight;
   }
   if(!band.length){text('لا توجد حركة نقدية اليوم',width/2,y+24,'center','rtl',22,width-18);y+=lineHeight;}
   if(last){
    for(const [label,cents] of [['الداخل',report.incoming],['الخارج',-report.outgoing],['صافي نقد اليوم',report.balance]]){
     text(label,width-margin,y+27,'right','rtl',23,width*.56);
     text(money(cents),margin,y+27,'left','ltr',23,width*.40);
     y+=32;
    }
    if(report.estimated)text('بعض قيود الليرة محسوبة بالسعر الحالي',width/2,y+19,'center','rtl',17,width-18);
   }
   const bytes=escPosBytes(canvas);
   // Strip per-band initialization and cut commands when continuing the same receipt.
   parts.push(bytes.subarray(first?0:2,last?bytes.length:bytes.length-6));
   canvas.width=1;canvas.height=1;
  }
  const bytes=new Uint8Array(parts.reduce((length,part)=>length+part.length,0));
  let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const ok=await pos7SendNativeBluetooth(bytes,'جرد الصندوق اليومي',true);
  toast(ok?'أُرسل جرد اليوم إلى الطابعة':'تعذرت الطباعة؛ تحقّق من الطابعة قبل المحاولة مجددًا');
  return ok;
 }catch(e){console.error(e);toast('تعذر تجهيز طباعة جرد الصندوق');return false;}
 finally{btBusy=false;}
};
