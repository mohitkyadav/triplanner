import { useEffect, useRef, useSyncExternalStore } from 'react'
import { migrate, useStore } from './store'
import { supabase } from './supabase'
import { mergeTrip } from './tripMerge'

/* Sync with the chapri-apps account. The device stays the source of truth and
   works offline; when signed in, each trip is copied to the account and the
   account's trips come back to every device.

   A trip is one row, owned by whoever made it; people it is shared with
   (lib/shares.js) read and edit that same row. Which copy wins is decided per
   trip, from its updatedAt and the version both sides last agreed on (`known`):
   - changed on one side only → that side wins;
   - changed on both → both sides' changes are merged (lib/tripMerge.js) with
     the copy last agreed on (`bases`), or, without one, the newer edit wins.
   A deleted trip leaves a tombstone, so the delete reaches the other devices
   instead of the trip coming back from them.

   A trip shared with you lives here under its own key (`<id>~<owner>`), so it
   never clashes with one of your own, and carries `sharedFrom`. Only its owner
   can delete it; you can leave it. */

export const syncEnabled = Boolean(supabase)

const META = 'triplanner:sync'
// The copy of each trip both sides last agreed on, for merging.
const BASES = 'triplanner:sync-bases'
const TABLE = 'triplanner_trips'
export const SHARES = 'triplanner_trip_shares'
// A burst of edits (typing, a drag) uploads once.
const SYNC_DELAY = 2000
// While the app is open and visible, edits from other devices arrive this often.
const POLL_EVERY = 5 * 60 * 1000

const ms = iso => Date.parse(iso) || 0
const stamp = t => new Date(t).toISOString()
const isTrip = d => d && typeof d === 'object' && typeof d.id === 'string' && Array.isArray(d.days)

/* ---------- what both sides last agreed on ---------- */

export function readMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META))
    if (m && typeof m === 'object') return { userId: m.userId ?? null, known: m.known ?? {}, deleted: m.deleted ?? {} }
  } catch {
    // damaged — start over; the next sync compares everything again
  }
  return { userId: null, known: {}, deleted: {} }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(META, JSON.stringify(meta))
  } catch {
    // storage full — the next sync recomputes
  }
}

function readBases() {
  try {
    const b = JSON.parse(localStorage.getItem(BASES))
    return b && typeof b === 'object' ? b : {}
  } catch {
    return {}
  }
}

function writeBases(bases) {
  try {
    localStorage.setItem(BASES, JSON.stringify(bases))
  } catch {
    // storage full — merging falls back to "the newer edit wins"
  }
}

// Records what both sides now agree on; null forgets a trip.
function updateBases(changes) {
  const keys = Object.keys(changes)
  if (!keys.length) return
  const bases = readBases()
  for (const key of keys) {
    if (changes[key]) bases[key] = changes[key]
    else delete bases[key]
  }
  writeBases(bases)
}

/* ---------- account rows ↔ trips here ---------- */

// A row of the account as this device sees it: its key here, whose it is, and
// the trip in local form (a shared one under its own key, with `sharedFrom`).
export function toLocalRow(row, me, ownerEmails = new Map()) {
  const own = row.user_id === me
  const key = own ? row.id : `${row.id}~${row.user_id}`
  let trip = row.data
  if (!own && isTrip(trip)) {
    trip = {
      ...trip,
      id: key,
      sharedFrom: { ownerId: row.user_id, tripId: row.id, ownerEmail: ownerEmails.get(key) ?? '', viewerId: me },
    }
  }
  return { key, owner: row.user_id, shared: !own, trip, updated_at: row.updated_at, deleted: row.deleted }
}

// The trip as it is stored in the account (a shared one under its owner's id).
export function toRemoteTrip(trip) {
  if (!trip?.sharedFrom) return trip
  const { sharedFrom, ...rest } = trip
  return { ...rest, id: sharedFrom.tripId }
}

/* ---------- the plan ---------- */

// `trips`: this device. `rows`: the account, from toLocalRow. `bases`: the
// copies last agreed on. Returns what to change on each side; `pushed` (and
// its base) is recorded only once the upload went through.
export function planSync(trips, rows, { known, deleted }, bases = {}) {
  const local = new Map(trips.map(t => [t.id, t]))
  const remote = new Map(rows.map(r => [r.key, r]))
  const out = {
    pull: [],
    remove: [],
    push: [],
    pushed: {},
    known: { ...known },
    deleted: { ...deleted },
    bases: {}, // agreed now (from the account); null forgets
  }

  for (const key of new Set([...local.keys(), ...remote.keys(), ...Object.keys(deleted)])) {
    const L = local.get(key)
    const R = remote.get(key)
    const shared = R ? R.shared : Boolean(L?.sharedFrom)
    const agreed = known[key]
    const lt = L ? ms(L.updatedAt) : 0
    const rt = R ? ms(R.updated_at) : 0

    const push = (trip, t) => {
      out.push.push({ key, owner: R?.owner ?? null, shared, trip, updated_at: stamp(t), deleted: false })
      out.pushed[key] = t
    }
    const take = () => {
      if (!isTrip(R.trip)) return // nothing usable in the account — leave both alone
      out.pull.push(R.trip)
      out.known[key] = rt
      out.bases[key] = R.trip
    }
    const drop = () => {
      out.remove.push(key)
      if (R) out.known[key] = rt
      out.bases[key] = null
    }

    if (L) {
      delete out.deleted[key] // here after all (an Undo)
      if (!R) {
        // Shared with you no longer (removed, or you left): it goes.
        if (shared) drop()
        else push(L, lt)
      } else if (R.deleted) {
        // Your trip, edited here after it was deleted elsewhere: the edit
        // brings it back. A shared trip deleted by its owner just goes.
        if (!shared && lt !== agreed && lt > rt) push(L, lt)
        else drop()
      } else if (lt === rt) {
        out.known[key] = rt
        if (!bases[key] && isTrip(R.trip)) out.bases[key] = R.trip
      } else {
        const localChanged = lt !== agreed
        const remoteChanged = rt !== agreed
        if (localChanged && remoteChanged) {
          if (bases[key] && isTrip(R.trip)) {
            // Both changed: keep both sides' changes, here and there.
            const merged = mergeTrip(bases[key], L, R.trip)
            out.pull.push(merged)
            push(merged, ms(merged.updatedAt))
          } else if (rt > lt) take()
          else push(L, lt)
        } else if (remoteChanged) take()
        else push(L, lt)
      }
    } else if (R && !R.deleted) {
      const at = deleted[key]
      // Not on this device and not deleted here: new from another device (or
      // newly shared with you). Edited elsewhere after this device deleted it:
      // the edit wins.
      if (shared || at == null || (rt !== agreed && rt > at)) {
        take()
        delete out.deleted[key]
      } else {
        out.push.push({ key, owner: R.owner, shared, trip: null, updated_at: stamp(at), deleted: true })
        out.pushed[key] = at
      }
    } else {
      if (R) out.known[key] = rt
      delete out.deleted[key]
      out.bases[key] = null
    }
  }
  return out
}

/* ---------- status, for the account card ---------- */

let status = { state: 'off' } // off | syncing | synced | offline | error
const listeners = new Set()
function setStatus(next) {
  status = { ...status, ...next }
  listeners.forEach(l => l())
}
const subscribe = l => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status)

// The engine registers here so "Sync now" can reach it.
let syncNow = null
export const requestSync = () => syncNow?.()

/* ---------- the account ---------- */

// One listener for the whole app. `session` is undefined while the stored
// session is read, then a session or null.
let session
const sessionListeners = new Set()
function setSession(next) {
  session = next
  sessionListeners.forEach(l => l())
}
const subscribeSession = l => {
  sessionListeners.add(l)
  return () => sessionListeners.delete(l)
}

// The account is shared by every chapri app, so the name may have changed in
// another one: read the user afresh on start and whenever the app comes back.
async function refreshUser() {
  if (!session) return
  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user && session) setSession({ ...session, user: data.user })
}

/* ---------- approval ---------- */

// Sync costs something, so it is for active members only: a new account is
// 'pending' until the owner approves it in the backend (public.members). The
// server enforces it; the app follows along so it can say "waiting for
// approval" instead of failing. null until known.
const MEMBERSHIP_KEY = 'triplanner:membership'
let membership = null
const membershipListeners = new Set()
function setMembership(next) {
  membership = next
  membershipListeners.forEach(l => l())
}
const subscribeMembership = l => {
  membershipListeners.add(l)
  return () => membershipListeners.delete(l)
}
export const useMembership = () => useSyncExternalStore(subscribeMembership, () => membership)

// The last status seen, so an offline start knows it too.
function readMembership(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMBERSHIP_KEY))
    return saved?.userId === userId && (saved.status === 'active' || saved.status === 'pending') ? saved.status : null
  } catch {
    return null
  }
}

async function refreshMembership() {
  const userId = session?.user?.id
  if (!userId) return
  const { data, error } = await supabase.from('members').select('status').eq('user_id', userId).maybeSingle()
  if (error || userId !== session?.user?.id) return // offline or signed out meanwhile: keep what we knew
  const status = data?.status === 'active' ? 'active' : 'pending'
  setMembership(status)
  try {
    localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify({ userId, status }))
  } catch {
    // storage unavailable — it is read again on the next start
  }
}

if (supabase) {
  supabase.auth.onAuthStateChange((event, next) => {
    if (next?.user?.id !== session?.user?.id) setMembership(next ? readMembership(next.user.id) : null)
    setSession(next)
    // Outside the callback: calling the client from inside it can deadlock.
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      setTimeout(() => {
        refreshUser()
        refreshMembership()
      }, 0)
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    refreshUser()
    refreshMembership()
  })
  // Waiting for approval: notice it soon after it happens, while the app is open.
  setInterval(() => {
    if (document.visibilityState === 'visible' && session && membership === 'pending') refreshMembership()
  }, POLL_EVERY)
}

export const useSession = () => useSyncExternalStore(subscribeSession, () => session)
// The signed-in user right now, outside React.
export const currentUser = () => session?.user ?? null

// The name shown in every chapri app; empty when the user has not set one.
export const displayName = user => (user?.user_metadata?.display_name ?? '').trim()

export async function saveDisplayName(name) {
  const { data, error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } })
  if (error) throw error
  if (session && data.user) setSession({ ...session, user: data.user })
}

// Sign-in is an email with a 6-digit code and a link. The code is typed into
// the app, so it works anywhere — also in an installed app, where the link
// would open the browser instead. The link comes back to this app in a normal
// tab. A new email address gets an account on the way (one account for every
// chapri app).
export async function sendLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/` },
  })
  if (error) throw error
}

export async function verifyCode(email, code) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
}

// A link that did not work — expired, used twice, or opened in another browser
// — leaves its parameters in the URL. Report it once and tidy the URL.
export function useSignInReturn(onFail) {
  useEffect(() => {
    if (!supabase) return
    // getSession waits until the client has tried the link.
    supabase.auth.getSession().then(() => {
      const query = new URLSearchParams(location.search)
      const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
      const why = query.get('error_description') || hash.get('error_description')
      if (!why && !query.has('code')) return
      const url = new URL(location.href)
      for (const k of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(k)
      if (hash.has('error_description')) url.hash = ''
      history.replaceState(history.state, '', url)
      onFail(why || 'open it in the browser where you asked for it')
    })
  }, [onFail])
}

// The trips stay on the device; they stop syncing.
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' })
}

/* ---------- the engine ---------- */

export function SyncEngine() {
  const { state, dispatch } = useStore()
  const session = useSession()
  const membership = useMembership()
  // Sync runs for active members only.
  const userId = membership === 'active' ? session?.user?.id : undefined
  const email = (session?.user?.email ?? '').toLowerCase()
  // undefined while the stored session is read, then the signed-in user or null
  const viewer = session === undefined ? undefined : (session?.user?.id ?? null)
  const latest = useRef(state.trips)
  latest.current = state.trips
  const prevIds = useRef(null)
  const removedBySync = useRef(new Set())
  const fromSync = useRef(false)
  const soon = useRef(null)

  // A trip deleted on this device is remembered, so the delete reaches the
  // account — also when it happens signed out, or offline.
  useEffect(() => {
    const ids = new Set(state.trips.map(t => t.id))
    const prev = prevIds.current
    prevIds.current = ids
    if (!prev || !supabase) return
    const gone = [...prev].filter(id => !ids.has(id) && !removedBySync.current.has(id))
    removedBySync.current.clear()
    const meta = readMeta()
    if (!gone.length || !meta.userId) return
    const now = Date.now()
    for (const id of gone) meta.deleted[id] = now
    writeMeta(meta)
  }, [state.trips])

  // Trips shared with someone stay on the device only while they are signed in
  // as that someone: signing out, or in as another account, removes them.
  useEffect(() => {
    if (viewer === undefined) return
    const foreign = latest.current.filter(t => t.sharedFrom && t.sharedFrom.viewerId !== viewer).map(t => t.id)
    if (!foreign.length) return
    foreign.forEach(id => removedBySync.current.add(id))
    fromSync.current = true
    dispatch({ type: 'sync/apply', trips: [], remove: foreign })
    updateBases(Object.fromEntries(foreign.map(id => [id, null])))
  }, [viewer, dispatch])

  // An edit here uploads after a short pause; a change that came from the
  // account does not go back up.
  useEffect(() => {
    if (fromSync.current) {
      fromSync.current = false
      return
    }
    soon.current?.()
  }, [state.trips])

  useEffect(() => {
    if (!supabase || !userId) {
      setStatus({ state: 'off', error: null })
      return
    }
    // Another account was used on this device before: compare from scratch.
    if (readMeta().userId !== userId) {
      writeMeta({ userId, known: {}, deleted: {} })
      writeBases({})
    }

    let stopped = false
    let running = false
    let again = false
    let timer = null

    async function sync() {
      clearTimeout(timer)
      timer = null
      if (running) {
        again = true
        return
      }
      if (!navigator.onLine) {
        setStatus({ state: 'offline' })
        return
      }
      running = true
      setStatus({ state: 'syncing' })
      try {
        // Own and shared trips come in one list (the server's rules decide
        // which); the shares say who shared each one with you.
        const [trips, shares] = await Promise.all([
          supabase.from(TABLE).select('user_id, id, data, updated_at, deleted'),
          supabase.from(SHARES).select('owner_id, trip_id, email, owner_email'),
        ])
        if (trips.error) throw trips.error
        if (shares.error) throw shares.error
        if (stopped) return
        const ownerEmails = new Map(
          shares.data.filter(s => s.email === email).map(s => [`${s.trip_id}~${s.owner_id}`, s.owner_email ?? '']),
        )
        const rows = trips.data.map(row => toLocalRow(row, userId, ownerEmails))
        const plan = planSync(latest.current, rows, readMeta(), readBases())
        if (plan.pull.length || plan.remove.length) {
          plan.remove.forEach(id => removedBySync.current.add(id))
          fromSync.current = true
          dispatch({ type: 'sync/apply', trips: migrate(plan.pull), remove: plan.remove })
        }
        writeMeta({ userId, known: plan.known, deleted: plan.deleted })
        updateBases(plan.bases)

        if (plan.push.length) {
          const done = []
          // Your trips: one upsert. A trip shared with you: an update of its
          // owner's row (you can edit it, not create or delete it).
          const own = plan.push.filter(p => !p.shared)
          if (own.length) {
            const { error: upError } = await supabase.from(TABLE).upsert(
              own.map(p => ({
                user_id: userId,
                id: p.key,
                data: p.trip,
                updated_at: p.updated_at,
                deleted: p.deleted,
              })),
              { onConflict: 'user_id,id' },
            )
            if (upError) throw upError
            done.push(...own)
          }
          for (const p of plan.push.filter(p => p.shared && !p.deleted)) {
            const remote = toRemoteTrip(p.trip)
            const { error: upError } = await supabase
              .from(TABLE)
              .update({ data: remote, updated_at: p.updated_at })
              .eq('user_id', p.owner)
              .eq('id', remote.id)
            if (upError) throw upError
            done.push(p)
          }
          // Read again: a delete may have been recorded during the upload.
          const meta = readMeta()
          for (const p of done) {
            meta.known[p.key] = plan.pushed[p.key]
            if (meta.deleted[p.key] === plan.pushed[p.key]) delete meta.deleted[p.key]
          }
          writeMeta(meta)
          updateBases(Object.fromEntries(done.map(p => [p.key, p.deleted ? null : p.trip])))
        }
        setStatus({ state: 'synced', at: new Date().toISOString(), error: null })
      } catch (err) {
        // Refused by the server's rules: the account may have been set back to pending.
        if (err?.code === '42501') refreshMembership()
        setStatus({ state: navigator.onLine ? 'error' : 'offline', error: err?.message ?? String(err) })
      } finally {
        running = false
        if (again && !stopped) {
          again = false
          sync()
        }
      }
    }

    soon.current = () => {
      clearTimeout(timer)
      timer = setTimeout(sync, SYNC_DELAY)
    }
    syncNow = sync

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
      else if (timer) sync() // leaving with an edit waiting: send it now
    }
    const poll = setInterval(() => document.visibilityState === 'visible' && sync(), POLL_EVERY)
    window.addEventListener('online', sync)
    document.addEventListener('visibilitychange', onVisible)
    sync()

    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(poll)
      soon.current = null
      syncNow = null
      window.removeEventListener('online', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, email, dispatch])

  return null
}
