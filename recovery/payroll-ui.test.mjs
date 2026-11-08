import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('./',import.meta.url);
test('payroll action boundary only opens dedicated recording controls',async()=>{
 const {payrollActionAllowed}=await import('./payroll-ui.mjs');
 assert.equal(payrollActionAllowed({dataset:{payrollAction:'paid'}}),true);
 assert.equal(payrollActionAllowed({dataset:{payrollAction:'unpaid'}}),true);
 assert.equal(payrollActionAllowed({dataset:{payrollAction:'save'}}),true);
 assert.equal(payrollActionAllowed({dataset:{payrollAction:'delete'}}),false);
 assert.equal(payrollActionAllowed({dataset:{},getAttribute:()=> 'confirmPaid()'}),false);
});
test('guard retains all legacy finance barriers and only exempts new payroll module',()=>{
 const guard=fs.readFileSync(new URL('entry-recovery.js',root),'utf8');
 assert.match(guard,/payrollRecording\?\.allowsAction/);
 assert.match(guard,/Fungsi pengelolaan ini tetap dilindungi/);
});
