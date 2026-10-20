import { useEffect, useState } from 'react'
import { fmtAgo } from '../lib/dates'
import {
  displayName,
  requestSync,
  saveDisplayName,
  sendLink,
  signOut,
  syncEnabled,
  useMembership,
  useSession,
  useSyncStatus,
  verifyCode,
} from '../lib/sync'
import { IconLogIn, IconLogOut, IconPencil, IconRotate, btnChip, btnChipBrand, iconBtn, inputCls, useToast } from './ui'

// One account for all chapri apps. Signed in, the trips sync between devices;
// signed out, the app is the same offline app.

function statusLine(state, sync) {
  if (state === 'pending') return 'Waiting for approval — sync turns on once your account is approved'
  if (sync.state === 'syncing') return 'Syncing…'
  if (sync.state === 'offline') return 'Offline — changes sync when you are back online'
  if (sync.state === 'error') return 'Sync failed — it tries again on the next change'
  if (sync.at) return `Synced ${fmtAgo(sync.at)}`
  return 'Connected'
}

const CODE_LENGTH = 6

function SignIn() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function send(e) {
    e.preventDefault()
    const to = email.trim()
    run(async () => {
      await sendLink(to)
      setSentTo(to)
      setCode('')
    })
  }

  // Signed in, the card goes away by itself (the session changes).
  const verify = digits => run(() => verifyCode(sentTo, digits))

  function onCode(value) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (digits.length === CODE_LENGTH && !busy) verify(digits) // a pasted or autofilled code signs in at once
  }

  return sentTo ? (
    <form
      onSubmit={e => {
        e.preventDefault()
        verify(code)
      }}
      className="space-y-2"
    >
      <p className="text-[13px] text-slate-500 dark:text-slate-400">
        We sent a code to <span className="font-semibold text-slate-700 dark:text-slate-200">{sentTo}</span>. Type it
        here, or open the link in the email in this browser.
      </p>
      <input
        className={`${inputCls} text-center font-mono tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label="Sign-in code"
        value={code}
        onChange={e => onCode(e.target.value)}
        disabled={busy}
        autoFocus
      />
      {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={btnChipBrand} disabled={busy || code.length !== CODE_LENGTH}>
          <IconLogIn className="size-3.5" />
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className={btnChip} onClick={() => setSentTo(null)} disabled={busy}>
          Use another email
        </button>
      </div>
    </form>
  ) : (
    <form onSubmit={send} className="space-y-2">
      <input
        className={inputCls}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        aria-label="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
      <button className={btnChipBrand} disabled={busy || !email.trim()}>
        <IconLogIn className="size-3.5" />
        {busy ? 'Sending…' : 'Email me a sign-in code'}
      </button>
    </form>
  )
}

const DOT = {
  pending: 'bg-amber-500',
  synced: 'bg-emerald-500',
  syncing: 'bg-brand-500 animate-pulse',
  offline: 'bg-slate-400',
  error: 'bg-rose-500',
  off: 'bg-slate-400',
}
const SHORT = {
  pending: 'Waiting for approval',
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync failed',
  off: 'Connected',
}

// Signed in: a small account button in the navbar — the sync state at a
// glance, and the account behind a tap.
export function AccountMenu() {
  const session = useSession()
  const sync = useSyncStatus()
  const membership = useMembership()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const close = () => {
    setOpen(false)
    setEditing(false)
  }

  // Escape leaves the name editor first, then the menu.
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (editing) setEditing(false)
      else setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, editing])

  if (!syncEnabled || !session) return null
  const email = session.user.email ?? ''
  const name = displayName(session.user)
  // A pending account has nothing to sync yet: its badge says so instead.
  const state = membership === 'pending' ? 'pending' : sync.state in DOT ? sync.state : 'off'

  return (
    <div className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={`Account: ${name || email}, ${SHORT[state]}`}
        aria-expanded={open}
        title={SHORT[state]}
        className="rounded-full p-1 transition hover:bg-slate-200/60 dark:hover:bg-slate-800"
      >
        <span className="relative grid size-7 place-items-center rounded-full bg-brand-100 text-[13px] font-bold uppercase text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
          {(name || email).charAt(0) || '?'}
          {/* The sync state at a glance: a dot, or the sync icon turning. The words are in the menu. */}
          {state === 'syncing' ? (
            <span className="absolute -bottom-1 -right-1 grid size-3.5 place-items-center rounded-full bg-slate-50 text-brand-600 dark:bg-slate-950 dark:text-brand-400">
              <IconRotate className="size-2.5 animate-spin" />
            </span>
          ) : (
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-slate-50 dark:ring-slate-950 ${DOT[state]}`}
            />
          )}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
              {editing ? (
                <NameEditor saved={name} onDone={() => setEditing(false)} />
              ) : (
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name || email}</p>
                    {name ? (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
                    ) : (
                      <button
                        onClick={() => setEditing(true)}
                        className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Add your name
                      </button>
                    )}
                  </div>
                  {name && (
                    <button
                      className={`${iconBtn} -mr-1.5 -mt-1`}
                      onClick={() => setEditing(true)}
                      aria-label="Edit name"
                    >
                      <IconPencil className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p
                className={`mt-0.5 flex items-center gap-1.5 text-xs ${state === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}
                title={state === 'error' ? sync.error : undefined}
              >
                <span className={`size-1.5 shrink-0 rounded-full ${DOT[state]}`} />
                {statusLine(state, sync)}
              </p>
            </div>
            <div className="py-1">
              {membership === 'active' && (
                <button
                  onClick={() => requestSync()}
                  disabled={state === 'syncing'}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <IconRotate className={`size-4 shrink-0 ${state === 'syncing' ? 'animate-spin' : ''}`} />
                  Sync now
                </button>
              )}
              <button
                onClick={() => {
                  close()
                  signOut()
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <IconLogOut className="size-4 shrink-0" />
                Sign out
              </button>
            </div>
            <p className="border-t border-slate-100 px-3.5 py-2 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
              One account for every chapri app. Signing out keeps the trips on this device.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// Signed out: the invitation to sign in, on the home screen.
export default function Account() {
  const session = useSession()
  if (!syncEnabled || session !== null) return null

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-sm font-semibold">Sync your trips</p>
      <p className="mb-3 mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
        Sign in to keep your trips on all your devices. The same account works in every chapri app. Documents stay on
        the device that added them.
      </p>
      <SignIn />
    </section>
  )
}

const NAME_MAX = 60

// The display name, edited in the account menu. It belongs to the account, so
// every chapri app shows the same name.
function NameEditor({ saved, onDone }) {
  const toast = useToast()
  const [value, setValue] = useState(saved)
  const [busy, setBusy] = useState(false)
  const next = value.trim()

  async function save(e) {
    e.preventDefault()
    if (next === saved) return onDone()
    setBusy(true)
    try {
      await saveDisplayName(next)
      toast(next ? 'Name saved for all your chapri apps' : 'Name removed')
      onDone()
    } catch (err) {
      toast(`The name was not saved: ${err?.message ?? err}`)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <input
        className={inputCls}
        placeholder="Your name"
        aria-label="Display name"
        autoComplete="name"
        maxLength={NAME_MAX}
        value={value}
        onChange={e => setValue(e.target.value)}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button className={btnChipBrand} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={btnChip} onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">All chapri apps</span>
      </div>
    </form>
  )
}
