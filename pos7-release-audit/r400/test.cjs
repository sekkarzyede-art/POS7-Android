const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const code=html.slice(html.indexOf('function pos391TogglePrivacy(){'),html.indexOf('function pos391MarkCards(){'));
const form={},input={value:'',select(){}},cancel={},status={},heading={};
let open=false,applies=0,cacheClears=0,lastStored='',cleared=0,current;
function makeDialog(){return {
 setAttribute(){},querySelector(s){return ({form,input,'h2':heading,'[type=button]':cancel,'[role=status]':status})[s]},
 addEventListener(_,fn){this.closed=fn},showModal(){open=true},close(){open=false;this.closed()},remove(){current=null}
};}
const context={document:{body:{appendChild(d){current=d}},createElement:makeDialog,getElementById(id){return id==='pos400PrivacyDialog'?current:id==='reportsHub'?{replaceChildren(){cleared++}}:null}},
 pos391Private:false,pos391ApplyPrivacy(){applies++},pos391MarkCards(){},localStorage:{setItem(k,v){lastStored=v}},
 window:{pos713ClearReportCache(){cacheClears++}},toast(){}};
vm.createContext(context);vm.runInContext(code,context);
const event={preventDefault(){}};
context.pos391TogglePrivacy();assert.equal(open,true);assert.equal(applies,0);
input.value='9999';form.onsubmit(event);assert.equal(open,true);assert.equal(applies,0);assert.ok(status.textContent);
cancel.onclick();assert.equal(open,false);assert.equal(context.pos391Private,false);
context.pos391TogglePrivacy();input.value='1212';form.onsubmit(event);assert.equal(open,false);assert.equal(context.pos391Private,true);assert.equal(lastStored,'on');
context.pos391TogglePrivacy();input.value='1212';form.onsubmit(event);assert.equal(context.pos391Private,false);assert.equal(lastStored,'off');
assert.equal(cleared,2);assert.equal(cacheClears,2);
const cart=html.match(/<script id="pos7-v176-sale-line-layout-script">([\s\S]*?)<\/script>/)[1];
const elements=new Map(); for(const id of ['cart','saleRate','saleTotal'])elements.set(id,{value:90000,addEventListener(){}});
const saleCart=[{id:1,name:'صنف',qty:2,sell:1.25,cost:0.5}];
const renderer={document:{getElementById:id=>elements.get(id),querySelector:()=>null},window:{pos719ProductById:()=>({id:1,stock:9})},saleCart,nv:Number,originalSaleQty:()=>1,lastBarcodeSaleId:null,esc:String,pos135PieceText:()=>'',setTimeout(){}};
vm.runInNewContext(cart,renderer);
renderer.window.renderCart();assert.match(elements.get('cart').innerHTML,/متوفر: 8/);assert.equal(elements.get('saleTotal').textContent,'$2.50');
console.log('Privacy dialog, cancel and reauthentication, and indexed cart values verified');
