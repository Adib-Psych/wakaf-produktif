const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('recovery/restored-dashboard.js','utf8');
test('public dashboard uses explicit refresh, not full-collection minute polling or reconnect reads',()=>{
 assert.match(source,/if\(mode==='public-live'\)\{[\s\S]*?bindPublicRefresh\(/);
 assert.match(source,/else\{\s*window\.addEventListener\('online'/);
 assert.doesNotMatch(source,/await model\.refresh\(\);if\(!isFixture\)\{setInterval\(model\.refresh,60000\)/);
});
