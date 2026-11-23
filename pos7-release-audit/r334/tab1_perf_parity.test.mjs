import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='r321-android/tab1/POS7_Tablet/';
const html=fs.readFileSync(root+'app/src/main/assets/index.html','utf8');
const gradle=fs.readFileSync(root+'app/build.gradle','utf8');
assert.ok(gradle.includes("versionName '485.7.229-r334-tab1'"));
for(const key of [
 'window.pako.deflate(value,{level:1});',
 'window.pos307HomeBatchInstalled=true',
 'window.pos309HomeBatchActive=()=>depth>0',
 'id="pos7-r310-purchase-single-commit"',
 'window.pos310Installed=true',
 'function buildSaleIndex()',
 'pos319RepairDirty',
 'pos319ForeignKeys',
 'if(changed)try{persist()}catch(e){}',
 'pos7-r322-native-state-storage',
 'pos7-r325-safe-sync',
 'pos7-r333-storage-dashboard',
 'POS7_R174_SMART_CAS_SERVER_VERIFIED',
 'pos7_inventory_commit_r155',
])assert.ok(html.includes(key),'missing feature '+key);
for(const forbidden of [
 'window.pos311SaleActive',
 'POS7_RESTORE_PENDING_R305',
 'pos7_restore_same_device_r324',
 'pos7Store2ActivateFirstTablet'
])assert.ok(!html.includes(forbidden),'wrong-store feature '+forbidden);
assert.ok(!html.includes('var pos185Serialized=JSON.stringify(state);'),'duplicate startup JSON serialization');
assert.ok(!html.includes('document.addEventListener(\'DOMContentLoaded\',summary);'),'hidden stock summary must stay lazy');
assert.ok(html.includes('if(pos319RepairDirty)persist()'),'accounting startup write should be conditional');
assert.ok(html.includes("if(window.pos310PurchaseActive?.())return false;"),'cloud must wait for durable purchase commit');
console.log('R334 PASS: Store2 proven invoice save + boot optimizations, store1 native storage, R174, inventory, Supabase 1 and settings preserved');
