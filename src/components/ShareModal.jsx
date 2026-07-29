import { useEffect, useRef, useState } from 'react'
import { encodeTripShare, qrFrames, shareUrl } from '../lib/share'
import { btnGhost, btnPrimary, IconCopy, IconShare, Modal, useToast } from './ui'

// Shows a QR code plus a copyable link for one trip. Small trips fit one QR
// that any camera app can open. Large trips animate through numbered parts,
// which the built-in scanner (Home → scan icon) collects — so QR sharing
// works for any trip size.
export default function ShareModal({ trip, onClose }) {
  const toast = useToast()
  const [share, setShare] = useState(null) // { url, frames }
  const [error, setError] = useState(null)
  const [frame, setFrame] = useState(0)
  const canvasRef = useRef(null)

  useEffect(() => {
    let alive = true
    encodeTripShare(trip)
      .then(payload => alive && setShare({ url: shareUrl(payload), frames: qrFrames(payload) }))
      .catch(() => alive && setError('The share data could not be prepared.'))
    return () => {
      alive = false
    }
  }, [trip])

  const frames = share?.frames ?? []
  const animated = frames.length > 1

  useEffect(() => {
    if (!animated) return
    const t = setInterval(() => setFrame(f => (f + 1) % frames.length), 650)
    return () => clearInterval(t)
  }, [animated, frames.length])

  useEffect(() => {
    if (!share || !canvasRef.current) return
    let stale = false
    // loaded on demand — the QR library isn't part of the main bundle
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (stale || !canvasRef.current) return
        return QRCode.toCanvas(canvasRef.current, frames[frame % frames.length], {
          errorCorrectionLevel: animated ? 'L' : 'M',
          width: 264,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        })
      })
      .catch(() => setError('The QR code could not be drawn.'))
    return () => {
      stale = true
    }
  }, [share, frame, frames, animated])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(share.url)
      toast('Link copied')
    } catch {
      toast('Copy failed — long-press the link instead')
    }
  }

  function nativeShare() {
    navigator.share({ title: trip.name, url: share.url }).catch(() => {})
  }

  return (
    <Modal title={`Share “${trip.name}”`} onClose={onClose}>
      {error ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{error}</p>
      ) : !share ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Preparing the QR code…</p>
      ) : (
        <div className="space-y-4 pb-1">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <canvas ref={canvasRef} className="block size-66 max-w-full" />
            </div>
            {animated ? (
              <>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  Part {(frame % frames.length) + 1} / {frames.length}
                </span>
                <p className="max-w-sm text-center text-[13px] text-slate-500 dark:text-slate-400">
                  This trip is too big for one QR code, so the code animates. On the other phone, open
                  Triplanner, tap the scan button, and hold the camera here until all parts arrive.
                </p>
              </>
            ) : (
              <p className="max-w-sm text-center text-[13px] text-slate-500 dark:text-slate-400">
                Scan with any camera app, or with the scan button in Triplanner.
              </p>
            )}
          </div>

          <div className="flex justify-center gap-2">
            <button className={btnGhost} onClick={copyLink}>
              <IconCopy className="size-4" />
              Copy link
            </button>
            {typeof navigator.share === 'function' && (
              <button className={btnPrimary} onClick={nativeShare}>
                <IconShare className="size-4" />
                Share link
              </button>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            The whole trip travels inside the link itself — nothing is uploaded to a server.
          </p>
        </div>
      )}
    </Modal>
  )
}
