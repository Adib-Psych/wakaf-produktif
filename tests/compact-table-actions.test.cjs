'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const base='d2a7b4c81d488199ac28d82d178fc7f07d94c6d3',release='fe8e75757372808d050d8b51bc27a67ac669e3a4',html=cp.execFileSync('git',['show',release+':monitor-v2.html'],{encoding:'utf8',maxBuffer:5e6});
test('compact action release preserves all original markup and financial scripts',()=>{
 const before=cp.execFileSync('git',['show',base+':monitor-v2.html'],{encoding:'utf8',maxBuffer:5e6});
 assert.equal(html.replace('\n<script defer src="recovery/table-actions.js"></script>',''),before);
});
test('menu only moves original controls and never introduces persistence or write calls',()=>{
 const src=fs.readFileSync('recovery/table-actions.js','utf8');
 assert.match(src,/content\.append\(cell\.firstChild\)/);
 assert.doesNotMatch(src,/fetch\(|localStorage|indexedDB|deleteBatchUpah\(|editLaporan\(|innerHTML\s*=|eval\(/);
 assert.match(src,/Escape/);assert.match(src,/aria-label/);
});
