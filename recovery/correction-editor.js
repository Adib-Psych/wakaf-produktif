// Single correction editor authority; durable original-owner commands survive retry/reload.
export function createCorrectionEditor({operations,session,storage=localStorage,editorKey='wkkn_correction_editor_v1'}){
 const key=editorKey;let intent=0,active=null,flight=null,activeTicket=null;
 function ticket(){const s=session.sessionTicket();if(!s)throw Error('sign-in-required');return s;}
 function check(s,n){if(!session.sessionMatches(s)||n!==intent)throw Error('editor-superseded');}
 function persist(){storage.setItem(key,JSON.stringify(active));}
 async function open(target){const s=ticket(),n=intent;const retained=storage.getItem(key);if(retained&&JSON.parse(retained)&&JSON.parse(retained).owner_uid!==s.uid)throw Error('editor-owner');if(retained&&JSON.parse(retained)?.dirty&&!active)throw Error('retained-draft-restore-required');if(flight)throw Error('editor-flight-open-refused');const head=await operations.observe('correction',target);check(s,n);if(active?.dirty)throw Error('unsent-edit-open-refused');active={owner_uid:s.uid,target,revision:head.revision,predecessor:head.command_id,base:head.body,draft:head.body,dirty:false,pending:null};activeTicket=s;intent++;persist();return JSON.parse(JSON.stringify(active));}
 function edit(body,reason){if(!active||active.owner_uid!==ticket().uid)throw Error('editor-owner');if(!activeTicket||!session.sessionMatches(activeTicket))throw Error('editor-superseded');if(arguments.length>1&&(typeof reason!=='string'||reason.length>500))throw Error('invalid-reason');const draft=JSON.parse(JSON.stringify(body));active.draft=draft;if(arguments.length>1)active.reason=reason;active.dirty=true;persist();}
 async function save(reason){const s=ticket(),n=intent;if(!active||active.owner_uid!==s.uid)throw Error('editor-owner');if(flight)return flight;
  if(!activeTicket||!session.sessionMatches(activeTicket))throw Error('editor-superseded');if(typeof reason!=='string'||!reason.trim()||reason.length>500)throw Error('invalid-reason');if(!active.pending){active.reason=reason;persist();}
  const snapshot=JSON.parse(JSON.stringify(active));
  flight=(async()=>{let op=snapshot.pending;
   if(!op){op=await operations.prepare('correction',snapshot.target,snapshot.draft,reason,{revision:snapshot.revision,predecessor:snapshot.predecessor});check(s,n);active.pending=op;persist();}
   const ack=await operations.send(op);check(s,n);
   // Retain edits made in flight; ACK advances predecessor, not unsent native fields.
   active.revision=ack.revision;active.predecessor=ack.command_id;active.base=ack.body;active.pending=null;active.dirty=JSON.stringify(active.draft)!==JSON.stringify(ack.body)||active.reason!==op.reason;persist();return ack;
  })();try{return await flight;}finally{flight=null;}
 }
 async function retry(){if(!active?.pending)throw Error('pending-not-found');return save(active.pending.reason);}
 function retained(){const s=ticket();const raw=storage.getItem(key);if(!raw)return null;const value=JSON.parse(raw);if(!value)return null;if(value.owner_uid!==s.uid)throw Error('editor-owner');return value;}
 function restore(expected){if(flight)throw Error('editor-flight-restore-refused');const value=retained();if(!value)return null;if(expected&&JSON.stringify(value)!==JSON.stringify(expected))throw Error('retained-draft-changed');active=value;activeTicket=ticket();intent++;return JSON.parse(JSON.stringify(active));}
 function cancel(){intent++;active=null;}
 function invalidate(){intent++;active=null;}
 function view(){return active?JSON.parse(JSON.stringify(active)):null;}
 return Object.freeze({open,edit,save,retry,retained,restore,cancel,invalidate,view});
}
