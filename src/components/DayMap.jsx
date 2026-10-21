import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isDarkStyle, resolveStyle } from '../lib/mapStyles'

/* The day on a real map: MapLibre with keyless tiles (lib/mapStyles.js).
   Loaded only when a map first opens — it is the biggest part of the app.

   pins: [{ id, n, title, lat, lng, state: 'open'|'done'|'skipped'|'now', guess }]
   in the day's order; a dashed line joins the ones still on the plan.

   The map draws into an element of its own, which moves into `host` — so
   going full screen moves the same map instead of loading a second one. */

const ROUTE = 'day-route'
const appDark = () => document.documentElement.dataset.theme === 'dark'

const CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
const WORD = { done: 'done', skipped: 'skipped', now: 'now', open: '' }

// MapLibre keeps its own classes on the element (they position it), so only
// the map-pin ones are swapped.
function paint(el, pin, selected) {
  el.classList.remove(...[...el.classList].filter(c => c.startsWith('map-pin')))
  el.classList.add('map-pin', `map-pin--${pin.state}`)
  el.classList.toggle('map-pin--guess', pin.guess)
  el.classList.toggle('map-pin--selected', selected)
  // the trip map colours each day's open pins its own way
  el.style.background =
    pin.color && (pin.state === 'open' || pin.state === 'now')
      ? pin.color
      : (el.innerHTML = pin.state === 'done' ? CHECK : `<span>${pin.n}</span>`)
  el.setAttribute('aria-label', [`${pin.n}. ${pin.title}`, WORD[pin.state]].filter(Boolean).join(', '))
}

// Only once the style is in: before that (and while another style loads)
// the map has no place to put the line.
function drawRoute(map, pins) {
  if (!map.styleReady) return
  // one line per group (a day), in that day's colour when it has one
  const groups = new Map()
  for (const p of pins) {
    if (p.state === 'skipped') continue
    const key = p.group ?? ''
    if (!groups.has(key)) groups.set(key, { color: p.color, coordinates: [] })
    groups.get(key).coordinates.push([p.lng, p.lat])
  }
  const data = {
    type: 'FeatureCollection',
    features: [...groups.values()].map(g => ({
      type: 'Feature',
      properties: g.color ? { color: g.color } : {},
      geometry: { type: 'LineString', coordinates: g.coordinates },
    })),
  }
  const source = map.getSource(ROUTE)
  if (source) return source.setData(data)
  map.addSource(ROUTE, { type: 'geojson', data })
  map.addLayer({
    id: ROUTE,
    type: 'line',
    source: ROUTE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], map.darkStyle ? '#7fdccf' : '#1a7a72'],
      'line-width': 3,
      'line-opacity': 0.85,
      'line-dasharray': [1.2, 1.6],
    },
  })
}

// Frames the pins; with none, the destination; with neither, the world.
function frame(map, pins, center, animate) {
  if (pins.length > 1) {
    const bounds = new maplibregl.LngLatBounds()
    pins.forEach(p => bounds.extend([p.lng, p.lat]))
    map.fitBounds(bounds, { padding: 56, maxZoom: 15.5, animate })
  } else if (pins.length === 1) {
    map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 15, animate })
  } else if (center) {
    map.easeTo({ center: [center.lng, center.lat], zoom: 12, animate })
  }
}

/* host: the element the map shows in. focusOffset: how far above the middle
   a picked pin is brought, clear of a card floating over the map. */
export default function DayMap({ pins, center, selectedId, onSelect, styleId = 'auto', host, focusOffset = 0 }) {
  const holder = useRef(null)
  if (!holder.current) {
    holder.current = document.createElement('div')
    holder.current.style.cssText = 'position:absolute;inset:0'
  }
  const mapRef = useRef(null)
  const markers = useRef(new Map()) // id → { marker, el }
  const latest = useRef({ pins, onSelect })
  latest.current = { pins, onSelect }
  const [failed, setFailed] = useState(false)
  const [dark, setDark] = useState(appDark)

  // The map goes where it is shown — inline, or full screen.
  useLayoutEffect(() => {
    host?.appendChild(holder.current)
    mapRef.current?.resize()
  }, [host])

  useEffect(() => {
    let map
    try {
      map = new maplibregl.Map({
        container: holder.current,
        center: [0, 20],
        zoom: 1.5,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      })
    } catch {
      // no WebGL on this device
      setFailed(true)
      return
    }
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    // Where you are, from the device (nothing is sent anywhere); tap again
    // to keep following.
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        fitBoundsOptions: { maxZoom: 16 },
      }),
      'top-right',
    )
    map.on('click', () => latest.current.onSelect(null))
    // The credits fold into their ⓘ button once the map is up, so they do
    // not cover a small map.
    map.once('load', () =>
      holder.current.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'),
    )
    map.on('style.load', () => {
      map.styleReady = true
      drawRoute(map, latest.current.pins)
    })
    mapRef.current = map

    // The app's theme, for the Auto style.
    const watch = new MutationObserver(() => setDark(appDark()))
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    // The map's box, when it grows or shrinks.
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(holder.current)

    const pinMarkers = markers.current
    const el = holder.current
    return () => {
      watch.disconnect()
      resize.disconnect()
      pinMarkers.clear()
      map.remove()
      el.remove()
      mapRef.current = null
    }
  }, [])

  // The look: on the first draw, and when it or the app's theme changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let current = true
    resolveStyle(styleId, dark)
      .then(style => {
        if (!current) return
        map.styleReady = false
        map.darkStyle = isDarkStyle(styleId, dark)
        map.setStyle(style, { diff: false })
      })
      .catch(() => {
        // Satellite needs the Streets style to build on; offline before it
        // was ever loaded, stay with what shows.
      })
    return () => {
      current = false
    }
  }, [styleId, dark])

  // Pins: added, moved, repainted, removed.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set()
    for (const pin of pins) {
      seen.add(pin.id)
      let entry = markers.current.get(pin.id)
      if (!entry) {
        const el = document.createElement('button')
        el.type = 'button'
        el.addEventListener('click', e => {
          e.stopPropagation()
          latest.current.onSelect(pin.id)
        })
        entry = { el, marker: new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map) }
        markers.current.set(pin.id, entry)
      }
      entry.marker.setLngLat([pin.lng, pin.lat])
      paint(entry.el, pin, pin.id === selectedId)
    }
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue
      entry.marker.remove()
      markers.current.delete(id)
    }
    drawRoute(map, pins)
  }, [pins, selectedId])

  // A picked pin comes into view, above whatever floats over the map.
  useEffect(() => {
    const map = mapRef.current
    const pin = latest.current.pins.find(p => p.id === selectedId)
    if (!map || !pin) return
    map.easeTo({ center: [pin.lng, pin.lat], offset: [0, -focusOffset], duration: 450 })
  }, [selectedId, focusOffset])

  // Framing: when the set of places changes (another day, a new spot), not
  // when a plan is only marked done.
  const placesKey = pins.map(p => `${p.id}@${p.lat},${p.lng}`).join('|')
  const framed = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    frame(map, latest.current.pins, center, framed.current)
    framed.current = true
  }, [placesKey, center])

  if (failed) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        This device cannot draw the map.
      </div>
    )
  }
  return null
}
