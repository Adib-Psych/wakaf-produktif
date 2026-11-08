// Isolated demo-project emulator runner. Never loads a production Firebase config.
'use strict';
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const scratch=process.env.TMPDIR||path.join(os.homedir(),'.hermes/cache/scratch');
fs.mkdirSync(scratch,{recursive:true});
const dir=fs.mkdtempSync(path.join(scratch,'wakaf-payroll-client-'));
const project='demo-payroll-client';
const rulesPath=path.join(dir,'firestore.production.rules');fs.copyFileSync(path.join(__dirname,'firestore.production.rules'),rulesPath);
const config={firestore:{rules:rulesPath},emulators:{firestore:{host:'127.0.0.1',port:8691,websocketPort:9151},ui:{enabled:false},hub:{host:'127.0.0.1',port:4491},logging:{host:'127.0.0.1',port:4591},singleProjectMode:true}};
fs.writeFileSync(path.join(dir,'firebase.json'),JSON.stringify(config));
const env={...process.env,CI:'true',XDG_CONFIG_HOME:dir,FIREBASE_CLI_DISABLE_UPDATE_CHECK:'true',GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,PAYROLL_TEST_RULES_PATH:rulesPath};
for(const key of Object.keys(env))if(/credential|token|api.?key|password|secret/i.test(key))delete env[key];
// node:test receives the existing fail-closed loopback network guard before loading SDKs.
const command=[process.execPath,'--require',path.join(root,'tests/rules-network.cjs'),'--test','--test-concurrency=1','--test-timeout=45000',...process.argv.slice(2),path.join(__dirname,'payroll-client.test.cjs')].map(x=>JSON.stringify(x)).join(' ');
let result;
try{
 result=spawnSync(process.execPath,[path.join(__dirname,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:exec','--config',path.join(dir,'firebase.json'),'--project',project,'--only','firestore',command],{cwd:dir,env,encoding:'utf8',maxBuffer:16*1024*1024,timeout:240000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 if(result.error)console.error(result.error);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
process.exit(result?.status??1);
