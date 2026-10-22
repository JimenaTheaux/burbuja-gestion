import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name:             'Burbuja Gestión',
        short_name:       'Burbuja',
        description:      'Sistema de gestión de pedidos — Burbuja',
        theme_color:      '#3DD6B5',
        background_color: '#F5F7F9',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        lang:             'es',
        icons: [
          {
            src:   '/icons/icon-192.png',
            sizes: '192x192',
            type:  'image/png',
          },
          {
            src:   '/icons/icon-512.png',
            sizes: '512x512',
            type:  'image/png',
          },
          {
            src:     '/icons/icon-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // Borra los caches de runtime de versiones anteriores (ver public/sw-purge.js).
        importScripts: ['sw-purge.js'],
        runtimeCaching: [
          {
            // Supabase REST — siempre red primero; el cache es solo respaldo
            // offline o si la red tarda más de 5s. Nunca StaleWhileRevalidate:
            // servía la respuesta anterior en cada refetch (datos viejos).
            // Auth (/auth/v1/) no matchea: nunca se cachea.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler:    'NetworkFirst',
            options: {
              cacheName:             'supabase-api-v2',
              networkTimeoutSeconds: 5,
              expiration:            { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse:     { statuses: [200] },
            },
          },
        ],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/react-router-dom|\/react\/|\/react-dom\//.test(id)) return 'vendor-react'
          if (id.includes('@tanstack/react-query'))  return 'vendor-query'
          if (id.includes('@supabase/supabase-js'))  return 'vendor-supabase'
          if (id.includes('@radix-ui') || id.includes('lucide-react')) return 'vendor-ui'
          if (id.includes('chart.js'))                return 'vendor-charts'
        },
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target:        'http://127.0.0.1:3000',
        changeOrigin:  true,
        secure:        false,
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('[proxy error]', err.message))
        },
      },
    },
  },
})
