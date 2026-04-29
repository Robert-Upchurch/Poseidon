/* Poseidon Dashboard service worker (v3 — strict-fresh HTML)
   Strategy:
     - HTML / navigation requests: ALWAYS go to the network with
       cache: 'no-cache' so a fresh deploy is picked up immediately.
     - Static assets (svg/css/js/images/json): network-first with
       cache fallback for offline.
   On install we skipWaiting and on activate we delete every cache
   that doesn't match the current CACHE_NAME, so old precache from
   v1/v2 SWs gets evicted on first launch with this code.

   Bumping CACHE_NAME on every release invalidates ALL prior caches.
*/

const CACHE_NAME = 'poseidon-cache-v3';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

function isHtml(req) {
    if (req.mode === 'navigate') return true;
    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html')) return true;
    const url = new URL(req.url);
    return /\.html?$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;  // never intercept cross-origin

    // HTML / navigation: bypass HTTP cache entirely so deploys land instantly.
    if (isHtml(req)) {
        event.respondWith((async () => {
            try {
                return await fetch(req, { cache: 'no-cache' });
            } catch (_) {
                const cached = await caches.match(req);
                if (cached) return cached;
                return new Response('Offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
            }
        })());
        return;
    }

    // Static asset: network-first, cache fallback.
    event.respondWith((async () => {
        try {
            const fresh = await fetch(req);
            if (fresh && fresh.status === 200) {
                const copy = fresh.clone();
                caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
            }
            return fresh;
        } catch (_) {
            const cached = await caches.match(req);
            if (cached) return cached;
            return new Response('Offline and not cached.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
    })());
});

self.addEventListener('message', event => {
    if (event.data === 'CHECK_UPDATE') {
        self.registration.update().catch(() => {});
    }
    if (event.data === 'CLEAR_ALL_CACHES') {
        event.waitUntil((async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        })());
    }
});
