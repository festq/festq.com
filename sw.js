// FestQ service worker — caches the app shell so it opens instantly / offline,
// but ALWAYS tries the network first for the main page so updates you push
// (new features, bug fixes) are picked up the next time there's internet,
// instead of an old cached version sticking around forever.
//
// Bump CACHE_NAME (e.g. 'festq-shell-v2') whenever you want to force every
// installed copy to drop its old cache after the next online load.
const CACHE_NAME = 'festq-shell-v1';
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never touch cross-origin requests — Firebase/Firestore, Google Fonts,
  // the QR image API, WhatsApp links, etc. must always go straight to the
  // network so live data and scoring are never served stale.
  if (url.origin !== location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/';

  if (isPage) {
    // Network-first: try fresh HTML, fall back to the cached shell if offline.
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE_NAME).then((c) => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest).
  e.respondWith(
    caches.match(req).then(
      (r) => r || fetch(req).then((res) => { caches.open(CACHE_NAME).then((c) => c.put(req, res.clone())); return res; })
    )
  );
});
