import { useEffect, useRef, useSyncExternalStore } from 'react'
import { migrate, useStore } from './store'
import { supabase } from './supabase'

/* Sync with the chapri-apps account. The device stays the source of truth and
   works offline; when signed in, each trip is copied to the account and the
   account's trips come back to every device.

   A trip is one row. Which copy wins is decided per trip, from its updatedAt
   and the version both sides last agreed on (`known`):
   - changed on one side only → that side wins;
   - changed on both → the newer edit wins.
   A deleted trip leaves a tombstone, so the delete reaches the other devices
   instead of the trip coming back from them. */

export const syncEnabled = Boolean(supabase)

const META = 'triplanner:sync'
const TABLE = 'triplanner_trips'
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

/* ---------- the merge ---------- */

// `trips`: this device. `rows`: the account ({ id, data, updated_at, deleted }).
// Returns what to change on each side; `pushed` is recorded as known only once
// the upload went through.
export function planSync(trips, rows, { known, deleted }) {
  const local = new Map(trips.map(t => [t.id, t]))
  const remote = new Map(rows.map(r => [r.id, r]))
  const out = { pull: [], remove: [], push: [], pushed: {}, known: { ...known }, deleted: { ...deleted } }

  for (const id of new Set([...local.keys(), ...remote.keys(), ...Object.keys(deleted)])) {
    const L = local.get(id)
    const R = remote.get(id)
    const base = known[id]
    const lt = L ? ms(L.updatedAt) : 0
    const rt = R ? ms(R.updated_at) : 0

    const push = () => {
      out.push.push({ id, data: L, updated_at: stamp(lt), deleted: false })
      out.pushed[id] = lt
    }
    const take = () => {
      if (!isTrip(R.data)) return // nothing usable in the account — leave both alone
      out.pull.push(R.data)
      out.known[id] = rt
    }

    if (L) {
      delete out.deleted[id] // here after all (an Undo)
      if (!R) push()
      else if (R.deleted) {
        // Edited here after it was deleted elsewhere: the edit brings it back.
        if (lt !== base && lt > rt) push()
        else {
          out.remove.push(id)
          out.known[id] = rt
        }
      } else if (lt === rt) out.known[id] = rt
      else {
        const localChanged = lt !== base
        const remoteChanged = rt !== base
        if (remoteChanged && (!localChanged || rt > lt)) take()
        else push()
      }
    } else if (R && !R.deleted) {
      const at = deleted[id]
      // Not on this device and not deleted here: new from another device. Edited
      // elsewhere after this device deleted it: the edit wins.
      if (at == null || (rt !== base && rt > at)) {
        take()
        delete out.deleted[id]
      } else {
        out.push.push({ id, data: null, updated_at: stamp(at), deleted: true })
        out.pushed[id] = at
      }
    } else {
      if (R) out.known[id] = rt
      delete out.deleted[id]
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
    if (readMeta().userId !== userId) writeMeta({ userId, known: {}, deleted: {} })

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
        const { data: rows, error } = await supabase.from(TABLE).select('id, data, updated_at, deleted')
        if (error) throw error
        if (stopped) return
        const plan = planSync(latest.current, rows, readMeta())
        if (plan.pull.length || plan.remove.length) {
          plan.remove.forEach(id => removedBySync.current.add(id))
          fromSync.current = true
          dispatch({ type: 'sync/apply', trips: migrate(plan.pull), remove: plan.remove })
        }
        writeMeta({ userId, known: plan.known, deleted: plan.deleted })

        if (plan.push.length) {
          const { error: upError } = await supabase.from(TABLE).upsert(
            plan.push.map(row => ({ ...row, user_id: userId })),
            { onConflict: 'user_id,id' },
          )
          if (upError) throw upError
          // Read again: a delete may have been recorded during the upload.
          const meta = readMeta()
          for (const [id, at] of Object.entries(plan.pushed)) {
            meta.known[id] = at
            if (meta.deleted[id] === at) delete meta.deleted[id]
          }
          writeMeta(meta)
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
  }, [userId, dispatch])

  return null
}
