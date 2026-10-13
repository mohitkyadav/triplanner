import { useEffect, useState } from 'react'

/* A new version of the app is waiting. main.jsx hears it from the service
   worker; the app shows a notice and reloads only when the user says so, so
   a form being filled in is never thrown away. */

let apply = null
const listeners = new Set()

export function setUpdateReady(fn) {
  apply = fn
  listeners.forEach(l => l())
}

export function useUpdateReady() {
  const [ready, setReady] = useState(() => apply)
  useEffect(() => {
    const sync = () => setReady(() => apply)
    listeners.add(sync)
    return () => listeners.delete(sync)
  }, [])
  return ready
}
