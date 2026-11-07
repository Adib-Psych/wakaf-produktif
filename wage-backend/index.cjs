'use strict';
const {initializeApp,getApps}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {processCreated}=require('./processor.cjs');
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp();
const db=getFirestore(app);
const region=process.env.FUNCTION_REGION||'asia-southeast2';
function handler(collection,lane){
 return onDocumentCreated({document:collection+'/{reportId}',region,retry:true},event=>processCreated(db,lane,event.params.reportId));
}
exports.wagesDeviceReportCreated=handler('device_reports','device_reports');
exports.wagesDeviceReceiptCreated=handler('device_receipts','device_reports');
exports.wagesReportCreated=handler('laporan','laporan');
exports.wagesEntryReceiptCreated=handler('entry_receipts','laporan');
