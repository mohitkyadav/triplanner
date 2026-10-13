import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'

/* Integration tests: each one renders the whole app on a seeded device and
   drives it the way a person would. */

const KEY = 'triplanner:v1'

const plan = (id, title, time, extra = {}) => ({ id, type: 'restaurant', title, time, place: '', notes: '', ...extra })

function lisbon(overrides = {}) {
  return {
    id: 'trip-1',
    name: 'Lisbon',
    destination: 'Lisbon',
    startDate: '2031-08-01',
    endDate: '2031-08-03',
    currency: 'EUR',
    packing: [],
    days: [
      { id: 'd1', date: '2031-08-01', title: '', items: [plan('p1', 'Dinner at Ramiro', '19:00')] },
      { id: 'd2', date: '2031-08-02', title: '', items: [plan('p2', 'Lunch at Time Out', '13:00')] },
      { id: 'd3', date: '2031-08-03', title: '', items: [] },
    ],
    ...overrides,
  }
}

function openApp(trips, hash = '') {
  localStorage.setItem(KEY, JSON.stringify({ trips }))
  if (hash) history.replaceState(null, '', `/#${hash}`)
  return render(<App />)
}

const stored = () => JSON.parse(localStorage.getItem(KEY))

describe('Triplanner', () => {
  it('moves the plans with the trip when its dates change', async () => {
    const user = userEvent.setup()
    openApp([lisbon()], '/trip/trip-1')

    await user.click(screen.getByRole('button', { name: 'Edit trip' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit trip' })
    // The end date follows the start, so the trip keeps its length.
    fireEvent.change(within(dialog).getByLabelText('Start date'), { target: { value: '2031-08-08' } })
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2031-08-10')
    expect(within(dialog).getByText(/starts 7 days later/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(stored().trips[0].startDate).toBe('2031-08-08'))
    const { days } = stored().trips[0]
    expect(days.map(d => d.date)).toEqual(['2031-08-08', '2031-08-09', '2031-08-10'])
    expect(days[1].items[0].title).toBe('Lunch at Time Out')
  })

  it('reads a booking into one flight plan, placed by its time', async () => {
    const user = userEvent.setup()
    const { container } = openApp([lisbon()], '/trip/trip-1')
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:lh1178',
      'SUMMARY:Flight LH 1178 Berlin (BER) → Lisbon (LIS)',
      'DTSTART:20310801T071000',
      'DTEND:20310801T094500',
      'LOCATION:Berlin Brandenburg',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    await user.upload(container.querySelector('input[accept=".ics,text/calendar"]'), new File([ics], 'lh1178.ics'))
    const dialog = await screen.findByRole('dialog', { name: /Import booking/ })
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 plan' }))

    await waitFor(() => expect(stored().trips[0].days[0].items).toHaveLength(2))
    const [flight, dinner] = stored().trips[0].days[0].items
    expect(flight).toMatchObject({ type: 'flight', flightNo: 'LH 1178', time: '07:10', endTime: '09:45' })
    expect(flight).toMatchObject({ from: 'Berlin (BER)', to: 'Lisbon (LIS)' })
    expect(dinner.title).toBe('Dinner at Ramiro')
    expect(screen.getByText('07:10–09:45')).toBeInTheDocument()
  })

  it('keeps a shared copy next to your own trip instead of replacing it', async () => {
    const user = userEvent.setup()
    const theirs = lisbon({ name: 'Lisbon (their edits)' })
    const payload = btoa(JSON.stringify({ app: 'triplanner', version: 1, trips: [theirs] }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    openApp([lisbon()], `/share/0.${payload}`)

    const dialog = await screen.findByRole('dialog', { name: 'Shared trip' })
    expect(within(dialog).getByText(/You already have this trip/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add trip' }))

    await waitFor(() => expect(stored().trips).toHaveLength(2))
    const names = stored()
      .trips.map(t => t.name)
      .sort()
    expect(names).toEqual(['Lisbon', 'Lisbon (their edits) (copy)'])
    expect(new Set(stored().trips.map(t => t.id)).size).toBe(2)
  })

  it('takes the state another tab saved instead of overwriting it', async () => {
    openApp([lisbon()])
    expect(screen.getByText('Lisbon', { selector: 'h3' })).toBeInTheDocument()

    const fromOtherTab = JSON.stringify({ trips: [lisbon(), lisbon({ id: 'trip-2', name: 'Porto' })] })
    localStorage.setItem(KEY, fromOtherTab)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: fromOtherTab }))
    })

    expect(await screen.findByText('Porto', { selector: 'h3' })).toBeInTheDocument()
    await new Promise(r => setTimeout(r, 400)) // longer than the save delay
    expect(stored().trips).toHaveLength(2)
  })

  it('closes a dialog with the Back button and stays on the page', async () => {
    const user = userEvent.setup()
    openApp([lisbon()], '/trip/trip-1')

    await user.click(screen.getByRole('button', { name: 'Edit Dinner at Ramiro' }))
    expect(screen.getByRole('dialog', { name: 'Edit plan' })).toBeInTheDocument()

    act(() => history.back())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(location.hash).toBe('#/trip/trip-1')
    expect(screen.getByRole('heading', { level: 2, name: 'Lisbon' })).toBeInTheDocument()
  })

  it('keeps every Undo reachable after several deletes', async () => {
    const user = userEvent.setup()
    openApp([lisbon()], '/trip/trip-1')

    for (const name of ['Dinner at Ramiro', 'Lunch at Time Out']) {
      await user.click(screen.getByRole('button', { name: `Edit ${name}` }))
      await user.click(screen.getByRole('button', { name: 'Delete' }))
    }
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2)

    // Ctrl+Z undoes the latest; the earlier Undo is still there.
    await user.keyboard('{Control>}z{/Control}')
    expect(await screen.findByRole('button', { name: 'Edit Lunch at Time Out' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('button', { name: 'Edit Dinner at Ramiro' })).toBeInTheDocument()
  })
})
