const CACHE = 'chip-golf-v2';
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

  // 他オリジン（Firestore / Firebase Storage / Google Fonts など）には一切介入しない。
  // Firestore の Listen は長時間つながり続ける GET ストリームで、Service Worker が fetch で中継して
  // キャッシュに書こうとすると応答が遅れたり止まったりする（履歴の読み込み中が終わらない原因）
  if (url.origin !== self.location.origin) return;

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
