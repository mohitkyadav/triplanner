/* Loaded into the service worker (see workbox.importScripts in
   vite.config.js). Another app shares a booking or a backup to Triplanner:
   the manifest's share_target POSTs the files here. They wait in a cache
   until the app opens #/inbox and takes them (src/lib/inbox.js). */

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData()
        const files = form.getAll('file').filter(f => typeof f !== 'string')
        const cache = await caches.open('triplanner-inbox')
        await Promise.all(
          files.map((file, i) =>
            cache.put(
              `/inbox/${Date.now()}-${i}`,
              new Response(file, {
                headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) },
              }),
            ),
          ),
        )
      } catch {
        // nothing readable was shared — the app opens anyway
      }
      return Response.redirect('/#/inbox', 303)
    })(),
  )
})
