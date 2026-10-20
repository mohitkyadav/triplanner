import { sortDays } from './store'

/* Three-way merge of a trip that changed in two places (two people, or two
   devices) since the copy both last agreed on (`base`). Each side's changes
   are kept, down to the field:

   - a field changed on one side only takes that change;
   - days, plans and packing items are matched by id: one added on either side
     stays, one deleted on one side goes unless the other side edited it, and
     the same plan edited on both sides merges field by field;
   - travellers (a list of names) merge as a set;
   - the same field changed on both sides to different values: the side edited
     last wins.

   Only when there is no base (the trip was never synced from this device) does
   the whole trip from the side edited last win. */

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const ms = iso => Date.parse(iso) || 0

export function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined)
    const kb = Object.keys(b).filter(k => b[k] !== undefined)
    return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]))
  }
  return false
}

const isIdList = list => list.every(x => isObj(x) && typeof x.id === 'string')
const isStringList = list => list.every(x => typeof x === 'string')

function mergeValue(b, l, r, preferLocal) {
  if (deepEqual(l, r)) return l
  if (deepEqual(b, l)) return r
  if (deepEqual(b, r)) return l
  // Changed on both sides.
  if (Array.isArray(l) && Array.isArray(r)) {
    const base = Array.isArray(b) ? b : []
    if (isIdList(base) && isIdList(l) && isIdList(r)) return mergeIdList(base, l, r, preferLocal)
    if (isStringList(base) && isStringList(l) && isStringList(r)) return mergeSet(base, l, r)
    return preferLocal ? l : r
  }
  if (isObj(l) && isObj(r)) {
    const base = isObj(b) ? b : {}
    const out = {}
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const v = mergeValue(base[k], l[k], r[k], preferLocal)
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return preferLocal ? l : r
}

// Whether the ids both lists share come in the same order.
function sameOrder(a, b) {
  const inB = new Set(b.map(x => x.id))
  const inA = new Set(a.map(x => x.id))
  const sa = a.map(x => x.id).filter(id => inB.has(id))
  const sb = b.map(x => x.id).filter(id => inA.has(id))
  return sa.every((id, i) => id === sb[i])
}

function mergeIdList(b, l, r, preferLocal) {
  const byId = list => new Map(list.map(x => [x.id, x]))
  const B = byId(b)
  const L = byId(l)
  const R = byId(r)
  const kept = new Map()
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const inL = L.has(id)
    const inR = R.has(id)
    if (inL && inR) kept.set(id, mergeValue(B.get(id), L.get(id), R.get(id), preferLocal))
    // Only on one side: added there, or deleted on the other side — then it
    // stays only if this side edited it after all.
    else if (inL) {
      if (!B.has(id) || !deepEqual(B.get(id), L.get(id))) kept.set(id, L.get(id))
    } else if (!B.has(id) || !deepEqual(B.get(id), R.get(id))) kept.set(id, R.get(id))
  }

  // Order: the side that reordered, else the side edited last; what only the
  // other side has goes in after its neighbour there.
  const lMoved = !sameOrder(l, b)
  const rMoved = !sameOrder(r, b)
  const useLocal = lMoved === rMoved ? preferLocal : lMoved
  const [first, second] = useLocal ? [l, r] : [r, l]
  const order = first.map(x => x.id).filter(id => kept.has(id))
  let at = -1
  for (const { id } of second) {
    if (!kept.has(id)) continue
    const i = order.indexOf(id)
    if (i >= 0) at = i
    else order.splice(++at, 0, id)
  }
  return order.map(id => kept.get(id))
}

// A list of names: added on either side stays, removed on either side goes.
function mergeSet(b, l, r) {
  const B = new Set(b)
  const L = new Set(l)
  const R = new Set(r)
  const out = l.filter(x => R.has(x) || !B.has(x))
  for (const x of r) if (!L.has(x) && !B.has(x)) out.push(x)
  return out
}

export function mergeTrip(base, local, remote) {
  const preferLocal = ms(local.updatedAt) >= ms(remote.updatedAt)
  if (!base) return preferLocal ? local : remote
  const merged = mergeValue(base, local, remote, preferLocal)
  // A plan moved to another day on one side and edited where it was on the
  // other ends up in both days: keep the first.
  const seen = new Set()
  const days = (merged.days ?? []).map(d => ({
    ...d,
    items: (d.items ?? []).filter(i => !seen.has(i.id) && seen.add(i.id)),
  }))
  // Newer than both sides, so this copy is the one that goes everywhere.
  return { ...merged, days: sortDays(days), updatedAt: new Date().toISOString() }
}
