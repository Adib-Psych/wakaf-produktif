const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.DATE_WAKIF_SOURCE||path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'recovery',name),'utf8');
test('operational log uses original Indonesian date formatter without wrapping',()=>{
 const source=read('operational-dashboard.js'),start=source.indexOf(' function paintLog()'),end=source.indexOf(' function paintDashboard()',start);
 const body={children:[],replaceChildren(){this.children=[];},append(n){this.children.push(n);}};
 const el=(tag,text)=>({tag,text,children:[],dataset:{},append(n){this.children.push(n);}});
 const context={mode:'operational',original:{},document:{getElementById:()=>body},el,filtered:x=>x,snapshot:{rows:[{id:'op_synthetic',date:'2026-10-26',lane:'device_reports',gardens:['K3'],category:'lain'}]},reportStatus:()=>'',window:{formatTgl:d=>{assert.equal(d,'2026-10-26');return 'Sen, 26 Okt 2026';}}};
 vm.runInNewContext(source.slice(start,end)+';paintLog();',context);
 assert.equal(body.children[0].children[0].text,'Sen, 26 Okt 2026');
 assert.match(source,/#log-tbody td:first-child\{white-space:nowrap\}/);
});
test('default restored route provides full public wages without a privileged reader redirect',()=>{
 const source=read('restored-dashboard.js'),route=source.slice(source.indexOf('export async function mountRestoredDashboard'));
 assert.match(route,/mountPublicDashboard\(config\)/);assert.doesNotMatch(route,/link.href=.*reader=owner/);
});
test('owner wage destination opens actual anggaran panel without granting read authority',async()=>{
 let clicks=0,refreshes=0;const host={append(){}},source=read('owner-session.js').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
 const document={body:{dataset:{}},createElement:()=>({...host}),querySelector:s=>s==='.content-wrap'?{prepend(){}}:s==='.sb-tab[data-panel="anggaran"]'?{click(){clicks++;}}:null};
 const context={document,window:{addEventListener(){}},location:{hash:'#anggaran'},getApps:()=>[],initializeApp:()=>({}),getFirestore:()=>({}),createAuthorizedReports:()=>({}),mountReportSessionControls(){},createPrivateReader:()=>({allowed:()=>false,refresh(){refreshes++;}}),mountPrivateDashboard:async()=>({refresh(){refreshes++;}})};
 const fn=vm.runInNewContext(source+';mountOwnerSession;',context);await fn({});assert.equal(clicks,1);assert.equal(refreshes,0,'fragment must not grant permissions or trigger data read');
});
