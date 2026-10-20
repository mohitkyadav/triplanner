import { useEffect, useState } from 'react'
import { addDaysISO, todayISO } from './dates'
import { useOnlineEnabled } from './online'

/* The forecast for the days of a trip, from Open-Meteo — no API key, and the
   only thing sent is the destination name and its coordinates. Forecasts
   reach 16 days ahead, so only days in that window get one. The last answer
   is kept, so the forecast still shows offline.

   It goes off with the other online features (lib/online.js); then nothing
   is fetched. */

const CACHE_KEY = 'triplanner:weather'
const FRESH_FOR = 3 * 60 * 60 * 1000
const WINDOW_DAYS = 15

/* ---------- WMO weather codes ---------- */

export function weatherIcon(code) {
  if (code === 0) return { emoji: '☀️', label: 'Clear' }
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', label: 'Overcast' }
  if (code <= 48) return { emoji: '🌫️', label: 'Fog' }
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle' }
  if (code <= 67) return { emoji: '🌧️', label: 'Rain' }
  if (code <= 77) return { emoji: '🌨️', label: 'Snow' }
  if (code <= 82) return { emoji: '🌦️', label: 'Showers' }
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers' }
  return { emoji: '⛈️', label: 'Thunderstorm' }
}

/* ---------- cache ---------- */

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

function writeCache(key, entry) {
  try {
    const all = readCache()
    all[key] = entry
    // keep the newest few destinations only
    const keep = Object.entries(all)
      .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
      .slice(0, 12)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    // full storage — the forecast is a nice-to-have
  }
}

/* ---------- fetching ---------- */

async function geocode(name, signal) {
  // "Lisbon, Portugal" finds nothing as one name; the city alone does.
  for (const q of [...new Set([name, name.split(',')[0].trim()])]) {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&name=${encodeURIComponent(q)}`,
      { signal },
    )
    if (!res.ok) continue
    const hit = (await res.json())?.results?.[0]
    if (hit) return { lat: hit.latitude, lon: hit.longitude, name: hit.name, timezone: hit.timezone }
  }
  return null
}

async function forecast(place, signal) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=16'
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('forecast unavailable')
  const d = (await res.json())?.daily
  const days = {}
  ;(d?.time ?? []).forEach((date, i) => {
    days[date] = {
      code: d.weather_code?.[i],
      max: Math.round(d.temperature_2m_max?.[i]),
      min: Math.round(d.temperature_2m_min?.[i]),
      rain: d.precipitation_probability_max?.[i] ?? null,
    }
  })
  return days
}

const inWindow = (trip, today) => {
  const last = addDaysISO(today, WINDOW_DAYS)
  return trip.days.some(d => d.date && d.date >= today && d.date <= last)
}

/* { [date]: { code, max, min, rain } } for the trip, or null. Shows the
   cached forecast at once and refreshes it when it is old and the device is
   online. */
export function useWeather(trip) {
  const [on] = useOnlineEnabled()
  const dest = (trip?.destination ?? '').trim()
  const key = dest.toLowerCase()
  const relevant = Boolean(on && dest && trip && inWindow(trip, todayISO(trip.timeZone)))
  const [days, setDays] = useState(() => (relevant ? (readCache()[key]?.days ?? null) : null))

  useEffect(() => {
    if (!relevant) {
      setDays(null)
      return
    }
    const cached = readCache()[key]
    setDays(cached?.days ?? null)
    if (cached && Date.now() - cached.at < FRESH_FOR) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const place = cached?.place ?? (await geocode(dest, ctrl.signal))
        if (!place) return
        const fresh = await forecast(place, ctrl.signal)
        writeCache(key, { at: Date.now(), place, days: fresh })
        setDays(fresh)
      } catch {
        // offline or the service is down — keep what we have
      }
    })()
    return () => ctrl.abort()
  }, [relevant, key, dest])

  return days
}
