// Dedicated payroll controls never invoke legacy local-first finance handlers.
export const payrollActionAllowed=node=>['paid','unpaid','save','close','field'].includes(node?.dataset?.payrollAction);
export function mountPayrollUI({document,readWages,record,sessionAvailable,readIntent=()=>null}){
 const owned=new WeakSet();let pending=null,busy=false;
 const make=(tag,text,action)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(action){n.dataset.payrollAction=action;owned.add(n);}return n;};
 const panel=document.getElementById('panel-anggaran');
 const note=make('p','Pencatatan pembayaran berizin akun Google. Ini bukan transfer uang. Status dan tanggal hanya dicatat setelah pembayaran nyata.');note.id='payroll-recording-status';note.setAttribute('role','status');panel.prepend(note);
 const styles=make('style');styles.textContent=`
#payroll-recording-dialog { box-sizing:border-box; width:calc(100% - 32px); max-width:540px; max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px); margin:auto; padding:24px; overflow:auto; border:1px solid var(--harvest-line,#e4d9df); border-radius:var(--r,10px); background:#fff; color:var(--ink,#30282b); font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; box-shadow:0 20px 64px rgb(67 45 56 / 22%); }
#payroll-recording-dialog::backdrop { background:rgb(48 40 43 / 42%); }
#payroll-recording-dialog *, #payroll-recording-dialog *::before, #payroll-recording-dialog *::after { box-sizing:border-box; }
#payroll-recording-dialog h3 { margin:0 0 16px; color:var(--earth,#432d38); font-size:22px; line-height:1.25; font-weight:750; letter-spacing:-.4px; }
#payroll-recording-dialog .payroll-summary { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 16px; margin:0 0 16px; padding:14px; border:1px solid var(--harvest-line,#e4d9df); border-radius:var(--r-sm,7px); background:var(--cream,#f8f4ef); overflow-wrap:anywhere; }
#payroll-recording-dialog .payroll-activity { grid-column:1/-1; font-weight:650; }
#payroll-recording-dialog .payroll-work-date { color:var(--mute,#70636a); font-size:12px; }
#payroll-recording-dialog .payroll-amount { color:var(--earth,#432d38); font-size:18px; font-weight:750; font-variant-numeric:tabular-nums; }
#payroll-recording-dialog label { display:flex; flex-direction:column; align-items:stretch; gap:6px; width:100%; margin:0 0 14px; font-size:13px; font-weight:650; color:var(--ink,#30282b); }
#payroll-recording-dialog input, #payroll-recording-dialog select, #payroll-recording-dialog textarea { display:block; width:100%; min-width:0; max-width:100%; min-height:44px; margin:0; padding:10px 12px; border:1px solid #a99aa2; border-radius:var(--r-sm,7px); background:#fff; color:var(--ink,#30282b); font-weight:400; font-family:inherit; font-size:16px; line-height:1.4; box-shadow:none; }
#payroll-recording-dialog textarea { resize:vertical; min-height:80px; }
#payroll-recording-dialog select:disabled, #payroll-recording-dialog input:disabled { opacity:1; color:var(--mute,#70636a); -webkit-text-fill-color:var(--mute,#70636a); background:var(--cream,#f8f4ef); }
#payroll-recording-dialog .payroll-allocation { display:block; margin:0 0 14px; color:var(--mute,#70636a); font-size:12px; }
#payroll-recording-dialog [role="status"] { margin:0 0 18px; padding:10px 12px; border-left:3px solid var(--brand-plum,#74465f); border-radius:4px; background:var(--cream,#f8f4ef); color:var(--earth,#432d38); font-size:12px; line-height:1.55; overflow-wrap:anywhere; }
#payroll-recording-dialog .payroll-actions { display:flex; justify-content:flex-end; gap:12px; }
#payroll-recording-dialog button { width:auto; min-height:44px; margin:0; padding:10px 16px; border:1px solid var(--brand-plum,#74465f); border-radius:var(--r-sm,7px); font:650 14px/1.4 ui-sans-serif,system-ui,sans-serif; cursor:pointer; }
#payroll-recording-dialog [data-payroll-action="save"] { color:#fff; background:var(--brand-plum,#74465f); }
#payroll-recording-dialog [data-payroll-action="save"]:hover { background:var(--earth,#432d38); }
#payroll-recording-dialog [data-payroll-action="close"] { color:var(--brand-plum,#74465f); background:#fff; }
#payroll-recording-dialog button:disabled { opacity:.65; cursor:wait; }
#payroll-recording-dialog :focus-visible { outline:3px solid var(--brand-plum,#74465f); outline-offset:3px; }
@media(max-width:480px) {
 #payroll-recording-dialog { padding:18px; }
 #payroll-recording-dialog h3 { font-size:20px; margin-bottom:12px; }
 #payroll-recording-dialog .payroll-summary { grid-template-columns:minmax(0,1fr); gap:4px; padding:12px; margin-bottom:12px; }
 #payroll-recording-dialog label { margin-bottom:12px; }
 #payroll-recording-dialog textarea { height:80px; }
 #payroll-recording-dialog [role="status"] { margin-bottom:14px; }
 #payroll-recording-dialog .payroll-actions { flex-direction:column; gap:10px; }
 #payroll-recording-dialog .payroll-actions button { width:100%; }
}`;document.head.append(styles);
 const dialog=make('dialog');dialog.id='payroll-recording-dialog';dialog.setAttribute('aria-labelledby','payroll-recording-title');dialog.setAttribute('aria-describedby','payroll-recording-summary');
 const title=make('h3');title.id='payroll-recording-title';
 const description=make('div');description.id='payroll-recording-summary';description.className='payroll-summary';
 const activity=make('span'),workDate=make('span'),amount=make('span');activity.className='payroll-activity';workDate.className='payroll-work-date';amount.className='payroll-amount';description.append(activity,workDate,amount);
 const label=(text,input)=>{const l=make('label'),caption=make('span',text);l.htmlFor=input.id;caption.id=input.id+'-label';input.setAttribute('aria-labelledby',caption.id);l.append(caption,input);return l;};
 const date=make('input',null,'field');date.id='payroll-recording-date';date.type='date';date.required=true;
 const source=make('select',null,'field');source.id='payroll-recording-source';
 const allocationNote=make('small');allocationNote.id='payroll-recording-allocation';allocationNote.className='payroll-allocation';source.setAttribute('aria-describedby',allocationNote.id);
 const reason=make('textarea',null,'field');reason.id='payroll-recording-reason';reason.rows=3;
 const feedback=make('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.setAttribute('aria-atomic','true');
 const save=make('button','Simpan pencatatan','save'),close=make('button','Tutup','close');save.type=close.type='button';
 const actions=make('div');actions.className='payroll-actions';actions.append(close,save);
 dialog.append(title,description,label('Tanggal pembayaran',date),label('Sumber pembayaran',source),allocationNote,label('Catatan / alasan koreksi',reason),feedback,actions);document.body.append(dialog);
 close.onclick=()=>{if(!busy){dialog.close();pending=null;}};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 function open(id,status){if(!sessionAvailable()){note.textContent='Masuk memakai akun Google berizin untuk mencatat pembayaran.';document.getElementById('device-entry-signin')?.focus();return;}const wage=readWages().find(w=>String(w.id)===String(id));if(!wage){note.textContent='Baris upah belum tersedia; perbarui data.';return;}const recovery=readIntent();if(recovery&&String(recovery.input.id)!==String(id)){note.textContent='Ada pencatatan belum pasti untuk upah '+recovery.input.id+'. Buka baris tersebut untuk memeriksa konfirmasi; jangan membuat pembayaran ganda.';return;}pending=recovery?{id:String(id),status:recovery.input.status}:{id:String(id),status};status=pending.status;title.textContent=status==='lunas'?'Catat upah sudah dibayar':'Koreksi menjadi belum dibayar';activity.textContent=wage.aktivitas||'Upah';workDate.textContent='Tanggal kerja · '+String(wage.tgl);amount.textContent=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(wage.tarif*wage.qty);date.value=recovery?.input.paidDate||'';const allocation=wage.fund==='K4'?'pribadi':'wakif';source.replaceChildren();const option=make('option',allocation==='pribadi'?'Dana pribadi K4':'Kas wakif');option.value=allocation;source.append(option);source.value=allocation;source.disabled=true;allocationNote.textContent=allocation==='pribadi'?'Alokasi otomatis: dana pribadi K4, tidak masuk kas wakaf.':'Alokasi otomatis sesuai kebun: kas wakif.';date.disabled=status!=='lunas';reason.value=recovery?.input.reason||'';feedback.textContent='Pastikan pekerja benar-benar sudah menerima pembayaran sebelum menandai lunas. Koreksi tidak menghapus jejak sebelumnya.';dialog.showModal();}
 save.onclick=async()=>{if(busy||!pending)return;busy=true;save.disabled=true;close.disabled=true;feedback.textContent='Memeriksa izin dan menyimpan ke server…';try{await record({...pending,paidDate:date.value,source:source.value,reason:reason.value});note.textContent='Pencatatan dikonfirmasi server. Tidak ada transfer uang yang dijalankan.';feedback.textContent=note.textContent;pending=null;dialog.close();}catch(e){feedback.textContent='Belum dikonfirmasi: '+(e.message||'layanan belum tersedia')+'. Isian tetap dipertahankan; jangan membuat pencatatan baru untuk percobaan yang belum pasti.';}finally{busy=false;save.disabled=close.disabled=false;}};
 function decorate(){for(const old of document.querySelectorAll('#upah-tbody button[onclick]')){const code=old.getAttribute('onclick')||'';const match=code.match(/^(openPaidModalById|markUnpaid)\((.*)\)$/);if(!match)continue;const row=old.closest('tr'),id=row?.querySelector('.upah-check')?.dataset.id;if(!id)continue;const status=match[1]==='markUnpaid'?'belum':'lunas';const wage=readWages().find(w=>String(w.id)===id);if(status==='belum'&&!wage?.payroll_revision){const held=make('span','Riwayat pembayaran lama');held.title='Tidak diubah melalui pencatatan baru; perlu rekonsiliasi terpisah.';old.replaceWith(held);continue;}const b=make('button',status==='lunas'?'Catat dibayar':'Koreksi status',status==='lunas'?'paid':'unpaid');b.type='button';b.className=old.className;b.style.minHeight='44px';b.onclick=()=>open(id,status);old.replaceWith(b);}
 for(const b of document.querySelectorAll('button[onclick="batchPay()"]')){b.disabled=true;b.title='Catat pembayaran satu per satu melalui tombol Catat dibayar, agar konfirmasi setiap upah terpisah.';}}
 const observer=new MutationObserver(()=>decorate());observer.observe(document.getElementById('upah-tbody'),{childList:true,subtree:true});decorate();
 return {allowsAction:n=>owned.has(n)&&payrollActionAllowed(n),decorate};
}
