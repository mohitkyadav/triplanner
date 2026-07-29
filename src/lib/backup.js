import { exportPayload } from './io'

/* Storage durability.

   localStorage on its own is not safe enough for a trip plan: the write can
   fail when the quota is full, and browsers clear the storage of a page the
   user did not install (iOS Safari after 7 days without a visit). The app
   therefore keeps three defences, from the weakest to the strongest:

     1. navigator.storage.persist() — asks the browser to keep this origin.
     2. An IndexedDB copy after every change. It survives a failed or a
        damaged localStorage write, and the app restores from it when
        localStorage comes back empty.
     3. A backup file that the app rewrites itself through the File System
        Access API. This is the only copy that outlives the browser profile.

   Safari has no File System Access API, so there the card asks the user to
   install the app and to export a file by hand. Every function fails softly:
   private windows can refuse IndexedDB completely. */

const DB_NAME = 'triplanner'
const STORE = 'kv'
const K_SNAPSHOT = 'snapshot'
const K_HANDLE = 'backupFile'
const K_META = 'meta'

// The mirror follows a change closely; the file write waits for a pause, so a
// drag or a burst of edits does not rewrite the file many times.
const MIRROR_DELAY = 1200
const FILE_DELAY = 5000

/* ---------- IndexedDB key/value helpers ---------- */

let dbPromise = null

function db() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('no IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB is blocked'))
  }).catch(err => {
    dbPromise = null // let a later call try again
    throw err
  })
  return dbPromise
}

const run = (mode, fn) =>
  db().then(
    d =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        t.oncomplete = () => resolve(req?.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )

const kvGet = key => run('readonly', s => s.get(key)).catch(() => null)
const kvSet = (key, value) =>
  run('readwrite', s => s.put(value, key))
    .then(() => true)
    .catch(() => false)
const kvDelete = key =>
  run('readwrite', s => s.delete(key))
    .then(() => true)
    .catch(() => false)

/* ---------- state the backup card shows ---------- */

const info = {
  mirroredAt: null, // last IndexedDB copy
  mirroredTrips: 0,
  fileName: null, // name of the automatic backup file, null when off
  fileWrittenAt: null,
  fileBlocked: false, // the file needs permission again
  exportedAt: null, // last file the user exported by hand
  persisted: null, // true | false | null (browser does not tell)
  usage: null,
  quota: null,
}

const listeners = new Set()
const emit = () => listeners.forEach(fn => fn(info))

export const backupInfo = () => info

export function subscribeBackup(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function patchMeta(patch) {
  const meta = (await kvGet(K_META)) ?? {}
  await kvSet(K_META, { ...meta, ...patch })
}

/* ---------- browser storage protection ---------- */

export async function isPersisted() {
  try {
    return (await navigator.storage?.persisted?.()) ?? null
  } catch {
    return null
  }
}

export async function storageEstimate() {
  try {
    return (await navigator.storage?.estimate?.()) ?? null
  } catch {
    return null
  }
}

// Safe to call at every start: the browser answers from its own rules and
// only Firefox shows a prompt.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null
    const ok = (await navigator.storage.persisted()) || (await navigator.storage.persist())
    info.persisted = ok
    emit()
    return ok
  } catch {
    return null
  }
}

/* ---------- the automatic backup file ---------- */

export const supportsBackupFile = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'

async function isWritable(handle, request = false) {
  try {
    if (!handle?.queryPermission) return true
    const opts = { mode: 'readwrite' }
    if ((await handle.queryPermission(opts)) === 'granted') return true
    if (!request) return false
    return (await handle.requestPermission(opts)) === 'granted'
  } catch {
    return false
  }
}

// Must run from a tap: the file picker needs a user gesture. Writes the file
// at once, so the user sees the result immediately.
export async function chooseBackupFile(trips, suggestedName = 'triplanner-backup.json') {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'Triplanner backup', accept: { 'application/json': ['.json'] } }],
  })
  // Without a kept handle the app cannot write the file again after a reload,
  // so it must not report that the automatic backup is on.
  if (!(await kvSet(K_HANDLE, handle))) {
    info.fileName = null
    emit()
    return false
  }
  info.fileName = handle.name
  info.fileBlocked = false
  emit()
  return writeBackupFile(trips)
}

export async function forgetBackupFile() {
  await kvDelete(K_HANDLE)
  await patchMeta({ fileWrittenAt: null })
  info.fileName = null
  info.fileWrittenAt = null
  info.fileBlocked = false
  emit()
}

// Returns false when there is no file, or when the permission is gone. Pass
// request: true from a tap to ask for the permission again.
export async function writeBackupFile(trips, { request = false } = {}) {
  const handle = await kvGet(K_HANDLE)
  if (!handle) return false
  info.fileName = handle.name
  if (!(await isWritable(handle, request))) {
    info.fileBlocked = true
    emit()
    return false
  }
  try {
    const file = await handle.createWritable()
    await file.write(JSON.stringify(exportPayload(trips), null, 2))
    await file.close()
  } catch {
    info.fileBlocked = true
    emit()
    return false
  }
  info.fileBlocked = false
  info.fileWrittenAt = new Date().toISOString()
  await patchMeta({ fileWrittenAt: info.fileWrittenAt })
  emit()
  return true
}

/* ---------- the IndexedDB copy ---------- */

export async function writeMirror(trips) {
  const savedAt = new Date().toISOString()
  if (!(await kvSet(K_SNAPSHOT, { ...exportPayload(trips), savedAt }))) return false
  info.mirroredAt = savedAt
  info.mirroredTrips = trips.length
  emit()
  return true
}

// { app, version, savedAt, trips } or null.
export const readMirror = () => kvGet(K_SNAPSHOT)

export async function markExported() {
  info.exportedAt = new Date().toISOString()
  await patchMeta({ exportedAt: info.exportedAt })
  emit()
}

/* ---------- scheduling ---------- */

let mirrorTimer = null
let fileTimer = null
let pending = null
let wired = false

function wire() {
  if (wired || typeof window === 'undefined') return
  wired = true
  // A backgrounded tab can be discarded, so write before it goes away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBackup()
  })
  window.addEventListener('pagehide', flushBackup)
}

export function scheduleBackup(trips) {
  wire()
  pending = trips
  clearTimeout(mirrorTimer)
  clearTimeout(fileTimer)
  mirrorTimer = setTimeout(() => writeMirror(pending), MIRROR_DELAY)
  fileTimer = setTimeout(() => writeBackupFile(pending), FILE_DELAY)
}

export function flushBackup() {
  if (!pending) return
  clearTimeout(mirrorTimer)
  clearTimeout(fileTimer)
  writeMirror(pending)
  writeBackupFile(pending)
}

// Reads everything the backup card shows. Call it when the card appears.
export async function loadBackupInfo() {
  const [meta, handle, snapshot] = await Promise.all([kvGet(K_META), kvGet(K_HANDLE), kvGet(K_SNAPSHOT)])
  info.exportedAt = meta?.exportedAt ?? null
  info.fileWrittenAt = meta?.fileWrittenAt ?? null
  info.fileName = handle?.name ?? null
  info.fileBlocked = handle ? !(await isWritable(handle)) : false
  info.mirroredAt = snapshot?.savedAt ?? null
  info.mirroredTrips = snapshot?.trips?.length ?? 0
  info.persisted = await isPersisted()
  const estimate = await storageEstimate()
  info.usage = estimate?.usage ?? null
  info.quota = estimate?.quota ?? null
  emit()
  return info
}
