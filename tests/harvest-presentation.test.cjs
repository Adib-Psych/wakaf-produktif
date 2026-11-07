'use strict';
// Presentation contract pinned to the public-live release, not a mutable branch.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='72d62fca6291edff4f6fd8748026d97ce838e0af';
const before=cp.execFileSync('git',['show',base+':monitor-v2.html'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}),after=fs.readFileSync(root+'/monitor-v2.html','utf8');
const scripts=s=>[...s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m=>[m[1],m[2]]);
const attr=(tag,k)=>{const m=tag.match(new RegExp('\\s'+k+'(?:\\s*=\\s*("[^"]*"|\x27[^\x27]*\x27|[^\\s>]+))?(?=\\s|>|/>)','i'));return m?m[0].trim():null;};
const runtimeTags=s=>[...s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)].map(m=>{const keys=['id','name','type','value','required','disabled','hidden','min','max','step','pattern','multiple','checked','selected','form','action','method','data-panel'];const attrs=keys.map(k=>attr(m[0],k)).filter(Boolean);const events=[...m[0].matchAll(/\son[\w-]+\s*=\s*("[^"]*"|'[^']*')/gi)].map(x=>x[0].trim());return {tag:m[1].toLowerCase(),attrs,events};}).filter(x=>x.attrs.length||x.events.length);
const options=s=>[...s.matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)].map(x=>x[0]);
test('harvest presentation asset exists and is linked once',()=>{assert(fs.existsSync(root+'/recovery/harvest-presentation.css'));assert.equal((after.match(/href="recovery\/harvest-presentation\.css"/g)||[]).length,1);});
test('all existing script bodies and script load order remain byte-identical',()=>assert.deepEqual(scripts(after),scripts(before)));
test('runtime identifiers, control semantics and handlers remain in order',()=>{const a=runtimeTags(after),b=runtimeTags(before);const originalIds=new Set(b.flatMap(x=>x.attrs.filter(t=>t.startsWith('id='))));const stripped=a.filter(x=>!x.attrs.some(t=>t.startsWith('id=')&&!originalIds.has(t)));assert.deepEqual(stripped,b);});
test('static select choices preserve exact original values and copy',()=>assert.deepEqual(options(after),options(before)));
// This historical release was presentation-only. The separately authorized account
// repair is covered by account-preservation and account-session runtime tests.
test('historical harvest release changed no existing behavior, backend, reader, auth, queue or cache files',()=>{const allowed=new Set(['monitor-v2.html','recovery/harvest-presentation.css','tests/harvest-presentation.test.cjs','CURRENT.md','status-pekerjaan.html','HARVEST-PRESENTATION.md']);const changed=cp.execFileSync('git',['diff','--name-only',base,'90ef6e67f5954a1137767c77c9efe6f0f0399a7a','--'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}).trim().split('\n').filter(Boolean);assert.deepEqual(changed.filter(p=>!allowed.has(p)),[]);});
