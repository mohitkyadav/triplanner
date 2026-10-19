import { flushSync } from 'react-dom'

/* Motion through the browser's View Transitions: the page is snapshotted,
   the change is applied, and the browser animates between the two. Elements
   with a `view-transition-name` (see `vtName`) move on their own — a plan
   gliding to its new place, a trip card growing into the trip page — and
   everything else cross-fades. The animations live in index.css.

   Where the browser has no View Transitions, or the person asked for reduced
   motion, the change simply happens. */

let pending = null // the transition waiting for its update, see `beforeUpdate`

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function motionOK() {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function' && !reducedMotion()
}

/* Applies `update` (a React state change) inside a view transition.
   `kind` names the animation set on <html data-vt="…"> while it runs:
   'page', 'back', 'next', 'prev', 'theme' — or nothing for the default. */
export function transition(update, kind = '') {
  if (!motionOK()) return update()
  const root = document.documentElement
  if (kind) root.dataset.vt = kind
  // Changes made together (save a trip, then open it) wait for each other,
  // so they land in the same order, in the same transition.
  if (pending) return void pending.updates.push(update)
  const job = { before: [], updates: [update] }
  pending = job
  const vt = document.startViewTransition(() => {
    pending = null
    job.before.forEach(fn => fn())
    flushSync(() => job.updates.forEach(fn => fn()))
  })
  // A transition the browser cuts short (the window resized) still applies
  // the change; it just does not animate.
  vt.ready.catch(() => {})
  vt.finished
    .catch(() => {})
    .finally(() => {
      if (pending === job) pending = null
      delete root.dataset.vt
    })
  return vt
}

// Runs `fn` right before the waiting transition applies its change, or
// returns false when no transition is waiting. Used to take leftovers out of
// the new snapshot (a closing dialog's ghost).
export function beforeUpdate(fn) {
  if (!pending) return false
  pending.before.push(fn)
  return true
}

// A view-transition-name from any id (names must be CSS identifiers).
export const vtName = (prefix, id) => `${prefix}-${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`
