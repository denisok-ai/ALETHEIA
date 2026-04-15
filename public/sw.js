/* Minimal service worker — no caching; silences 404 from browsers/extensions probing /sw.js */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
