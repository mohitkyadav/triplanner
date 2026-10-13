/* The app's IndexedDB database, shared by the backup copy (`kv`) and the
   documents attached to plans (`files`). Every helper fails softly: private
   windows can refuse IndexedDB completely. */

const DB_NAME = 'triplanner'
const KV = 'kv'
const FILES = 'files'

let dbPromise = null

function db() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('no IndexedDB'))
      return
    }
    // Version 2 added the documents store; version 1 databases keep their copy.
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV)
      if (!d.objectStoreNames.contains(FILES)) d.createObjectStore(FILES)
    }
    req.onsuccess = () => {
      // Another tab with a newer version asks to upgrade: step aside.
      req.result.onversionchange = () => {
        req.result.close()
        dbPromise = null
      }
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB is blocked'))
  }).catch(err => {
    dbPromise = null // let a later call try again
    throw err
  })
  return dbPromise
}

const run = (store, mode, fn) =>
  db().then(
    d =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode)
        const req = fn(t.objectStore(store))
        t.oncomplete = () => resolve(req?.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )

export const kvGet = key => run(KV, 'readonly', s => s.get(key)).catch(() => null)
export const kvSet = (key, value) =>
  run(KV, 'readwrite', s => s.put(value, key))
    .then(() => true)
    .catch(() => false)
export const kvDelete = key =>
  run(KV, 'readwrite', s => s.delete(key))
    .then(() => true)
    .catch(() => false)

// Documents: { blob, name, type, size, addedAt } under their attachment id.
export const fileGet = id => run(FILES, 'readonly', s => s.get(id)).catch(() => null)
export const filePut = (id, record) => run(FILES, 'readwrite', s => s.put(record, id))
export const fileDelete = id =>
  run(FILES, 'readwrite', s => s.delete(id))
    .then(() => true)
    .catch(() => false)
export const fileEntries = () =>
  db().then(
    d =>
      new Promise((resolve, reject) => {
        const out = []
        const t = d.transaction(FILES, 'readonly')
        const req = t.objectStore(FILES).openCursor()
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) return
          out.push({ id: cursor.key, addedAt: cursor.value?.addedAt })
          cursor.continue()
        }
        t.oncomplete = () => resolve(out)
        t.onerror = () => reject(t.error)
      }),
  )
