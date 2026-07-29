import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      workbox: {
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
        name: 'Triplanner',
        short_name: 'Triplanner',
        description:
          'Plan trips day by day — flights, hotels and places to see. Offline-first, your data stays on your device.',
        theme_color: '#0B3B39',
        background_color: '#0B3B39',
        display: 'standalone',
        start_url: '/',
        icons: [
          ...[48, 72, 96, 128, 144, 152, 192, 256, 384, 512].map(size => ({
            src: `/icons/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
          })),
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
