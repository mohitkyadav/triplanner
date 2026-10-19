import { useCallback, useEffect, useRef, useState } from 'react'
import Inbox from './components/Inbox'
import ShareReceive from './components/ShareReceive'
import { ToastProvider, btnChipBrand, useToast } from './components/ui'
import { transition } from './lib/motion'
import { StoreProvider, useStore } from './lib/store'
import { SyncEngine, useSignInReturn } from './lib/sync'
import { currentTrip } from './lib/trips'
import { useUpdateReady } from './lib/update'
import Home from './pages/Home'
import Today from './pages/Today'
import TripView from './pages/TripView'

// How deep a page sits: home, a trip, its trip mode.
const depth = route => (route.match(/^\/trip\/[^/]+(\/today)?$/) ? (route.endsWith('/today') ? 2 : 1) : 0)

function useHashRoute() {
  const [route, setRoute] = useState(() => location.hash.replace(/^#/, ''))
  const current = useRef(route)

  /* A page change animates: deeper pages slide in from the side, Back slides
     them away, and a trip card grows into its page (see lib/motion.js). */
  const go = useCallback(path => {
    const from = current.current
    if (path === from) return
    current.current = path
    transition(() => setRoute(path), depth(path) < depth(from) ? 'back' : 'page')
  }, [])

  useEffect(() => {
    const onChange = () => go(location.hash.replace(/^#/, ''))
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [go])
  /* A page change made from inside a dialog replaces the dialog's history
     entry, so Back from the new page does not land on a closed dialog. */
  const navigate = useCallback(
    (path, { replace = false } = {}) => {
      const url = path ? `#${path}` : location.pathname + location.search // no dangling '#'
      if (replace || history.state?.dialog) history.replaceState(null, '', url)
      else history.pushState(null, '', url)
      go(path)
    },
    [go],
  )
  return [route, navigate]
}

// "Today's trip" (an app shortcut): the trip under way, else the next one.
function TodayShortcut({ navigate }) {
  const { state } = useStore()
  const trip = currentTrip(state.trips)
  useEffect(() => {
    navigate(trip ? `/trip/${trip.id}/today` : '', { replace: true })
  }, [trip, navigate])
  return null
}

function UpdateNotice() {
  const apply = useUpdateReady()
  if (!apply) return null
  return (
    <div className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-60 flex justify-center px-4">
      <div className="anim-toast flex items-center gap-3 rounded-full bg-slate-900 py-1.5 pl-4 pr-1.5 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-slate-900">
        A new version is ready
        <button className={btnChipBrand} onClick={() => apply()}>
          Reload
        </button>
      </div>
    </div>
  )
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
  useSignInReturn(useCallback(why => toast(`That sign-in link did not work: ${why}. Ask for a new one.`), [toast]))

  return (
    <StoreProvider onRecover={onRecover}>
      <SyncEngine />
      {route === '/today' ? (
        <TodayShortcut navigate={navigate} />
      ) : todayMatch ? (
        <Today id={todayMatch[1]} navigate={navigate} />
      ) : tripMatch ? (
        <TripView id={tripMatch[1]} navigate={navigate} />
      ) : (
        <Home navigate={navigate} />
      )}
      {shareMatch && <ShareReceive payload={shareMatch[1]} navigate={navigate} />}
      <Inbox route={route} navigate={navigate} />
      <UpdateNotice />
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
