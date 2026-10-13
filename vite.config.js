import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits for the user's Reload (see UpdateNotice in App.jsx)
      // instead of reloading the page under a half-filled form.
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      workbox: {
        // Catches files shared to the app (manifest share_target).
        importScripts: ['share-target-sw.js'],
        // Airline logos keep working offline once seen (opaque responses ok).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.kiwi\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'airline-logos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: '/',
        name: 'Triplanner',
        short_name: 'Triplanner',
        description:
          'Plan trips day by day — flights, hotels and places to see. Offline-first, your data stays on your device.',
        theme_color: '#0B3B39',
        background_color: '#0B3B39',
        display: 'standalone',
        start_url: '/',
        launch_handler: { client_mode: 'focus-existing' },
        icons: [
          ...[48, 72, 96, 128, 144, 152, 192, 256, 384, 512].map(size => ({
            src: `/icons/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
          })),
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Today’s trip',
            short_name: 'Today',
            description: 'Trip mode for the trip under way, or the next one',
            url: '/#/today',
            icons: [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
        screenshots: [
          {
            src: '/screenshots/trip-narrow.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'A trip, day by day',
          },
          {
            src: '/screenshots/today-narrow.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Trip mode: now and next',
          },
          {
            src: '/screenshots/trip-wide.png',
            sizes: '2560x1600',
            type: 'image/png',
            form_factor: 'wide',
            label: 'A trip, day by day',
          },
        ],
        // Desktop: open .ics and .json files with the installed app.
        file_handlers: [
          {
            action: '/',
            accept: {
              'text/calendar': ['.ics'],
              'application/json': ['.json'],
            },
          },
        ],
        // Android: share a booking or a backup to the app.
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{ name: 'file', accept: ['text/calendar', '.ics', 'application/json', '.json'] }],
          },
        },
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
  },
})
