'use strict';

const CACHE_NAME = 'mms-store-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './manifest.webmanifest',
  './IMG/favicon.png',
  './IMG/store-logo-nav.png',
  './IMG/login-logo-2.png',
  './IMG/b3.png',
  './JS/firebase.js',
  './JS/app.js',
  './JS/navbar.js'
];

// Install - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - serve from cache, fallback to network, save new resources
self.addEventListener('fetch', event => {
  // Core app shell from cache
  if (event.request.destination === 'document') {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
    return;
  }

  // Runtime caching: Firebase API/images (stale-while-revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return fetch(event.request)
        .then(response => {
          // Cache successful responses
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => {
          // Offline fallback for images
          if (event.request.destination === 'image') {
            return caches.match('./IMG/favicon.png');
          }
        });
    })
  );
});

// Push notifications (future)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: './IMG/favicon.png',
    badge: './IMG/favicon.png'
  };
  event.waitUntil(
    self.registration.showNotification('My Store', options)
  );
});
