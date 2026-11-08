const {test}=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../recovery/public-refresh.mjs');
class Button extends EventTarget{disabled=false;textContent='';}
test('explicit public refresh coalesces clicks, enforces cooldown, and never schedules reads',async()=>{
 const {bindPublicRefresh}=await load();const button=new Button(),note={textContent:''};let time=0,calls=0,resolve;
 const refresh=bindPublicRefresh({button,note,now:()=>time,read:()=>{calls++;return new Promise(r=>resolve=r);}});
 assert.equal(calls,0);const a=refresh();await Promise.resolve();const b=refresh();assert.equal(calls,1);assert.equal(button.disabled,true);resolve();await Promise.all([a,b]);assert.equal(button.disabled,false);
 await refresh();assert.equal(calls,1);assert.match(note.textContent,/60 detik/);
 time=60000;const c=refresh();await Promise.resolve();assert.equal(calls,2);assert.doesNotMatch(note.textContent,/Tunggu/);resolve();await c;assert.match(note.textContent,/Tekan Perbarui data/);assert.doesNotMatch(note.textContent,/Tunggu|belum berhasil/);
});
test('failed public refresh remains retryable after cooldown without exposing raw errors',async()=>{
 const {bindPublicRefresh}=await load();const button=new Button(),note={textContent:''};let time=0,calls=0;
 const refresh=bindPublicRefresh({button,note,now:()=>time,read:async()=>{calls++;if(calls===1)throw Error('SECRET');}});
 await refresh();assert.equal(button.disabled,false);assert.match(note.textContent,/belum berhasil/);assert.doesNotMatch(note.textContent,/SECRET/);time=60000;const retry=refresh();assert.doesNotMatch(note.textContent,/belum berhasil/);await retry;assert.equal(calls,2);assert.match(note.textContent,/Tekan Perbarui data/);assert.doesNotMatch(note.textContent,/Tunggu|belum berhasil/);
});
