// Rose&Bloom service worker: makes the app installable and shows the last loaded app shell when offline.
// Only page navigations are handled (network first). Data requests to Supabase are never touched.
const CACHE = 'rnb-shell-v1'
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => {}))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put('/', copy))
        return r
      })
      .catch(() => caches.match('/'))
  )
})
