'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const cp=require('node:child_process');
const css=fs.readFileSync('recovery/harvest-presentation.css','utf8');
test('table-only repair leaves all HTML, financial callbacks and runtime sources unchanged',()=>{
 const names=cp.execFileSync('git',['diff','--name-only','89b8580ed3d88bfd9c29903c73f1dc2c8834d58f','d2a7b4c81d488199ac28d82d178fc7f07d94c6d3'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert(names.every(n=>n==='recovery/harvest-presentation.css'||n==='tests/table-layout-proportions.test.cjs'),names.join('\n'));
 assert.equal(cp.execFileSync('git',['show','d2a7b4c81d488199ac28d82d178fc7f07d94c6d3:monitor-v2.html'],{encoding:'utf8',maxBuffer:5e6}),cp.execFileSync('git',['show','89b8580ed3d88bfd9c29903c73f1dc2c8834d58f:monitor-v2.html'],{encoding:'utf8',maxBuffer:5e6}));
});
test('audited narrative tables receive explicit readable minimums without clipping content',()=>{
 const block=css.split('/* Audited operational tables:')[1];assert(block,'missing scoped table repair');
 for(const source of ['cashbook-tbody','masuk-table-wrap','opt-obs-tbody','ms-tbody','log-tbody','panen-sampling-tbody','panen-batch-tbody','late-entry-tbody-wrap'])assert(block.includes(source),source);
 assert.match(block,/vertical-align:\s*middle/);assert.match(block,/table-layout:\s*fixed/);assert.match(block,/white-space:\s*nowrap/);
 assert.doesNotMatch(block,/text-overflow:\s*ellipsis|line-clamp|overflow:\s*hidden|font-size:\s*(?:[0-9]|10)px|(?:^|[;{]\s*)height:\s*\d+px/);
});
