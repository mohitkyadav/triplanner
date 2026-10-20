import { useEffect, useState } from 'react'
import { MAX_PEOPLE, invite, isEmail, listInvites, removeInvite } from '../lib/shares'
import { currentUser, useMembership, useSession } from '../lib/sync'
import { IconUsers, IconX, Modal, btnPrimary, iconBtn, inputCls } from './ui'

/* Invite people to see and edit a trip. Whatever email is typed, the answer
   is the same — the app never says whether it belongs to an account. */
export default function InviteModal({ trip, onClose }) {
  const session = useSession()
  const membership = useMembership()
  const ready = Boolean(session) && membership === 'active'

  return (
    <Modal title="Invite people" onClose={onClose}>
      {!session ? (
        <Note>Sign in first (Sync your trips, on the home screen) to invite people to this trip.</Note>
      ) : !ready ? (
        <Note>Inviting people turns on once your account is approved.</Note>
      ) : (
        <Invites trip={trip} />
      )}
    </Modal>
  )
}

const Note = ({ children }) => <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{children}</p>

function Invites({ trip }) {
  const [people, setPeople] = useState(null) // null while loading
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const typed = email.trim()
  const myEmail = (currentUser()?.email ?? '').toLowerCase()

  useEffect(() => {
    let alive = true
    listInvites(trip)
      .then(list => alive && setPeople(list))
      .catch(err => alive && (setPeople([]), setError(err.message)))
    return () => {
      alive = false
    }
  }, [trip])

  async function submit(e) {
    e.preventDefault()
    if (!isEmail(typed)) return setError('That is not an email address')
    if (typed.toLowerCase() === myEmail) return setError('That is your own email — you already have this trip')
    setBusy(true)
    setError(null)
    try {
      await invite(trip, typed)
    } catch (err) {
      setError(err.message)
      return
    } finally {
      setBusy(false)
    }
    const person = typed.toLowerCase()
    setSentTo(typed)
    setEmail('')
    setPeople(list => (list?.includes(person) ? list : [...(list ?? []), person]))
    listInvites(trip)
      .then(setPeople)
      .catch(() => {}) // the list above is right; it is read again next time
  }

  async function remove(person) {
    if (!window.confirm(`Stop sharing “${trip.name}” with ${person}?`)) return
    setError(null)
    try {
      await removeInvite(trip, person)
      setPeople(list => list.filter(p => p !== person))
    } catch (err) {
      setError(err.message)
    }
  }

  const full = people && people.length >= MAX_PEOPLE

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-2">
        <input
          className={inputCls}
          type="email"
          autoComplete="off"
          placeholder="friend@example.com"
          aria-label="Email of the person to invite"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            setSentTo(null)
            setError(null)
          }}
          disabled={busy || full}
        />
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          {typed ? (
            <>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{typed}</span> will be able to see and
              edit this trip.
            </>
          ) : full ? (
            `A trip can be shared with up to ${MAX_PEOPLE} people.`
          ) : (
            'The person you invite can see and edit this trip.'
          )}
        </p>
        {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
        <button className={btnPrimary} disabled={busy || !typed || full}>
          <IconUsers className="size-4" />
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </form>

      {sentTo && (
        <p
          role="status"
          className="rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
        >
          If <span className="font-semibold">{sentTo}</span> has an only4 account, or creates one, they will see this
          trip in Triplanner and can edit it.
        </p>
      )}

      <section>
        <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Shared with
        </h3>
        {people === null ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Only you, so far.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 dark:divide-slate-800 dark:ring-slate-800">
            {people.map(person => (
              <li key={person} className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
                <span className="min-w-0 flex-1 truncate text-sm">{person}</span>
                <button className={iconBtn} onClick={() => remove(person)} aria-label={`Stop sharing with ${person}`}>
                  <IconX className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Changes from everyone are merged. Documents attached to plans stay on the device that added them.
      </p>
    </div>
  )
}
