import { useCallback, useEffect, useState } from 'react'
import { ToastProvider } from './components/ui'
import { StoreProvider } from './lib/store'
import Home from './pages/Home'
import TripView from './pages/TripView'

function useHashRoute() {
  const [route, setRoute] = useState(() => location.hash.replace(/^#/, ''))
  useEffect(() => {
    const onChange = () => setRoute(location.hash.replace(/^#/, ''))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback(path => {
    if (path) {
      location.hash = path
    } else {
      // clear the hash without leaving a dangling '#'
      history.pushState(null, '', location.pathname + location.search)
      setRoute('')
    }
  }, [])
  return [route, navigate]
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const tripMatch = route.match(/^\/trip\/(.+)$/)

  return (
    <StoreProvider>
      <ToastProvider>
        {tripMatch ? <TripView id={tripMatch[1]} navigate={navigate} /> : <Home navigate={navigate} />}
      </ToastProvider>
    </StoreProvider>
  )
}
