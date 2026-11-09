import { fileDelete, fileEntries, fileGet, filePut } from './idb'
import { supabase } from './supabase'
import { uid } from './uid'

/* Documents attached to a plan — boarding passes, tickets, confirmations.

   The file lives in IndexedDB under its own id, never in the trip JSON, so
   localStorage stays small and a plan only carries { id, name, type, size }.
   With an account it is also kept in the backend's storage (the private
   bucket `triplanner-documents`, see chapri-apps), at
   `<trip owner>/<trip id>/<document id>`, so every device that sees the trip
   — yours, and those of people it is shared with — can open it; a device
   that does not have it yet fetches it once and keeps it for offline.
   Share links and backups still carry the reference only. */

// 500 kB, as the storage bucket allows (which counts 512,000 bytes).
export const MAX_FILE_BYTES = 500 * 1000
export const DOCS_BUCKET = 'triplanner-documents'

// What a document may be — as the storage bucket accepts (see chapri-apps).
export const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(',')

// Photos the app can redraw smaller (a HEIC photo only where the browser
// can open it — Safari).
const SHRINKABLE = /^image\/(jpeg|png|webp|heic|heif)$/i

// Bigger than a document may be. `shrinkable` when it is a photo the app
// can offer to make smaller.
export class TooBigError extends Error {
  constructor(file) {
    super(`it is ${fmtBytes(file.size)} — documents can be up to ${fmtBytes(MAX_FILE_BYTES)}`)
    this.file = file
    this.shrinkable = SHRINKABLE.test(file.type)
  }
}

// What the storage bucket is told the file is; it accepts PDFs and images.
function typeOf(file) {
  if (file.type) return file.type
  if (/\.pdf$/i.test(file.name)) return 'application/pdf'
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  if (/\.png$/i.test(file.name)) return 'image/png'
  if (/\.webp$/i.test(file.name)) return 'image/webp'
  if (/\.gif$/i.test(file.name)) return 'image/gif'
  if (/\.hei[cf]$/i.test(file.name)) return `image/${file.name.slice(-4).toLowerCase()}`
  return ''
}

// Whether the account can keep it: within the limit, and a kind of file the
// bucket takes. Documents added before there were rules may be neither, and
// stay on the device they were added on.
export const canUpload = ref => ref.size <= MAX_FILE_BYTES && ACCEPTED_TYPES.includes(ref.type)

// Stores the file and returns the reference a plan keeps. Throws a
// TooBigError for a file over the limit, or when the browser refuses it.
export async function addFile(file) {
  const type = typeOf(file)
  if (!ACCEPTED_TYPES.includes(type))
    throw new Error('only PDFs and photos (JPEG, PNG, WebP, GIF, HEIC) can be attached')
  if (file.size > MAX_FILE_BYTES) throw new TooBigError(file)
  const ref = { id: uid(), name: file.name || 'Document', type, size: file.size }
  await filePut(ref.id, { blob: file, name: ref.name, type: ref.type, size: ref.size, addedAt: Date.now() })
  return ref
}

/* A smaller copy of a photo, as a JPEG under the limit: first the same
   size at a little less quality, then a step smaller each time, until it
   fits. Throws when the photo cannot be opened (a format this browser does
   not draw) or will not get small enough. */
export async function shrinkImage(file, limit = MAX_FILE_BYTES) {
  const image = await openImage(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser cannot redraw photos')
  // a ticket or pass stays readable at 2400 pixels on its long side
  let scale = Math.min(1, 2400 / Math.max(image.width, image.height))
  for (let round = 0; round < 8; round++) {
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    ctx.fillStyle = '#fff' // a transparent PNG gets a white ground, as JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.75, 0.65]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= limit) {
        const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
        return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
      }
    }
    scale *= 0.75
  }
  throw new Error('it could not be made small enough')
}

function openImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => openWithImg(file))
  }
  return openWithImg(file)
}

function openWithImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('this browser cannot open this kind of photo'))
    }
    img.src = url
  })
}

/* ---------- the account's copy ---------- */

// Where a trip's documents live in storage: under its owner, as the
// owner's account knows the trip. Null without a signed-in user.
export function documentsFolder(trip, userId) {
  if (!trip) return null
  if (trip.sharedFrom) return `${trip.sharedFrom.ownerId}/${trip.sharedFrom.tripId}`
  return userId ? `${userId}/${trip.id}` : null
}

async function signedInUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

/* The stored Blob: from this device, else from the account (and then kept
   here for offline). Null when neither has it — not added yet on the other
   device, or not signed in. */
export async function readFile(ref, trip) {
  const record = await fileGet(ref.id)
  if (record?.blob) return record.blob
  const folder = documentsFolder(trip, await signedInUserId())
  if (!folder) return null
  const { data: blob, error } = await supabase.storage.from(DOCS_BUCKET).download(`${folder}/${ref.id}`)
  if (error || !blob) return null
  await filePut(ref.id, {
    blob,
    name: ref.name,
    type: ref.type,
    size: ref.size,
    addedAt: Date.now(),
    uploaded: [folder],
  }).catch(() => {})
  return blob
}

// The account already holds it: an earlier upload, or another device's.
const alreadyThere = error =>
  String(error?.statusCode) === '409' || error?.status === 409 || /exists|duplicate/i.test(error?.message ?? '')

// The bucket turned this one file down (its kind or size); the others may
// still go. Anything else — offline, signed out, not active — stops the run.
const refused = error =>
  ['413', '415'].includes(String(error?.statusCode)) ||
  [413, 415].includes(error?.status) ||
  /mime|not supported|too large|maximum allowed size/i.test(error?.message ?? '')

let uploading = false

/* Puts every document on this device that a trip uses, and that the
   account does not have yet, into the account. Runs after each sync; a
   document over the limit (added before there was one) stays on this
   device only. Quietly stops at the first failure — offline, or the
   account is not active — and tries again after the next sync. */
export async function uploadFiles(trips, userId) {
  if (!supabase || !userId || uploading) return
  uploading = true
  try {
    for (const trip of trips) {
      const folder = documentsFolder(trip, userId)
      if (!folder) continue
      for (const ref of trip.days.flatMap(d => d.items.flatMap(i => i.attachments ?? []))) {
        const record = await fileGet(ref.id)
        if (!record?.blob || record.refused || (record.uploaded ?? []).includes(folder)) continue
        const type = record.type || ref.type
        if (!canUpload({ size: record.size ?? record.blob.size, type })) continue
        // The bytes, not the Blob: a Blob goes up as a form, and Safari sends
        // a Blob it read back from IndexedDB as a broken one (the bucket
        // answers 400). Bytes go as the body with the type said outright.
        const bytes = await record.blob.arrayBuffer()
        const { error } = await supabase.storage
          .from(DOCS_BUCKET)
          .upload(`${folder}/${ref.id}`, bytes, { contentType: type, upsert: false })
        if (error && !alreadyThere(error)) console.warn('[triplanner] document not uploaded:', ref.name, error.message)
        if (error && refused(error)) {
          // asked once; asking again after every sync would not change the answer
          await filePut(ref.id, { ...record, refused: true })
          continue
        }
        if (error && !alreadyThere(error)) return
        await filePut(ref.id, { ...record, uploaded: [...(record.uploaded ?? []), folder] })
      }
    }
  } catch {
    // offline or storage unavailable — the next sync tries again
  } finally {
    uploading = false
  }
}

/* ---------- housekeeping ---------- */

export const referencedFiles = trips =>
  new Set(trips.flatMap(t => t.days.flatMap(d => d.items.flatMap(i => (i.attachments ?? []).map(a => a.id)))))

/* Removes documents no plan points to any more from this device. A file is
   only removed once it is a day old: a form in another tab may hold a fresh
   one it has not saved yet, and an Undo can bring a deleted plan back. */
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
