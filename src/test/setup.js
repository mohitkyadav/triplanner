import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// What jsdom leaves out.
window.matchMedia ??= query => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})
Element.prototype.scrollIntoView ??= function () {}

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  // No test reaches the network (the weather would).
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline in tests'))),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
