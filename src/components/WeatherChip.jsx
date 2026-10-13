import { weatherIcon } from '../lib/weather'

// "🌤️ 24° / 15°" for one day's forecast; nothing without one.
export default function WeatherChip({ day, className = '' }) {
  if (!day || !Number.isFinite(day.max)) return null
  const icon = weatherIcon(day.code)
  const rain = day.rain >= 30 ? ` · ${day.rain}% rain` : ''
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400 ${className}`}
      title={`${icon.label}, ${day.max}° / ${day.min}°${rain}`}
    >
      <span aria-hidden="true">{icon.emoji}</span>
      <span>
        {day.max}°<span className="font-medium text-slate-400 dark:text-slate-500"> / {day.min}°</span>
      </span>
      <span className="sr-only">{icon.label}</span>
    </span>
  )
}
