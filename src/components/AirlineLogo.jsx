import { useState } from 'react'
import { airlineLogoUrl } from '../lib/airlines'

// Airline logo with a graceful fallback: while the image hasn't loaded (or
// can't — offline, unknown code) the `fallback` node shows instead. Logos sit
// on a white chip so dark liveries stay readable in dark mode.
export default function AirlineLogo({ iata, name, className = 'size-10 rounded-xl', fallback }) {
  const [state, setState] = useState('loading') // loading | ok | error
  if (state === 'error') return fallback
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden ${className}`}>
      {state === 'loading' && <span className="absolute inset-0">{fallback}</span>}
      <img
        src={airlineLogoUrl(iata)}
        alt={`${name} logo`}
        loading="lazy"
        draggable={false}
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        className={`relative size-full bg-white object-contain p-0.5 ring-1 ring-slate-200 ${
          state === 'ok' ? '' : 'invisible'
        }`}
      />
    </span>
  )
}
