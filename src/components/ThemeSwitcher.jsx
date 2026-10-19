import { transition } from '../lib/motion'
import { applyTheme, useTheme } from '../lib/theme'
import { IconMonitor, IconMoon, IconSun, Segmented } from './ui'

export default function ThemeSwitcher() {
  const [pref, setPref] = useTheme()

  // The new theme spreads out in a circle from the button that was tapped.
  function choose(value, e) {
    const box = e?.currentTarget.getBoundingClientRect()
    if (box) {
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      const root = document.documentElement.style
      root.setProperty('--reveal-x', `${x}px`)
      root.setProperty('--reveal-y', `${y}px`)
      root.setProperty('--reveal-r', `${r}px`)
    }
    transition(() => {
      applyTheme(value)
      setPref(value)
    }, 'theme')
  }

  return (
    <div className="mx-auto w-full max-w-72">
      <Segmented
        value={pref}
        onChange={choose}
        options={[
          { value: 'light', label: 'Light', icon: IconSun },
          { value: 'dark', label: 'Dark', icon: IconMoon },
          { value: 'system', label: 'System', icon: IconMonitor },
        ]}
      />
    </div>
  )
}
