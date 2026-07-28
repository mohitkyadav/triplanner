import { useTheme } from '../lib/theme'
import { IconMonitor, IconMoon, IconSun, Segmented } from './ui'

export default function ThemeSwitcher() {
  const [pref, setPref] = useTheme()
  return (
    <div className="mx-auto w-full max-w-72">
      <Segmented
        value={pref}
        onChange={setPref}
        options={[
          { value: 'light', label: 'Light', icon: IconSun },
          { value: 'dark', label: 'Dark', icon: IconMoon },
          { value: 'system', label: 'System', icon: IconMonitor },
        ]}
      />
    </div>
  )
}
