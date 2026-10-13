import { fileDelete, fileEntries, fileGet, filePut } from './idb'
import { uid } from './uid'

/* Documents attached to a plan — boarding passes, tickets, confirmations.

   The file itself lives in IndexedDB under its own id, never in the trip
   JSON, so localStorage stays small and a plan only carries
   { id, name, type, size }. Documents stay on this device: backups and share
   links carry the reference, not the file. */

export const MAX_FILE_BYTES = 25 * 1024 * 1024

// Stores the file and returns the reference a plan keeps. Throws when the
// file is too big or the browser refuses the write.
export async function addFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('files over 25 MB are too big to keep offline')
  const ref = { id: uid(), name: file.name || 'Document', type: file.type || '', size: file.size }
  await filePut(ref.id, { blob: file, name: ref.name, type: ref.type, size: ref.size, addedAt: Date.now() })
  return ref
}

// The stored Blob, or null when this device does not hold it.
export async function readFile(id) {
  const record = await fileGet(id)
  return record?.blob ?? null
}

export const referencedFiles = trips =>
  new Set(trips.flatMap(t => t.days.flatMap(d => d.items.flatMap(i => (i.attachments ?? []).map(a => a.id)))))

/* Removes documents no plan points to any more. A file is only removed once
   it is a day old: a form in another tab may hold a fresh one it has not
   saved yet, and an Undo can bring a deleted plan back. */
export async function collectUnusedFiles(trips, { minAge = 864e5 } = {}) {
  try {
    const used = referencedFiles(trips)
    const now = Date.now()
    const entries = await fileEntries()
    const unused = entries.filter(e => !used.has(e.id) && now - (e.addedAt ?? 0) > minAge)
    await Promise.all(unused.map(e => fileDelete(e.id)))
    return unused.length
  } catch {
    return 0
  }
}

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return ''
  const units = ['B', 'kB', 'MB', 'GB']
  let value = n
  let i = 0
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000
    i++
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}
