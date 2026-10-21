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
  // motion: the icon's gentle loop (index.css)
  if (code === 0) return { emoji: '☀️', label: 'Clear', motion: 'wx-sun' }
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy', motion: 'wx-cloud' }
  if (code === 3) return { emoji: '☁️', label: 'Overcast', motion: 'wx-cloud' }
  if (code <= 48) return { emoji: '🌫️', label: 'Fog', motion: 'wx-fog' }
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle', motion: 'wx-rain' }
  if (code <= 67) return { emoji: '🌧️', label: 'Rain', motion: 'wx-rain' }
  if (code <= 77) return { emoji: '🌨️', label: 'Snow', motion: 'wx-snow' }
  if (code <= 82) return { emoji: '🌦️', label: 'Showers', motion: 'wx-rain' }
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers', motion: 'wx-snow' }
  return { emoji: '⛈️', label: 'Thunderstorm', motion: 'wx-storm' }
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

/* ---------- the next few hours (Trip mode, today only) ---------- */

const NOW_KEY = 'triplanner:weather-now'
const NOW_FRESH_FOR = 30 * 60 * 1000

function readNow(key) {
  try {
    return JSON.parse(localStorage.getItem(NOW_KEY))?.[key] ?? null
  } catch {
    return null
  }
}

function writeNow(key, entry) {
  try {
    localStorage.setItem(NOW_KEY, JSON.stringify({ [key]: entry }))
  } catch {
    // full storage — it is asked for again next time
  }
}

/* { temp, code, hours: [{ time: 'HH:MM', rain, code }] } — the weather now
   and for the next 12 hours at the destination, refreshed every half hour
   while `active` (the day shown is today). Same service, same switch. */
export function useWeatherNow(trip, active) {
  const [on] = useOnlineEnabled()
  const dest = (trip?.destination ?? '').trim()
  const key = dest.toLowerCase()
  const relevant = Boolean(on && active && dest)
  const [found, setFound] = useState(() => ({ key, data: readNow(key) }))

  useEffect(() => {
    if (!relevant) return
    const cached = readNow(key)
    if (cached) setFound({ key, data: cached })
    if (cached && Date.now() - cached.at < NOW_FRESH_FOR) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const place = readCache()[key]?.place ?? (await geocode(dest, ctrl.signal))
        if (!place) return
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
          '&current=temperature_2m,weather_code&hourly=precipitation_probability,weather_code' +
          '&forecast_hours=12&timezone=auto'
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) return
        const body = await res.json()
        const h = body.hourly ?? {}
        const entry = {
          at: Date.now(),
          temp: Math.round(body.current?.temperature_2m),
          code: body.current?.weather_code,
          hours: (h.time ?? []).map((t, i) => ({
            time: String(t).slice(11, 16),
            rain: h.precipitation_probability?.[i] ?? 0,
            code: h.weather_code?.[i],
          })),
        }
        writeNow(key, entry)
        setFound({ key, data: entry })
      } catch {
        // offline or the service is down — keep what we have
      }
    })()
    return () => ctrl.abort()
  }, [relevant, key, dest])

  return relevant && found.key === key ? found.data : null
}

// "🌧 rain likely around 16:00" — the first of the coming hours with a good
// chance of rain, or '' when the next hours look dry.
export function rainAhead(now) {
  const wet = now?.hours?.find(h => h.rain >= 50)
  if (!wet) return ''
  return wet === now.hours[0] ? 'rain likely now' : `rain likely around ${wet.time}`
}
