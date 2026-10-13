/* Files that reach the app from outside it:

     share target   another app shares a file to Triplanner (Android). The
                    service worker (public/share-target-sw.js) catches the
                    POST, keeps the files in a cache, and opens #/inbox.
     file handlers  a .ics or .json file opened with the installed app
                    (desktop), delivered through window.launchQueue.

   Both end as { name, type, text } for the Inbox screen. A booking picked
   for a trip waits here until that trip's page takes it. */

export const INBOX_CACHE = 'triplanner-inbox'

export async function takeSharedFiles() {
  if (typeof caches === 'undefined') return []
  try {
    const cache = await caches.open(INBOX_CACHE)
    const out = []
    for (const req of await cache.keys()) {
      const res = await cache.match(req)
      await cache.delete(req)
      if (!res) continue
      out.push({
        name: decodeURIComponent(res.headers.get('x-file-name') ?? 'file'),
        type: res.headers.get('content-type') ?? '',
        text: await res.text(),
      })
    }
    return out
  } catch {
    return []
  }
}

export function onLaunchFiles(fn) {
  if (typeof window === 'undefined' || !window.launchQueue) return
  window.launchQueue.setConsumer(async params => {
    try {
      const files = await Promise.all(
        (params.files ?? []).map(async handle => {
          const f = await handle.getFile()
          return { name: f.name, type: f.type, text: await f.text() }
        }),
      )
      if (files.length) fn(files)
    } catch {
      // the file could not be read — nothing to show
    }
  })
}

export const isBookingFile = f => /\.ics$/i.test(f.name) || /calendar/i.test(f.type) || /^BEGIN:VCALENDAR/m.test(f.text)

/* ---------- a booking waiting for its trip ---------- */

let pending = null // { tripId, text }

export const setPendingBooking = (tripId, text) => {
  pending = { tripId, text }
}

export function takePendingBooking(tripId) {
  if (pending?.tripId !== tripId) return null
  const { text } = pending
  pending = null
  return text
}
