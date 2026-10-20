import { useEffect, useState } from 'react'
import { onlineEnabled, useOnlineEnabled } from './online'

/* Where plans are, for the day map. A plan keeps its spot as
   `geo: { lat, lng, label?, guess? }`, so the map works offline and the spot
   syncs with the trip.

   Spots come from, in order of trust:
   - a maps link pasted as the plan's place (the coordinates are in the URL),
   - a place picked from Photon's suggestions (photon.komoot.io — no key; it
     sees only what is typed, plus the trip's area to rank nearby places
     first),
   - a best guess for plans saved before the map existed: Photon's top hit
     near the destination, marked `guess` until someone picks the place.
   All of it goes off with the other online features (lib/online.js). */

const PHOTON = 'https://photon.komoot.io/api/'
const CACHE_KEY = 'triplanner:places'
const GUESS_RADIUS_KM = 60
const TYPE_WAIT_MS = 400

const valid = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng)

const point = (lat, lng) => {
  const p = { lat: Number(lat), lng: Number(lng) }
  return valid(p.lat, p.lng) ? p : null
}

/* The coordinates a maps link points at, or null. Google place pages carry
   the place as !3d<lat>!4d<lng> (the @lat,lng part is only the view);
   search and directions links carry "lat,lng" in a parameter; Apple uses
   ll= or q=; OpenStreetMap mlat/mlon or #map=zoom/lat/lng. Short links
   (maps.app.goo.gl) hold no coordinates and give null. */
export function coordsFromLink(text) {
  let url
  try {
    url = new URL(String(text ?? '').trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const href = decodeURIComponent(url.href)

  const place = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (place) return point(place[1], place[2])

  const pair = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  for (const key of ['q', 'query', 'll', 'sll', 'daddr', 'destination', 'center']) {
    const m = url.searchParams.get(key)?.match(pair)
    if (m) return point(m[1], m[2])
  }
  const mlat = url.searchParams.get('mlat')
  if (mlat != null) return point(mlat, url.searchParams.get('mlon'))
  const osm = url.hash.match(/map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/)
  if (osm) return point(osm[1], osm[2])
  const view = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  return view ? point(view[1], view[2]) : null
}

export function distanceKm(a, b) {
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/* ---------- Photon ---------- */

// "MAAT - Tejo Power Station" · "Passeio Carlos do Carmo, Lisbon"
function toPlace(feature) {
  const p = feature.properties ?? {}
  const [lng, lat] = feature.geometry?.coordinates ?? []
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const area = p.city || p.town || p.village || p.district || p.county || p.state
  const name = p.name || street || area || p.country || ''
  const detail = [street !== name && street, area !== name && area, !area && p.country].filter(Boolean).join(', ')
  return { name, detail, lat, lng }
}

async function photon(params, signal) {
  const url = `${PHOTON}?${new URLSearchParams(params)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Photon answered ${res.status}`)
  const body = await res.json()
  return (body?.features ?? []).map(toPlace).filter(p => p.name && valid(p.lat, p.lng))
}

const near = center => (center ? { lat: String(center.lat), lon: String(center.lng) } : {})

const NEARBY_KM = 150

/* Places matching `text`, nearest to `center` first. With places near the
   destination, far ones ("Time Out Market, New York") are left out. */
export async function searchPlaces(text, center, signal) {
  const places = await photon({ q: text, limit: '6', ...near(center) }, signal)
  if (!center) return places.slice(0, 5)
  const nearby = places.filter(p => distanceKm(center, p) <= NEARBY_KM)
  return (nearby.length ? nearby : places).slice(0, 5)
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function remember(key, value) {
  try {
    const cache = readCache()
    cache[key] = value
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // storage full — the next visit asks again
  }
}

// The middle of the trip's destination ("Lisbon"), or null. Kept for good.
export async function destinationCenter(destination, signal) {
  const name = String(destination ?? '').trim()
  if (!name) return null
  const key = `dest:${name.toLowerCase()}`
  const cache = readCache()
  if (key in cache) return cache[key]
  const [hit] = await photon({ q: name.split(',')[0], limit: '1', osm_tag: 'place' }, signal)
  const center = hit ? { lat: hit.lat, lng: hit.lng } : null
  remember(key, center)
  return center
}

export function useDestinationCenter(destination) {
  const [on] = useOnlineEnabled()
  const name = String(destination ?? '').trim()
  const [found, setFound] = useState(() => ({ name, center: readCache()[`dest:${name.toLowerCase()}`] ?? null }))

  useEffect(() => {
    if (!on || !name) return
    const ctrl = new AbortController()
    destinationCenter(name, ctrl.signal)
      .then(center => setFound({ name, center }))
      .catch(() => {})
    return () => ctrl.abort()
  }, [on, name])

  return found.name === name ? found.center : null
}

/* Suggestions for what is being typed, once the typing pauses:
   { places, searching }. Photon can take a few seconds, so the last
   suggestions stay up while a newer search runs. */
export function usePlaceSearch(text, center) {
  const [on] = useOnlineEnabled()
  const q = String(text ?? '').trim()
  const active = on && q.length >= 3 && !/^https?:\/\//i.test(q)
  const [found, setFound] = useState({ q: '', places: [] })
  // by value: the destination's middle arriving again is not a new search
  const lat = center?.lat
  const lng = center?.lng

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    const near = lat != null ? { lat, lng } : null
    const timer = setTimeout(() => {
      searchPlaces(q, near, ctrl.signal)
        .then(places => setFound({ q, places }))
        .catch(() => {})
    }, TYPE_WAIT_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [active, q, lat, lng])

  if (!active) return { places: [], searching: false }
  return { places: found.places, searching: found.q !== q }
}

/* ---------- best guesses for plans saved before the map ---------- */

// What to search for: the plan's own place text, else its name.
export function placeText(item) {
  const own = String(item?.place ?? '').trim()
  return own && !/^https?:\/\//i.test(own) ? own : String(item?.title ?? '').trim()
}

/* A spot for a plan that has none: from its link, else Photon's top hit
   within reach of the destination. Null when nothing fits. */
export async function guessSpot(item, center, signal) {
  const linked = coordsFromLink(item.place)
  if (linked) return linked
  const text = placeText(item)
  if (!text || !onlineEnabled()) return null
  const [hit] = await searchPlaces(text, center, signal)
  if (!hit || (center && distanceKm(center, hit) > GUESS_RADIUS_KM)) return null
  return { lat: hit.lat, lng: hit.lng, label: [hit.name, hit.detail].filter(Boolean).join(', '), guess: true }
}
