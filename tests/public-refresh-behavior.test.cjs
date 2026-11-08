const {test}=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../recovery/public-refresh.mjs');
class Button extends EventTarget{disabled=false;textContent='';}
test('explicit public refresh coalesces clicks, enforces cooldown, and never schedules reads',async()=>{
 const {bindPublicRefresh}=await load();const button=new Button(),note={textContent:''};let time=0,calls=0,resolve;
 const refresh=bindPublicRefresh({button,note,now:()=>time,read:()=>{calls++;return new Promise(r=>resolve=r);}});
 assert.equal(calls,0);const a=refresh();await Promise.resolve();const b=refresh();assert.equal(calls,1);assert.equal(button.disabled,true);resolve();await Promise.all([a,b]);assert.equal(button.disabled,false);
 await refresh();assert.equal(calls,1);assert.match(note.textContent,/60 detik/);
 time=60000;const c=refresh();await Promise.resolve();assert.equal(calls,2);resolve();await c;
});
test('failed public refresh remains retryable after cooldown without exposing raw errors',async()=>{
 const {bindPublicRefresh}=await load();const button=new Button(),note={textContent:''};let time=0,calls=0;
 const refresh=bindPublicRefresh({button,note,now:()=>time,read:async()=>{calls++;throw Error('SECRET');}});
 await refresh();assert.equal(button.disabled,false);assert.doesNotMatch(note.textContent,/SECRET/);time=60000;await refresh();assert.equal(calls,2);
});
