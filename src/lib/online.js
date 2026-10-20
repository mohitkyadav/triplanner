import { useEffect, useState } from 'react'

/* One switch for everything that asks a service on the internet: the
   weather (Open-Meteo), the map (OpenFreeMap) and place search (Photon).
   Off, the app sends nothing anywhere and those features hide. The stored
   key predates the maps, when the weather was the only thing online. */

const PREF_KEY = 'triplanner:weather-off'
const listeners = new Set()

export const onlineEnabled = () => {
  try {
    return localStorage.getItem(PREF_KEY) !== '1'
  } catch {
    return true
  }
}

export function setOnlineEnabled(on) {
  try {
    if (on) localStorage.removeItem(PREF_KEY)
    else localStorage.setItem(PREF_KEY, '1')
  } catch {
    // storage unavailable — the setting lasts for this visit only
  }
  listeners.forEach(fn => fn())
}

export function useOnlineEnabled() {
  const [on, setOn] = useState(onlineEnabled)
  useEffect(() => {
    const sync = () => setOn(onlineEnabled())
    listeners.add(sync)
    return () => listeners.delete(sync)
  }, [])
  return [on, setOnlineEnabled]
}
