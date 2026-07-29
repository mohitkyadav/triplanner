import { useEffect, useState } from 'react'
import {
  backupInfo,
  chooseBackupFile,
  forgetBackupFile,
  loadBackupInfo,
  markExported,
  readMirror,
  requestPersistence,
  subscribeBackup,
  supportsBackupFile,
  writeBackupFile,
} from '../lib/backup'
import { daysSince, fmtAgo } from '../lib/dates'
import { normalizeTrips } from '../lib/io'
import { useInstall } from '../lib/install'
import { useStore } from '../lib/store'
import ImportPreview from './ImportPreview'
import {
  btnChip,
  btnChipBrand,
  IconAlert,
  IconChevronDown,
  IconDownload,
  IconFolder,
  IconInstall,
  IconRotate,
  IconShield,
  IconShieldCheck,
  IconUpload,
  Modal,
  useToast,
} from './ui'

// Everything that keeps the trips safe, in one card on the home screen: the
// automatic backup file, the app install, the browser storage protection, and
// a way back from the copy the app keeps on the device.

const TONE = {
  ok: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300', text: '' },
  warn: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300', text: 'text-amber-700 dark:text-amber-400' },
  risk: { chip: 'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300', text: 'text-rose-600 dark:text-rose-400' },
  idle: { chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', text: '' },
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return ''
  const units = ['B', 'kB', 'MB', 'GB']
  let value = n
  let i = 0
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000
    i++
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

function status(info, trips) {
  if (trips.length === 0) return { level: 'idle', line: 'No trips to keep safe yet' }
  if (info.fileBlocked) return { level: 'warn', line: 'The backup file needs your permission again' }
  if (info.fileName) {
    return {
      level: 'ok',
      line: info.fileWrittenAt ? `Automatic backup · saved ${fmtAgo(info.fileWrittenAt)}` : 'Automatic backup is on',
    }
  }
  if (info.exportedAt) {
    const days = daysSince(info.exportedAt)
    return { level: days > 7 ? 'warn' : 'ok', line: `Last backup ${fmtAgo(info.exportedAt)}` }
  }
  return { level: 'risk', line: 'Not backed up yet' }
}

function Row({ icon: Icon, tone = 'idle', title, text, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-px grid size-8 shrink-0 place-items-center rounded-lg ${TONE[tone].chip}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {text && <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{text}</p>}
        {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  )
}

export default function DataSafety({ onExport, onImport }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const install = useInstall()
  const [info, setInfo] = useState(backupInfo)
  const [open, setOpen] = useState(false)
  const [restore, setRestore] = useState(null) // { trips, savedAt } | 'empty'

  useEffect(() => {
    const unsubscribe = subscribeBackup(next => setInfo({ ...next }))
    loadBackupInfo()
    return unsubscribe
  }, [])

  const trips = state.trips
  const { level, line } = status(info, trips)
  const StatusIcon = level === 'ok' ? IconShieldCheck : level === 'idle' ? IconShield : IconAlert

  async function turnOnFileBackup() {
    try {
      const ok = await chooseBackupFile(trips, 'triplanner-backup.json')
      toast(ok ? 'Automatic backup is on' : 'The file could not be written')
    } catch (err) {
      if (err?.name !== 'AbortError') toast('No file was chosen')
    }
  }

  async function saveFileNow({ request = false } = {}) {
    toast((await writeBackupFile(trips, { request })) ? 'Backup file saved' : 'The file could not be written')
  }

  async function protect() {
    const ok = await requestPersistence()
    toast(ok ? 'The browser keeps your data' : 'The browser did not agree — install the app instead')
  }

  function exportNow() {
    onExport()
    markExported()
  }

  async function openRestore() {
    const snapshot = await readMirror()
    try {
      setRestore({ trips: normalizeTrips(snapshot), savedAt: snapshot.savedAt })
    } catch {
      setRestore('empty')
    }
  }

  function confirmRestore() {
    dispatch({ type: 'data/import', trips: restore.trips })
    toast(`Restored ${restore.trips.length} trip${restore.trips.length === 1 ? '' : 's'}`)
    setRestore(null)
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${TONE[level].chip}`}>
          <StatusIcon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Keep your trips safe</span>
          <span className={`block truncate text-xs ${TONE[level].text || 'text-slate-500 dark:text-slate-400'}`}>
            {line}
          </span>
        </span>
        <IconChevronDown
          className={`size-4.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
          {supportsBackupFile &&
            (info.fileName ? (
              <Row
                icon={IconFolder}
                tone={info.fileBlocked ? 'warn' : 'ok'}
                title={`Automatic backup → ${info.fileName}`}
                text={
                  info.fileBlocked
                    ? 'The browser forgot the permission. Give it again to continue.'
                    : info.fileWrittenAt
                      ? `The app writes this file after every change. Last write ${fmtAgo(info.fileWrittenAt)}.`
                      : 'The app writes this file after every change.'
                }
              >
                {info.fileBlocked ? (
                  <button className={btnChipBrand} onClick={() => saveFileNow({ request: true })}>
                    Give permission
                  </button>
                ) : (
                  <button className={btnChip} onClick={() => saveFileNow()}>
                    Save now
                  </button>
                )}
                <button className={btnChip} onClick={() => forgetBackupFile()}>
                  Turn off
                </button>
              </Row>
            ) : (
              <Row
                icon={IconFolder}
                tone={trips.length ? 'risk' : 'idle'}
                title="Automatic backup"
                text="Choose one file. The app then rewrites it after every change, so a copy always lives outside the browser."
              >
                <button className={btnChipBrand} onClick={turnOnFileBackup}>
                  <IconFolder className="size-3.5" />
                  Choose a file
                </button>
              </Row>
            ))}

          {!install.installed && (
            <Row
              icon={IconInstall}
              tone="warn"
              title="Install the app"
              text="A browser can delete the data of a page you do not install. Safari does this after 7 days without a visit. An installed app keeps its data."
            >
              {install.canPrompt ? (
                <button className={btnChipBrand} onClick={install.prompt}>
                  <IconInstall className="size-3.5" />
                  Install
                </button>
              ) : (
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  Open the browser share menu, then “Add to Home Screen”.
                </span>
              )}
            </Row>
          )}

          <Row
            icon={info.persisted ? IconShieldCheck : IconShield}
            tone={info.persisted ? 'ok' : 'idle'}
            title={info.persisted ? 'The browser keeps your data' : 'Browser cleanup'}
            text={
              info.persisted
                ? 'This browser will not remove Triplanner data to free space.'
                : 'Ask this browser to hold your data when it frees space.'
            }
          >
            {!info.persisted && (
              <button className={btnChip} onClick={protect}>
                Ask the browser
              </button>
            )}
          </Row>

          {info.mirroredTrips > 0 && (
            <Row
              icon={IconRotate}
              title="Copy on this device"
              text={`${info.mirroredTrips} trip${info.mirroredTrips === 1 ? '' : 's'}, saved ${fmtAgo(info.mirroredAt)}. The app writes this copy after every change and reads it back if the browser loses the main data.`}
            >
              <button className={btnChip} onClick={openRestore}>
                <IconRotate className="size-3.5" />
                Restore this copy
              </button>
            </Row>
          )}

          <Row
            icon={IconDownload}
            title="Files"
            text="Export a file you keep yourself, or read one back in."
          >
            <button className={btnChip} onClick={exportNow}>
              <IconDownload className="size-3.5" />
              Export all
            </button>
            <button className={btnChip} onClick={onImport}>
              <IconUpload className="size-3.5" />
              Import
            </button>
          </Row>

          {Number.isFinite(info.usage) && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {fmtBytes(info.usage)} used
              {Number.isFinite(info.quota) && info.quota > 0 && ` of ${fmtBytes(info.quota)} available`} · nothing
              leaves this device.
            </p>
          )}
        </div>
      )}

      {restore && (
        <Modal title="Restore the device copy" onClose={() => setRestore(null)}>
          {restore === 'empty' ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              There is no readable copy on this device.
            </p>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-slate-500 dark:text-slate-400">
                This copy was saved {fmtAgo(restore.savedAt)}. A trip you already have is replaced by the copy.
              </p>
              <ImportPreview trips={restore.trips} onConfirm={confirmRestore} onCancel={() => setRestore(null)} />
            </>
          )}
        </Modal>
      )}
    </section>
  )
}
