'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const html=fs.readFileSync('monitor-v2.html','utf8');
test('wage table headers and cells center on both axes within the wage panel only',()=>{
 assert.match(html,/#panel-anggaran table th,\s*#panel-anggaran table td\{text-align:center!important;vertical-align:middle!important\}/);
});
test('alignment-only change preserves all application scripts and wage markup',()=>{
 const previous=cp.execFileSync('git',['show','5b66beecdaea9c9e3eb53210d56e8099ef5c6f76:monitor-v2.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
 const alignmentRelease=cp.execFileSync('git',['show','cce35b50e60d855137c34bfd4fe0970b5106411c:monitor-v2.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
 const scripts=s=>[...s.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(x=>x[0]);
 assert.deepEqual(scripts(alignmentRelease),scripts(previous));
 const panel=s=>s.slice(s.indexOf('id="panel-anggaran"'),s.indexOf('id="panel-rab"'));
 assert.equal(panel(alignmentRelease),panel(previous));
});
