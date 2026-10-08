const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../monitor-v2.html'),'utf8');
function section(a,b) { return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a))); }
test('startup never purges mismatched cashbook cache or invokes financial migration', () => {
 const cache = new Map([['wkkn_v2_cashbook_ver','old'],['wkkn_v2_cashbook',JSON.stringify([{id:'synthetic-original'}])]]);
 let timers=[], pushes=0;
 const ctx={window:{syncCashbookToFirestore:async()=>{pushes++;}},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)},console,setTimeout:f=>{timers.push(f);return timers.length},clearTimeout:()=>{}};
 vm.createContext(ctx);
 vm.runInContext(section('// ---------- CASHBOOK STATE','// ---------- COMPUTE SALDO')+'\nglobalThis.result=CASHBOOK;',ctx);
 timers.forEach(f=>f());
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.result)),[{id:'synthetic-original'}]);
 assert.equal(pushes,0);
 assert.equal(cache.get('wkkn_v2_cashbook_ver'),'old');
});
test('empty browser startup never manufactures authoritative cashbook row',()=>{
 const ctx={window:{syncCashbookToFirestore:async()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},console,setTimeout:()=>0,clearTimeout:()=>{}};
 vm.createContext(ctx);vm.runInContext(section('// ---------- CASHBOOK STATE','// ---------- COMPUTE SALDO')+'\nglobalThis.result=CASHBOOK;',ctx);
 assert.equal(ctx.result.length,0);
});
test('all SDK writes use entry-safe lexical wrappers, not blind raw setters',()=>{
 assert.match(html,/setDoc as sdkSetDoc/);
 assert.match(html,/updateDoc as sdkUpdateDoc/);
 assert.match(html,/deleteDoc as sdkDeleteDoc/);
 assert.match(html,/runTransaction/);
 assert.match(html,/function setDoc\(ref, payload\)/);
 assert.match(html,/function updateDoc\(/);
 assert.match(html,/function deleteDoc\(/);
});
test('staff form cannot announce unacknowledged cloud save or create wages',()=>{
 const body=section('function submitForm()', '// ⭐ 22 Jul 2026 — MULTI-AKTIVITAS INLINE');
 assert.match(body,/entryRecovery\.enqueue/);
 assert.match(body,/entryRecovery\.drain/);
 assert.doesNotMatch(body,/auto-sync ke Firestore \(cross-browser live/);
 assert.doesNotMatch(body,/UPAH_ITEMS\.push|UPAH_ITEMS\.unshift|saveUpah\(/);
});
