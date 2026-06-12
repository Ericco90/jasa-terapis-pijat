const CACHE_NAME = 'jasa-massage-v2';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/dashboard.css',
  './js/api.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Safe caching so if 1 file fails, it doesn't break PWA installation
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => console.log('SW Cache Error on:', url));
          })
        );
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Return cached asset
        }
        return fetch(event.request); // Fallback to network
      })
  );
});
