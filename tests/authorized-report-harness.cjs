'use strict';
// Execute actual ESM source in a VM; only SDK/Auth/storage are synthetic.
// Not server Rules / browser acceptance; those have separate emulator evidence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function fixture(role='worker',patch={}){
 const common={id:'lap_synthetic_1',created_at:'2000-01-02T00:00:00Z',compliance:'pending',schema_version:role==='staff'?'3.5':'1.1',pelapor:'SYNTHETIC',tanggal:'2000-01-02',kategori:'lain',durasi:null};
 const b=role==='staff'?{...common,tgl:common.tanggal,bidang:'1',kebun_list:['K1'],kebun_primary:'K1',kebun_list_str:'K1',pohon:0,detail:'original',detail_form:null,rainfall_24h:0,rainfall_7d:0,alerts:[{b:2,a:1},{label:'second'}],src:'wakif_form'}:{...common,pelapor_name:'Synthetic worker',kebun:['K1'],kebun_primary:'K1',kebun_list_str:'K1',blok:null,cuaca_pagi:null,cuaca_siang:null,rain_24h_mm:0,rain_7d_mm:0,weather_source:'worker_override',weather_coords:'0,0',weather_lokasi:'kebun',topik_v2:null,jumlah_pekerja:1,jumlah_pohon:0,detail:{deskripsi_kerja:'original'},catatan:'original',voice_notes:[],photos:[{id:'a',data_url:'a',size_kb:1},{id:'b',data_url:'b',size_kb:1}],gps_coords:null,gps_jarak_km:null,gps_di_kebun:null,device_id:'synthetic',_filled_by:{}};
 return {...b,...patch};
}
function harness({role='worker',existing=null,lost=false,failRead=false,onWrite}={}){
 const store=new Map(),storage=new Map();let commits=0,writes=0,reads=0;const uid='synthetic-'+role;
 const p={paused:false,writer_epoch:7},g={uid,enabled:true,role,worker_token:'SYNTHETIC',writer_epoch:7,grant_epoch:2};
 class Timestamp{constructor(){this.seconds=1;this.nanoseconds=0;}}
 const snap=ref=>{reads++;if(failRead)throw Error('synthetic read failure');const value=ref.path==='entry_policy/active'?p:ref.path==='entry_grants/'+uid?g:store.get(ref.path);return {exists:()=>value!==undefined,data:()=>value};};
 const c={JSON,Date,Number,Set,Map,Error,Timestamp,navigator:{locks:{request:async(_key,fn)=>fn()}},doc:(_db,...parts)=>({path:parts.join('/')}),getDocFromServer:async r=>snap(r),serverTimestamp:()=>new Timestamp(),getAuth:()=>({currentUser:{uid}}),onAuthStateChanged:(_a,fn)=>fn({uid}),signOut:async()=>{},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},runTransaction:async(_db,fn)=>{const staged=[];const value=await fn({get:async r=>snap(r),set:(r,v)=>staged.push([r.path,v])});if(staged.length){for(const [k,v] of staged){store.set(k,v);writes++;}commits++;if(onWrite)await onWrite({id:staged[0][0].split('/').at(-1)},staged[0][1]);if(lost){lost=false;throw Error('synthetic lost ACK');}}return value;}};
 c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/recovery/report-content.js','utf8'),c);
 const source=fs.readFileSync(root+'/recovery/authorized-reports.js','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');vm.runInContext(source+';globalThis.transport=createAuthorizedReports({app:{},db:{}});',c);
 function seed(body){const row={contract_version:1,report_id:body.id,command_id:body.id,writer_epoch:7,grant_epoch:2,submitted_body:body,owner_uid:uid,committed_revision:1,committed_at:new Timestamp()};store.set('laporan/'+body.id,row);store.set('entry_receipts/'+body.id,{...row});}
 if(existing)seed(existing);
 return {send:b=>c.transport.send(b),seed,store,context:c,storage,get writes(){return writes;},get commits(){return commits;},get reads(){return reads;},record:id=>store.get('laporan/'+id)?.submitted_body,pair:id=>[store.get('laporan/'+id),store.get('entry_receipts/'+id)]};
}
module.exports={fixture,harness};
