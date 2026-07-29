import { parseImport } from './io'

// Trip sharing without a server: the whole trip is deflate-compressed and
// base64url-encoded into the URL fragment (never sent to any host). Payloads
// carry a scheme prefix — "1." deflate-raw, "0." plain — so devices without
// CompressionStream can still produce and read links.
//
// QR: a payload that fits one code is encoded as the share URL itself, so any
// camera app opens it. Bigger trips become animated multi-part frames
// ("TQR:<id>:<i>:<n>:<chunk>") that Triplanner's built-in scanner reassembles
// — this makes QR sharing work for any trip size.

const b64uEncode = bytes => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const b64uDecode = s =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

const pipe = async (bytes, stream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())

export async function encodeTripShare(trip) {
  const bytes = new TextEncoder().encode(JSON.stringify({ app: 'triplanner', version: 1, trips: [trip] }))
  if (typeof CompressionStream === 'function') {
    return '1.' + b64uEncode(await pipe(bytes, new CompressionStream('deflate-raw')))
  }
  return '0.' + b64uEncode(bytes)
}

// Returns normalized trips (throws on anything malformed).
export async function decodeShare(payload) {
  const dot = payload.indexOf('.')
  if (dot < 0) throw new Error('not a Triplanner share')
  const scheme = payload.slice(0, dot)
  const data = b64uDecode(payload.slice(dot + 1))
  const bytes = scheme === '1' ? await pipe(data, new DecompressionStream('deflate-raw')) : data
  return parseImport(new TextDecoder().decode(bytes))
}

export const shareUrl = payload => `${location.origin}${location.pathname}#/share/${payload}`

// Fits comfortably in one phone-scannable QR (well under the 2953-byte cap).
const SINGLE_QR_LIMIT = 1200
const CHUNK = 800

const hashId = s => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36).slice(0, 6)
}

export function qrFrames(payload) {
  const url = shareUrl(payload)
  if (url.length <= SINGLE_QR_LIMIT) return [url]
  const id = hashId(payload)
  const chunks = []
  for (let i = 0; i < payload.length; i += CHUNK) chunks.push(payload.slice(i, i + CHUNK))
  return chunks.map((c, i) => `TQR:${id}:${i + 1}:${chunks.length}:${c}`)
}

const FRAME_RE = /^TQR:([a-z0-9]+):(\d+):(\d+):([A-Za-z0-9._-]+)$/
const URL_RE = /#\/share\/([A-Za-z0-9._-]+)$/

// Incremental collector for scanned QR texts. feed() returns
// { payload } when complete, { seen, total } while parts are missing,
// or null for QR content that isn't ours.
export function makeCollector() {
  let id = null
  let total = 0
  const parts = new Map()

  return function feed(text) {
    const asUrl = text.match(URL_RE)
    if (asUrl) return { payload: asUrl[1] }
    if (text.includes('.') && !text.startsWith('TQR:') && /^[01]\.[A-Za-z0-9_-]+$/.test(text)) {
      return { payload: text }
    }
    const m = text.match(FRAME_RE)
    if (!m) return null
    const [, frameId, index, count, chunk] = m
    if (frameId !== id) {
      // a different (or first) share — start over
      id = frameId
      total = Number(count)
      parts.clear()
    }
    parts.set(Number(index), chunk)
    if (parts.size === total) {
      const payload = Array.from({ length: total }, (_, i) => parts.get(i + 1)).join('')
      return { payload }
    }
    return { seen: parts.size, total }
  }
}
