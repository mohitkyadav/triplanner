import { useEffect, useState } from 'react'
import { decodeShare } from '../lib/share'
import { useStore } from '../lib/store'
import ImportPreview from './ImportPreview'
import { Modal, useToast } from './ui'

// Handles opened share links (#/share/<payload>): decode, preview, import.
export default function ShareReceive({ payload, navigate }) {
  const { dispatch } = useStore()
  const toast = useToast()
  const [trips, setTrips] = useState(null)
  const [error, setError] = useState(null)
  const close = () => navigate('')

  useEffect(() => {
    let alive = true
    decodeShare(payload)
      .then(t => alive && setTrips(t))
      .catch(() => alive && setError('This link does not contain a readable trip. Ask the sender for a new link.'))
    return () => {
      alive = false
    }
  }, [payload])

  function confirm() {
    dispatch({ type: 'data/import', trips })
    toast(`Added “${trips[0].name}”`)
    navigate(`/trip/${trips[0].id}`)
  }

  return (
    <Modal title="Shared trip" onClose={close}>
      {error ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{error}</p>
      ) : !trips ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Reading the shared trip…</p>
      ) : (
        <ImportPreview trips={trips} onConfirm={confirm} onCancel={close} />
      )}
    </Modal>
  )
}
