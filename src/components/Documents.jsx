import { useEffect, useRef, useState } from 'react'
import {
  ACCEPT_ATTR,
  addFile,
  canUpload,
  fmtBytes,
  MAX_FILE_BYTES,
  readFile,
  shrinkImage,
  TooBigError,
} from '../lib/files'
import { syncEnabled, useSession } from '../lib/sync'
import {
  btnChip,
  btnChipBrand,
  btnGhost,
  IconAlert,
  IconDownload,
  IconExternal,
  IconFile,
  IconPaperclip,
  IconX,
  iconBtn,
  Modal,
} from './ui'

/* Documents on a plan: a list to manage them in the plan form, chips to open
   them from Trip mode, and the viewer both use. A document opens from this
   device, or — the first time on another device — from the account, and is
   kept here for offline after that. `trip` says where the account keeps it. */

export function DocumentViewer({ doc, trip, onClose }) {
  const [state, setState] = useState({ status: 'loading' }) // loading | missing | ready
  const session = useSession()

  useEffect(() => {
    let url = null
    let alive = true
    readFile(doc, trip).then(blob => {
      if (!alive) return
      if (!blob) return setState({ status: 'missing' })
      url = URL.createObjectURL(blob)
      setState({ status: 'ready', url })
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // the trip only says where to look; the document is what opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  const isImage = doc.type.startsWith('image/')
  const isPdf = doc.type === 'application/pdf' || /\.pdf$/i.test(doc.name)

  return (
    <Modal title={doc.name} onClose={onClose}>
      {state.status === 'loading' ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Opening…</p>
      ) : state.status === 'missing' ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {!syncEnabled
            ? 'This document is on the device it was added on.'
            : !session?.user
              ? 'This document is on another device. Sign in to open documents from your other devices.'
              : doc.size > MAX_FILE_BYTES
                ? `This document is ${fmtBytes(doc.size)}, over the ${fmtBytes(MAX_FILE_BYTES)} the account keeps, so it stays on the device it was added on.`
                : !canUpload(doc)
                  ? 'The account does not keep this kind of file, so it stays on the device it was added on.'
                  : 'This document has not reached the account yet. Open the trip on the device it was added on, while online, and try again.'}
        </p>
      ) : (
        <div className="space-y-3 pb-1">
          {isImage ? (
            <img src={state.url} alt={doc.name} className="mx-auto max-h-[65dvh] rounded-xl object-contain" />
          ) : isPdf ? (
            <iframe
              src={state.url}
              title={doc.name}
              className="h-[65dvh] w-full rounded-xl bg-white ring-1 ring-slate-200"
            />
          ) : (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              This kind of file cannot be shown here. Open or save it instead.
            </p>
          )}
          <div className="flex justify-center gap-2">
            <a className={btnGhost} href={state.url} target="_blank" rel="noopener noreferrer">
              <IconExternal className="size-4" />
              Open
            </a>
            <a className={btnGhost} href={state.url} download={doc.name}>
              <IconDownload className="size-4" />
              Save
            </a>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* The plan form's list: open, remove, and add documents. A file over the
   limit is not added; a photo among them can be made smaller instead — the
   same picture, a little lower in quality — and added then. */
export function DocumentList({ docs, trip, onChange, onError }) {
  const [viewing, setViewing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tooBig, setTooBig] = useState([]) // files waiting for "make it smaller"
  const inputRef = useRef(null)
  const session = useSession()

  async function add(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    const added = []
    const big = []
    for (const file of files) {
      try {
        added.push(await addFile(file))
      } catch (err) {
        if (err instanceof TooBigError) big.push(file)
        else onError?.(`“${file.name}” was not added — ${err.message || 'the device refused to store it'}`)
      }
    }
    setBusy(false)
    if (added.length) onChange([...docs, ...added])
    setTooBig(big)
  }

  // Makes a photo smaller, then attaches the smaller copy.
  async function shrink(file) {
    setBusy(true)
    try {
      const smaller = await shrinkImage(file)
      const ref = await addFile(smaller)
      onChange([...docs, ref])
      setTooBig(list => list.filter(f => f !== file))
      onError?.(`Attached a smaller copy of “${file.name}” (${fmtBytes(ref.size)})`)
    } catch (err) {
      onError?.(`“${file.name}” could not be made smaller — ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map(doc => (
            <li
              key={doc.id}
              className="flex items-center gap-2 rounded-xl bg-slate-100 py-1 pl-3 pr-1 dark:bg-slate-800"
            >
              <IconFile className="size-4 shrink-0 text-slate-400" />
              <button
                type="button"
                onClick={() => setViewing(doc)}
                className="min-w-0 flex-1 truncate py-1.5 text-left text-sm font-medium hover:underline"
              >
                {doc.name}
              </button>
              <span
                className={`shrink-0 text-xs tabular-nums ${canUpload(doc) ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400'}`}
                title={
                  canUpload(doc)
                    ? undefined
                    : doc.size > MAX_FILE_BYTES
                      ? 'Over the limit: kept on this device only'
                      : 'A kind of file the account does not keep: on this device only'
                }
              >
                {fmtBytes(doc.size)}
              </span>
              <button
                type="button"
                className={`${iconBtn} p-1.5`}
                onClick={() => onChange(docs.filter(d => d.id !== doc.id))}
                aria-label={`Remove ${doc.name}`}
              >
                <IconX className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* too big to add: why, and for a photo, a way to make it fit */}
      {tooBig.map(file => {
        const shrinkable = new TooBigError(file).shrinkable
        return (
          <div
            key={`${file.name}-${file.size}`}
            role="alert"
            className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25"
          >
            <p className="flex items-start gap-2">
              <IconAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0">
                <span className="font-semibold">
                  “{file.name}” is {fmtBytes(file.size)}
                </span>{' '}
                — documents can be up to {fmtBytes(MAX_FILE_BYTES)}.{' '}
                {shrinkable
                  ? 'It can be attached as a smaller, slightly lower-quality copy.'
                  : 'Try a smaller copy — for example, save just the ticket page as a PDF.'}
              </span>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2 pl-6">
              {shrinkable && (
                <button type="button" className={btnChipBrand} onClick={() => shrink(file)} disabled={busy}>
                  {busy ? 'Making it smaller…' : 'Make it smaller and attach'}
                </button>
              )}
              <button type="button" className={btnChip} onClick={() => setTooBig(list => list.filter(f => f !== file))}>
                {shrinkable ? 'Not now' : 'OK'}
              </button>
            </div>
          </div>
        )
      })}

      <button type="button" className={btnChip} onClick={() => inputRef.current?.click()} disabled={busy}>
        <IconPaperclip className="size-4" />
        {busy ? 'Adding…' : 'Attach ticket, pass or confirmation'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={add}
        data-testid="attach-input"
      />
      <p className="text-[13px] text-slate-400 dark:text-slate-500">
        Up to {fmtBytes(MAX_FILE_BYTES)} each.{' '}
        {syncEnabled && session?.user
          ? 'Kept on this device and in your account, so your other devices — and anyone the trip is shared with — can open them.'
          : syncEnabled
            ? 'Kept on this device; sign in to open them on your other devices too.'
            : 'Kept on this device for offline use.'}
      </p>
      {viewing && <DocumentViewer doc={viewing} trip={trip} onClose={() => setViewing(null)} />}
    </div>
  )
}

// One chip per document, for opening on the go.
export function DocumentChips({ docs, trip, className = '' }) {
  const [viewing, setViewing] = useState(null)
  if (!docs?.length) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {docs.map(doc => (
        <button key={doc.id} type="button" className={btnChip} onClick={() => setViewing(doc)}>
          <IconPaperclip className="size-3.5" />
          <span className="max-w-40 truncate">{doc.name}</span>
        </button>
      ))}
      {viewing && <DocumentViewer doc={viewing} trip={trip} onClose={() => setViewing(null)} />}
    </div>
  )
}
