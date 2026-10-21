'use strict';
// Candidate only. Registration is an unapplied lapor.html proposal.
// Increment version on approved entry-shell release. Update waits for old tabs.
const CACHE_PREFIX='wkkn-worker-';
const CACHE_NAME=CACHE_PREFIX+'v1';
const ROOT=new URL('./',self.location.href);
const ASSETS=['lapor.html','worker-manifest.json','firebase-config.js','images/logo-wakaf-produktif-transparan.png'].map(p=>new URL(p,ROOT).href);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)));
 // No skipWaiting: never force an unsaved/in-flight client into a new shell.
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))));
 // No clients.claim: reload/close existing tabs only after pending queue checkpoint.
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==ROOT.origin)return;
 const canonical=new URL(url.pathname,ROOT).href;
 if(!ASSETS.includes(canonical))return; // Never cache dashboard, APIs, photos or private responses.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  try{
   const response=await fetch(event.request);
   if(response.ok&&response.type!=='opaque'&&!response.redirected)await cache.put(canonical,response.clone());
   return response;
  }catch(error){const stored=await cache.match(canonical);if(stored)return stored;throw error;}
 })());
});
