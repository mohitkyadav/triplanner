import { useCallback, useEffect, useState } from 'react'
import ShareReceive from './components/ShareReceive'
import { ToastProvider, useToast } from './components/ui'
import { StoreProvider } from './lib/store'
import Home from './pages/Home'
import Today from './pages/Today'
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

function Routes() {
  const [route, navigate] = useHashRoute()
  const toast = useToast()
  const todayMatch = route.match(/^\/trip\/([^/]+)\/today$/)
  const tripMatch = route.match(/^\/trip\/([^/]+)$/)
  const shareMatch = route.match(/^\/share\/(.+)$/)

  const onRecover = useCallback(
    count => toast(`Restored ${count} trip${count === 1 ? '' : 's'} from the copy on this device`),
    [toast],
  )

  return (
    <StoreProvider onRecover={onRecover}>
      {todayMatch ? (
        <Today id={todayMatch[1]} navigate={navigate} />
      ) : tripMatch ? (
        <TripView id={tripMatch[1]} navigate={navigate} />
      ) : (
        <Home navigate={navigate} />
      )}
      {shareMatch && <ShareReceive payload={shareMatch[1]} navigate={navigate} />}
    </StoreProvider>
  )
}

export default function App() {
  // The toast provider sits outside the store, so the store can report a
  // recovery through it.
  return (
    <ToastProvider>
      <Routes />
    </ToastProvider>
  )
}
