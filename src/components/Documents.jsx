import { useEffect, useRef, useState } from 'react'
import { addFile, fmtBytes, readFile } from '../lib/files'
import { btnChip, btnGhost, IconDownload, IconExternal, IconFile, IconPaperclip, IconX, iconBtn, Modal } from './ui'

/* Documents on a plan: a list to manage them in the plan form, chips to open
   them from Trip mode, and the viewer both use. Everything is read from this
   device, so it works with no signal. */

export function DocumentViewer({ doc, onClose }) {
  const [state, setState] = useState({ status: 'loading' }) // loading | missing | { url }

  useEffect(() => {
    let url = null
    let alive = true
    readFile(doc.id).then(blob => {
      if (!alive) return
      if (!blob) return setState({ status: 'missing' })
      url = URL.createObjectURL(blob)
      setState({ status: 'ready', url })
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc.id])

  const isImage = doc.type.startsWith('image/')
  const isPdf = doc.type === 'application/pdf' || /\.pdf$/i.test(doc.name)

  return (
    <Modal title={doc.name} onClose={onClose}>
      {state.status === 'loading' ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Opening…</p>
      ) : state.status === 'missing' ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          This document is not on this device. Documents stay where they were added — they do not travel in backups or
          share links.
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

// The plan form's list: open, remove, and add documents.
export function DocumentList({ docs, onChange, onError }) {
  const [viewing, setViewing] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  async function add(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    const added = []
    for (const file of files) {
      try {
        added.push(await addFile(file))
      } catch (err) {
        onError?.(`“${file.name}” was not added — ${err.message || 'the device refused to store it'}`)
      }
    }
    setBusy(false)
    if (added.length) onChange([...docs, ...added])
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
              <span className="shrink-0 text-xs tabular-nums text-slate-400">{fmtBytes(doc.size)}</span>
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
      <button type="button" className={btnChip} onClick={() => inputRef.current?.click()} disabled={busy}>
        <IconPaperclip className="size-4" />
        {busy ? 'Adding…' : 'Attach ticket, pass or confirmation'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={add}
        data-testid="attach-input"
      />
      <p className="text-[13px] text-slate-400 dark:text-slate-500">
        Kept on this device for offline use — not in backups or share links.
      </p>
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

// One chip per document, for opening on the go.
export function DocumentChips({ docs, className = '' }) {
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
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
