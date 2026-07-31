import { placeLinks } from '../lib/maps'
import { IconApple, IconGoogle, IconMapPin } from './ui'

// How a plan reaches the map. The shape says what the app knows:
//   one labelled button  — the plan carries a link to an exact place
//   two icon buttons     — the app has to search, so you pick the provider
// Nothing shows when there is no name and no text to search for.

const META = {
  google: { icon: IconGoogle, label: 'Google Maps', short: 'Google' },
  apple: { icon: IconApple, label: 'Apple Maps', short: 'Apple' },
  other: { icon: IconMapPin, label: 'Open link', short: 'Link' },
}

const stop = e => e.stopPropagation()

export default function MapLinks({ trip, item, hero = false }) {
  const links = placeLinks(trip, item)
  if (!links) return null

  if (links.kind === 'link') {
    const meta = META[links.provider]
    const cls = hero
      ? 'inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
      : 'inline-flex items-center gap-1 font-semibold text-brand-600 transition hover:underline dark:text-brand-300'
    return (
      <a href={links.url} target="_blank" rel="noopener noreferrer" onClick={stop} className={cls}>
        <meta.icon className={hero ? 'size-4' : 'size-3.5'} />
        {hero ? meta.short : meta.label}
      </a>
    )
  }

  // The chip keeps the row's height; the padding around it makes the tap
  // target big enough for a thumb.
  const chip = hero
    ? 'grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 transition group-hover/map:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
    : 'grid size-7 place-items-center rounded-md text-slate-400 ring-1 ring-slate-200 transition group-hover/map:bg-slate-100 group-hover/map:text-brand-600 dark:text-slate-500 dark:ring-slate-700'
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {['google', 'apple'].map(provider => {
        const meta = META[provider]
        return (
          <a
            key={provider}
            href={links[provider]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            className="group/map -my-1.5 shrink-0 py-1.5"
            aria-label={`Search ${links.query} in ${meta.label}`}
            title={`${links.query} — ${meta.label}`}
          >
            <span className={chip}>
              <meta.icon className={hero ? 'size-4' : 'size-3.5'} />
            </span>
          </a>
        )
      })}
    </span>
  )
}
