import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { setUpdateReady } from './lib/update'
import './index.css'

// A new version waits until the user taps Reload (see UpdateNotice).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => setUpdateReady(() => updateSW(true)),
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
