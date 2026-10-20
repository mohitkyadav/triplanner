import { useEffect, useState } from 'react'

/* The looks the day map comes in. Every one is free and keyless: the vector
   styles are OpenFreeMap's; Satellite is EOX's Sentinel-2 cloudless imagery
   (about 10 m a pixel — neighbourhoods, coast and parks, not single
   buildings) with OpenFreeMap's place and street names on top. */

const OFM = 'https://tiles.openfreemap.org/styles/'
const SATELLITE_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'
const SATELLITE_CREDIT =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024)'

export const MAP_STYLES = [
  { id: 'auto', label: 'Auto', hint: 'Streets, dark with the app' },
  { id: 'liberty', label: 'Streets' },
  { id: 'positron', label: 'Light' },
  { id: 'bright', label: 'Bright' },
  { id: 'dark', label: 'Dark' },
  { id: 'fiord', label: 'Night blue' },
  { id: 'satellite', label: 'Satellite', hint: 'Sharp to neighbourhood level' },
]

// Whether a style draws dark (pins and the route line adapt to it).
export const isDarkStyle = (id, appDark) =>
  id === 'dark' || id === 'fiord' || id === 'satellite' || (id === 'auto' && appDark)

/* What MapLibre gets for a style: a URL, or for Satellite a style built from
   Streets — its sources and names, under the imagery. */
export async function resolveStyle(id, appDark) {
  if (id === 'auto') return OFM + (appDark ? 'dark' : 'liberty')
  if (id !== 'satellite') return OFM + (MAP_STYLES.some(s => s.id === id) ? id : 'liberty')
  const res = await fetch(OFM + 'liberty')
  if (!res.ok) throw new Error('map style unavailable')
  const base = await res.json()
  return {
    ...base,
    sources: {
      ...base.sources,
      satellite: {
        type: 'raster',
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 15,
        attribution: SATELLITE_CREDIT,
      },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'satellite' },
      // names only, light on dark so they read over the imagery
      ...base.layers
        .filter(l => l.type === 'symbol' && l.layout?.['text-field'])
        .map(({ layout: { 'icon-image': _icon, ...layout }, ...l }) => ({
          ...l,
          layout,
          paint: { ...l.paint, 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.4 },
        })),
    ],
  }
}

/* The chosen look, the same for every map and kept on this device. */
const KEY = 'triplanner:map-style'
const listeners = new Set()
const read = () => {
  try {
    const id = localStorage.getItem(KEY)
    return MAP_STYLES.some(s => s.id === id) ? id : 'auto'
  } catch {
    return 'auto'
  }
}

export function useMapStyle() {
  const [id, setId] = useState(read)
  useEffect(() => {
    const sync = () => setId(read())
    listeners.add(sync)
    return () => listeners.delete(sync)
  }, [])
  const choose = next => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage unavailable — the choice lasts for this visit
    }
    listeners.forEach(fn => fn())
  }
  return [id, choose]
}
