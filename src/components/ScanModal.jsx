import { useEffect, useRef, useState } from 'react'
import { decodeShare, makeCollector } from '../lib/share'
import ImportPreview from './ImportPreview'
import { Modal } from './ui'

// In-app QR scanner. Reads single-code shares (plain share URLs) and animated
// multi-part shares, collecting parts until the trip is complete. The camera
// stops as soon as a preview is ready.
export default function ScanModal({ onImport, onClose }) {
  const videoRef = useRef(null)
  const doneRef = useRef(false)
  const [progress, setProgress] = useState(null) // { seen, total }
  const [trips, setTrips] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (trips) return // preview showing — camera already released by cleanup
    let stream
    let raf
    let lastScan = 0
    let jsQR = null // loaded on demand — the decoder isn't part of the main bundle
    const collector = makeCollector()
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function handle(text) {
      const res = collector(text)
      if (!res) return
      if (res.payload) {
        doneRef.current = true
        decodeShare(res.payload)
          .then(t => setTrips(t))
          .catch(() => {
            doneRef.current = false
            setError('That QR code did not contain a readable trip.')
          })
      } else {
        setProgress(res)
      }
    }

    function tick(now) {
      raf = requestAnimationFrame(tick)
      // decoding every frame is wasteful — ~7 scans/second is plenty
      if (!jsQR || doneRef.current || now - lastScan < 140 || video.readyState < 2 || !video.videoWidth) return
      lastScan = now
      const scale = Math.min(1, 520 / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
      if (code?.data) handle(code.data)
    }

    async function start() {
      try {
        ;[{ default: jsQR }, stream] = await Promise.all([
          import('jsqr'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
        ])
      } catch {
        setError('Camera access is necessary to scan. Allow it and try again, or open the shared link instead.')
        return
      }
      video.srcObject = stream
      await video.play().catch(() => {})
      raf = requestAnimationFrame(tick)
    }

    start()
    return () => {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [trips])

  return (
    <Modal title={trips ? 'Shared trip' : 'Scan a shared trip'} onClose={onClose}>
      {trips ? (
        <ImportPreview trips={trips} onConfirm={() => onImport(trips)} onCancel={onClose} />
      ) : error ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{error}</p>
      ) : (
        <div className="space-y-3 pb-1">
          <div className="relative overflow-hidden rounded-2xl bg-slate-950">
            <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/70" />
            {progress && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold tabular-nums text-white">
                Part {progress.seen} of {progress.total} — keep the camera on the code
              </span>
            )}
          </div>
          <p className="text-center text-[13px] text-slate-500 dark:text-slate-400">
            Point the camera at the QR code on the other device. Animated codes take a few seconds.
          </p>
        </div>
      )}
    </Modal>
  )
}
