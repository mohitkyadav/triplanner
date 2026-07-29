import { useEffect, useState } from 'react'

// Installation state, for the backup card. An installed app keeps its data:
// browsers only clear the storage of pages the user did not install, and iOS
// Safari removes it after 7 days of no use. The install prompt event fires
// once and cannot be replayed, so it is captured at module load and kept.

let promptEvent = null
const listeners = new Set()
const emit = () => listeners.forEach(fn => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    promptEvent = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    emit()
  })
}

export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    navigator.standalone === true)

// { installed, canPrompt, prompt } — canPrompt is false on browsers without
// the prompt event (Safari), where the user must use the share menu instead.
export function useInstall() {
  const [state, setState] = useState(() => ({ installed: isInstalled(), canPrompt: Boolean(promptEvent) }))

  useEffect(() => {
    const sync = () => setState({ installed: isInstalled(), canPrompt: Boolean(promptEvent) })
    listeners.add(sync)
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener('change', sync)
    sync()
    return () => {
      listeners.delete(sync)
      mq.removeEventListener('change', sync)
    }
  }, [])

  async function prompt() {
    if (!promptEvent) return false
    try {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') {
        promptEvent = null
        emit()
      }
      return outcome === 'accepted'
    } catch {
      return false
    }
  }

  return { ...state, prompt }
}
