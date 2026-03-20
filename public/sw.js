const CACHE = 'chip-golf-v1';
const PRECACHE = ['/', '/game/new'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Supabase APIはキャッシュしない（リアルタイム通信）
  if (url.hostname.includes('supabase.co')) return;

  // GETリクエストのみキャッシュ対象
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 正常レスポンスをキャッシュに保存
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
