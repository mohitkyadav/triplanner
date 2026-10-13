/* Renders the install-prompt screenshots the manifest lists
   (public/screenshots/*.png) from a demo trip, using the Chrome installed on
   this machine. Run `npm run build` first, then `npm run screenshots`.
   Set CHROME_PATH if Chrome lives somewhere else. */
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = new URL('../public/screenshots/', import.meta.url).pathname

const pad = n => String(n).padStart(2, '0')
const day = offset => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
let n = 0
const plan = (type, title, time, extra = {}) => ({ id: `p${++n}`, type, title, time, place: '', notes: '', ...extra })

// A trip under way: yesterday it started, today is day 2.
const trip = {
  id: 'demo',
  name: 'Summer in Portugal',
  destination: 'Lisbon',
  startDate: day(-1),
  endDate: day(3),
  currency: 'EUR',
  timeZone: '',
  travellers: [],
  rates: {},
  budget: 1800,
  packing: [
    { id: 'k1', text: 'Passport', done: true },
    { id: 'k2', text: 'Sunscreen', done: false },
  ],
  days: [
    {
      id: 'd1',
      date: day(-1),
      title: 'Arrival',
      items: [
        plan('flight', '', '07:10', {
          flightNo: 'LH 1178',
          from: 'BER',
          to: 'LIS',
          endTime: '09:45',
          cost: 189,
          paid: true,
        }),
        plan('hotel', 'Memmo Alfama', '15:00', { hotelAction: 'check-in', cost: 640, paid: true }),
        plan('restaurant', 'Cervejaria Ramiro', '20:00', { notes: 'Garlic prawns, then the steak sandwich', cost: 70 }),
      ],
    },
    {
      id: 'd2',
      date: day(0),
      title: 'Belém & Alfama',
      items: [
        plan('cafe', 'Pastéis de Belém', '09:00', { endTime: '09:45', cost: 12 }),
        plan('landmark', 'Jerónimos Monastery', '10:00', { endTime: '12:00', cost: 18 }),
        plan('museum', 'MAAT', '12:30', { endTime: '14:00', cost: 11 }),
        plan('landmark', 'Miradouro de Santa Luzia', '18:30'),
        plan('restaurant', 'Taberna da Rua das Flores', '20:30', { cost: 60 }),
      ],
    },
    {
      id: 'd3',
      date: day(1),
      title: 'Sintra',
      items: [
        plan('train', 'Train to Sintra', '09:10', { endTime: '09:50', cost: 5 }),
        plan('landmark', 'Pena Palace', '10:30', { endTime: '13:00', cost: 20 }),
      ],
    },
    { id: 'd4', date: day(2), title: '', items: [plan('beach', 'Praia da Ursa', '11:00')] },
    {
      id: 'd5',
      date: day(3),
      title: 'Home',
      items: [
        plan('hotel', 'Memmo Alfama', '11:00', { hotelAction: 'check-out' }),
        plan('flight', '', '17:20', { flightNo: 'LH 1179', from: 'LIS', to: 'BER', endTime: '21:40' }),
      ],
    },
  ],
}

const shots = [
  { file: 'trip-narrow.png', hash: '#/trip/demo', width: 390, height: 844 },
  { file: 'today-narrow.png', hash: '#/trip/demo/today', width: 390, height: 844 },
  { file: 'trip-wide.png', hash: '#/trip/demo', width: 1280, height: 800 },
]

const server = await preview({ preview: { port: 4317, strictPort: true } })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  await mkdir(OUT, { recursive: true })
  for (const shot of shots) {
    const page = await browser.newPage()
    await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 2 })
    await page.evaluateOnNewDocument(
      data => {
        localStorage.setItem('triplanner:v1', data)
        localStorage.setItem('triplanner:weather-off', '1')
        localStorage.setItem('triplanner:theme', 'light')
      },
      JSON.stringify({ trips: [trip] }),
    )
    await page.goto(`http://localhost:4317/${shot.hash}`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 600)) // let the scroll-to-today settle
    await page.screenshot({ path: `${OUT}${shot.file}` })
    await page.close()
    console.log(`wrote public/screenshots/${shot.file}`)
  }
} finally {
  await browser.close()
  server.httpServer.close()
}
