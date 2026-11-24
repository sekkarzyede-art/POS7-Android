/* POS7 R341 inventory identity resolver. Read-only, deterministic and store-scoped. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  root.POS7InventoryIdentityR341=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalize(barcode){
    const raw=String(barcode??'').trim();
    if(!/^[0-9]+$/.test(raw)) return raw;
    return raw.replace(/^0+(?=\d)/,'');
  }
  function inspect(products,barcode,aliases=[]){
    const key=normalize(barcode);
    const rows=(products||[]).filter(p=>normalize(p.barcode)===key);
    const ids=new Set(rows.map(p=>String(p.id)));
    if(rows.length===0)return {status:'missing',matches:[]};
    const scope=(aliases||[]).filter(a=>normalize(a.alias_barcode)===key);
    const approved=new Set(scope.filter(a=>a.status==='approved').map(a=>String(a.primary_product_id)));
    if(ids.size===1 && rows.length===1)return {status:'unique',product:rows[0],matches:rows};
    if(approved.size===1){
      const master=rows.find(p=>approved.has(String(p.id)));
      if(master && scope.every(a=>a.status!=='approved'||String(a.primary_product_id)===String(master.id)))
        return {status:'approved-alias',product:master,matches:rows};
    }
    return {status:'ambiguous',matches:rows};
  }
  function safeQuantity(counted,subsequentMovements){
    if(!Number.isSafeInteger(counted)||counted<0)throw Error('invalid_counted_qty');
    if(!Array.isArray(subsequentMovements))throw Error('movements_required');
    const ids=new Set();let qty=counted;
    for(const m of subsequentMovements){
      if(!m || !m.id || ids.has(String(m.id)))throw Error('duplicate_or_missing_movement');
      ids.add(String(m.id));
      if(!Number.isSafeInteger(m.delta))throw Error('unsafe_movement');
      qty+=m.delta;
      if(!Number.isSafeInteger(qty))throw Error('unsafe_stock_result');
    }
    return qty;
  }
  return Object.freeze({normalize,inspect,safeQuantity});
});
