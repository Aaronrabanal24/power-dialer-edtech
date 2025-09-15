// ultra-minimal SW: cache-bust on new deploys
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

// Optional offline shell (add files to precache if you want)
self.addEventListener("fetch", (event) => {
  // default: pass-through network; customize if you want offline caching
});