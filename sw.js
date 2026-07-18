// Заедем.by — сервис-воркер PWA
// Стратегии:
//  • HTML (навигация) — СЕТЬ ПРЕЖДЕ ВСЕГО, кэш как офлайн-запаска.
//    Деплой новой версии сайта подхватывается сразу, ничего «залипшего».
//  • Статика (шрифты, CSS/JS с CDN, картинки) — stale-while-revalidate:
//    мгновенно из кэша + тихое обновление в фоне.
//  • API (api.zaedem.by) — ТОЛЬКО СЕТЬ: цены и брони кэшировать нельзя.
// Версию ниже НЕ нужно менять при деплое index__NN — HTML и так свежий из сети.
// Менять её стоит только при изменении самого sw.js.
const SW_VERSION = 'zaedem-v1';
const SHELL_CACHE = SW_VERSION + '-shell';
const RUNTIME_CACHE = SW_VERSION + '-runtime';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(SW_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST/PATCH и прочее — мимо кэша всегда

  const url = new URL(req.url);

  // API — только сеть (живые цены, брони, ИИ)
  if (url.hostname === 'api.zaedem.by') return;

  // Навигация (HTML): сеть → офлайн-запаска из кэша
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Статика своего домена и доверенных CDN — stale-while-revalidate
  const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com', 'cdnjs.cloudflare.com'];
  if (url.origin === self.location.origin || CDN.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => hit);
        return hit || fresh;
      })
    );
  }
  // Остальное (фото Островка и т.п.) — браузер сам, без вмешательства
});
