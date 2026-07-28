import { useEffect, useState } from 'react'

const KEY = 'triplanner:theme'
const META_COLORS = { light: '#f8fafc', dark: '#020617' }

function isDark(pref) {
  return pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function applyTheme(pref) {
  const mode = isDark(pref) ? 'dark' : 'light'
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[mode])
}

// pref: 'light' | 'dark' | 'system' — persisted; 'system' tracks the OS live.
export function useTheme() {
  const [pref, setPref] = useState(() => localStorage.getItem(KEY) || 'system')
  useEffect(() => {
    localStorage.setItem(KEY, pref)
    applyTheme(pref)
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])
  return [pref, setPref]
}
