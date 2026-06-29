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
        runtimeCaching: [
          {
            // Cache de fuentes de Google
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler:    'CacheFirst',
            options: {
              cacheName:    'google-fonts-cache',
              expiration: {
                maxEntries:      10,
                maxAgeSeconds:   60 * 60 * 24 * 365, // 1 año
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Rutas de API — NetworkFirst para datos frescos con fallback offline
            urlPattern: /^\/api\/.*/i,
            handler:    'NetworkFirst',
            options: {
              cacheName:      'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries:    50,
                maxAgeSeconds: 60 * 5, // 5 minutos
              },
              cacheableResponse: { statuses: [0, 200] },
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
