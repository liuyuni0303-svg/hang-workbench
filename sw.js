/* 杭 · 个人工作台 Service Worker —— 应用壳离线缓存 + 即时更新 */
const CACHE = 'hang-app-v11';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/store.js',
  './js/ui.js',
  './js/charts.js',
  './js/mod-weight.js',
  './js/mod-baking.js',
  './js/mod-sport.js',
  './js/mod-headache.js',
  './js/mod-custom.js',
  './js/mod-ledger.js',
  './js/mod-todo.js',
  './js/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase 等跨域请求直连网络，不缓存

  const isAsset = /\.(js|css|html?)$/.test(url.pathname) || req.mode === 'navigate';
  if (isAsset) {
    // 网络优先：保证每次都拿到最新代码；离线或失败时回退缓存（兜底 index.html）
    e.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
        return resp;
      }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }
  // 图标等静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      if (r && r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
      return r;
    }).catch(() => cached))
  );
});
