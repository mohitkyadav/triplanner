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
export const IconCircle = p => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
  </Svg>
)
export const IconCheckCircle = p => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
export const IconXCircle = p => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Svg>
)
export const IconCalendar = p => (
  <Svg {...p}>
    <path d="M8 2v4M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
  </Svg>
)
export const IconClock = p => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Svg>
)
export const IconBed = p => (
  <Svg {...p}>
    <path d="M2 4v16" />
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />
    <path d="M2 17h20" />
    <path d="M6 8v9" />
  </Svg>
)
export const IconPlaneLanding = p => (
  <Svg {...p}>
    <path d="M2 22h20" />
    <path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 .9.45a2 2 0 0 1 1.05 1.79v3.45a2 2 0 0 0 1.05 1.79l4.17 2.08a2.41 2.41 0 0 1 1.33 2.15c0 .79-.78 1.35-1.53 1.1L4.55 12.2a2 2 0 0 1-.78-.43Z" />
  </Svg>
)
export const IconPlaneTakeoff = p => (
  <Svg {...p}>
    <path d="M2 22h20" />
    <path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z" />
  </Svg>
)
export const IconLogIn = p => (
  <Svg {...p}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </Svg>
)
export const IconLogOut = p => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)
export const IconSun = p => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Svg>
)
export const IconMoon = p => (
  <Svg {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Svg>
)
export const IconMonitor = p => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
)
export const IconGoogle = p => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
  </Svg>
)
export const IconApple = p => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
  </Svg>
)
export const IconShare = p => (
  <Svg {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
  </Svg>
)
export const IconRoute = p => (
  <Svg {...p}>
    <circle cx="6" cy="19" r="3" />
    <circle cx="18" cy="5" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
  </Svg>
)
export const IconQrCode = p => (
  <Svg {...p}>
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="16" width="5" height="5" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" />
  </Svg>
)
export const IconCalendarPlus = p => (
  <Svg {...p}>
    <path d="M8 2v4M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18M12 14v6M9 17h6" />
  </Svg>
)
export const IconDots = p => (
  <Svg {...p} stroke="none" fill="currentColor">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </Svg>
)
export const IconChevronDown = p => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)
export const IconCopy = p => (
  <Svg {...p}>
    <rect x="8" y="8" width="14" height="14" rx="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
)
export const IconCheck = p => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)
export const IconChevronLeft = p => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
)
export const IconChevronRight = p => (
  <Svg {...p}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
)
export const IconNavigation = p => (
  <Svg {...p}>
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </Svg>
)
export const IconAlert = p => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
)
export const IconShield = p => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
)
export const IconShieldCheck = p => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
export const IconRotate = p => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Svg>
)
export const IconFolder = p => (
  <Svg {...p}>
    <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" />
  </Svg>
)
export const IconInstall = p => (
  <Svg {...p}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 7v7M9 11l3 3 3-3" />
  </Svg>
)
export const IconTicket = p => (
  <Svg {...p}>
    <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z" />
    <path d="M13 5v14" />
  </Svg>
)
export const IconHourglass = p => (
  <Svg {...p}>
    <path d="M6 2h12M6 22h12" />
    <path d="M6 2c0 4 6 6 6 10s-6 6-6 10M18 2c0 4-6 6-6 10s6 6 6 10" />
  </Svg>
)

/* ---------- shared class strings ---------- */

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-[.98] dark:bg-brand-600 dark:hover:bg-brand-500'
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
export const iconBtn =
  'rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
// Small buttons that sit inside cards and rows.
export const btnChip =
  'inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[.98] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
export const btnChipBrand =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-600 active:scale-[.98] dark:bg-brand-600 dark:hover:bg-brand-500'
// 16px minimum on editable fields — anything smaller triggers iOS Safari's
// auto-zoom on focus, which leaves the page horizontally scrollable.
export const inputCls =
  'w-full rounded-xl border-0 bg-slate-100 px-3.5 py-2.5 text-base text-slate-900 outline-none ring-1 ring-transparent transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-400'

/* ---------- small form primitives ---------- */

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

/* Native date/time input, normalized. iOS Safari gives empty pickers no
   placeholder and no icon (they render as a blank pill) and an intrinsic
   width that overflows narrow grid cells — so we reset appearance, overlay
   our own placeholder + icon, and leave the native picker interaction
   untouched. On desktop browsers the built-in segments/indicator are hidden
   while empty and unfocused so the overlay placeholder shows instead. */
export function PickerInput({ type = 'date', value, onChange, placeholder, ...rest }) {
  const Icon = type === 'time' ? IconClock : IconCalendar
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`${inputCls} peer min-h-11 min-w-0 appearance-none pr-10 [&::-webkit-date-and-time-value]:text-left [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${
          value ? '' : 'text-transparent focus:text-slate-900 dark:focus:text-slate-100'
        }`}
        {...rest}
      />
      {!value && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base text-slate-400 peer-focus:hidden">
          {placeholder ?? (type === 'time' ? 'Select time' : 'Select date')}
        </span>
      )}
      <Icon className="pointer-events-none absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
    </div>
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
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {o.icon && <o.icon className="size-4" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- modal (bottom sheet on mobile, dialog on desktop) ---------- */

export function Modal({ title, onClose, children }) {
  // Height of the on-screen keyboard overlapping the layout viewport (iOS
  // Safari keeps position:fixed anchored behind the keyboard). Where the
  // browser resizes the layout instead (interactive-widget=resizes-content),
  // this stays 0.
  const [kbInset, setKbInset] = useState(0)

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKbInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={kbInset ? { paddingBottom: kbInset } : undefined}
    >
      <div className="anim-backdrop absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-slate-900"
        style={kbInset ? { maxHeight: `calc(100dvh - ${kbInset}px - 1.5rem)` } : undefined}
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

/* ---------- dropdown menu ---------- */

export function Menu({ items, label = 'More options' }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="relative">
      <button className={iconBtn} onClick={() => setOpen(o => !o)} aria-label={label} aria-expanded={open}>
        <IconDots className="size-4.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            {items.map(item => (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition ${
                  item.danger
                    ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- toast ---------- */

const ToastCtx = createContext(() => {})

// toast('Saved') or toast('Deleted', { label: 'Undo', onClick }) — toasts with
// an action stay up longer so there is time to tap it.
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null) // { text, action? }
  const timer = useRef()
  const toast = useCallback((text, action) => {
    setMsg({ text, action })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), action ? 6000 : 2600)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && (
        <div className="anim-toast fixed bottom-6 left-1/2 z-60 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-slate-900 py-2 pl-4 pr-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-slate-900">
          {msg.text}
          {msg.action ? (
            <button
              onClick={() => {
                clearTimeout(timer.current)
                setMsg(null)
                msg.action.onClick()
              }}
              className="rounded-full px-2.5 py-0.5 font-bold text-accent transition hover:bg-white/10 dark:text-brand-600 dark:hover:bg-slate-900/5"
            >
              {msg.action.label}
            </button>
          ) : (
            <span className="pr-2" />
          )}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
