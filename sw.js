// 편한 PDF 리더 - 오프라인 캐시 + 안드로이드 "공유하기"로 PDF 받기
const CACHE = 'pdf-reader-v1';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  PDFJS + 'build/pdf.min.js', PDFJS + 'build/pdf.worker.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'share-inbox').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 다른 앱에서 "공유 → PDF 리더"로 보낸 파일 받기 (안드로이드, 설치된 앱)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const f = fd.get('pdf');
        if (f) {
          const c = await caches.open('share-inbox');
          await c.put('shared-pdf', new Response(f, { headers: { 'Content-Type': 'application/pdf', 'X-Name': encodeURIComponent(f.name || 'shared.pdf') } }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  const same = url.origin === self.location.origin;
  const cdn = url.hostname === 'cdn.jsdelivr.net';
  if (!same && !cdn) return;
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: same });
    if (hit) {
      // 앱 파일은 뒤에서 조용히 최신으로 갱신
      if (same) fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r)); }).catch(() => {});
      return hit;
    }
    try {
      const r = await fetch(e.request);
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    } catch (err) {
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
