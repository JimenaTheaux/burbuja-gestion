// Cargado por el service worker generado (workbox.importScripts en vite.config.ts).
// Al activarse una versión nueva, borra caches de runtime que ya no se usan:
// - supabase-api-cache: StaleWhileRevalidate viejo, servía datos desactualizados.
// - supabase-auth-cache: respuestas de auth que nunca debieron cachearse.
// - api-cache: regla de /api/ eliminada (la app ya no tiene /api).
const CACHES_OBSOLETOS = ['supabase-api-cache', 'supabase-auth-cache', 'api-cache']

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(CACHES_OBSOLETOS.map((nombre) => caches.delete(nombre))))
})
