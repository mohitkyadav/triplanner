import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* ---------- icons (24px stroke, lucide-style) ---------- */

const Svg = ({ className = 'size-5', children, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
)

export const IconArrowLeft = p => (
  <Svg {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
)
export const IconPlus = p => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconTrash = p => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6" />
  </Svg>
)
export const IconPencil = p => (
  <Svg {...p}>
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Svg>
)
export const IconDownload = p => (
  <Svg {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </Svg>
)
export const IconUpload = p => (
  <Svg {...p}>
    <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />
  </Svg>
)
export const IconX = p => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)
export const IconMapPin = p => (
  <Svg {...p}>
    <path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
)
export const IconGrip = p => (
  <Svg {...p} stroke="none" fill="currentColor">
    <circle cx="9" cy="6" r="1.4" />
    <circle cx="15" cy="6" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="18" r="1.4" />
    <circle cx="15" cy="18" r="1.4" />
  </Svg>
)

/* ---------- shared class strings ---------- */

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-400 hover:to-indigo-400 active:scale-[.98]'
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
export const iconBtn =
  'rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
export const inputCls =
  'w-full rounded-xl border-0 bg-slate-100 px-3.5 py-2.5 text-[15px] text-slate-900 outline-none ring-1 ring-transparent transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100'

/* ---------- small form primitives ---------- */

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map(o => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- modal (bottom sheet on mobile, dialog on desktop) ---------- */

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="anim-backdrop absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className={iconBtn} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- toast ---------- */

const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const timer = useRef()
  const toast = useCallback(m => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && (
        <div className="anim-toast fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-slate-900">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
