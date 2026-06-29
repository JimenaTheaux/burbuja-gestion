# 05 — Stack Técnico y Arquitectura

## Decisiones tecnológicas

### Frontend
- **Framework:** React 19 + Vite 8 (TypeScript)
- **Tipo de app:** PWA (Progressive Web App) — instalable en Android desde Chrome
- **Estilos:** Tailwind CSS v3
- **Componentes UI:** shadcn/ui sobre Radix UI primitives + `class-variance-authority` + `tailwind-merge` + `clsx`
- **Routing:** React Router v6
- **Estado global:** Zustand (solo `authStore` — perfil/sesión)
- **Data fetching / cache:** TanStack Query v5
- **Formularios:** React Hook Form + Zod v4 (`@hookform/resolvers`)
- **Íconos:** `lucide-react` exclusivamente — cero emojis en la UI
- **Gráficos:** Chart.js
- **Documentos imprimibles / JPG:** html2canvas
- **Offline:** `idb` (IndexedDB) — activo en el rol Repartidor (`useOffline`, `offlineQueue`): encola cambios de estado y cierres de pedido sin conexión, sincroniza al volver online
- **PWA:** `vite-plugin-pwa` + Workbox

### Backend / Base de datos
- **Todo en Supabase** — no hay backend propio:
  - **Base de datos:** PostgreSQL administrado por Supabase
  - **Auth:** Supabase Auth (email + password), tabla `perfiles` extiende `auth.users`
  - **Acceso a datos:** el frontend llama directamente a Supabase vía `@supabase/supabase-js`
  - **Lógica atómica:** RPCs en PL/pgSQL (`SECURITY DEFINER`) para operaciones multi-tabla (ej. `cambiar_estado_pedido`)
  - **Autorización:** Row Level Security (RLS) por rol en Postgres

### Deploy
- **Frontend:** Vercel — SPA estática (`vite build → dist/`)
- **Base de datos / Auth:** Supabase (proyecto "burbuja")

---

## Arquitectura general

```
┌──────────────────────────────────────────────┐
│              CLIENTE (PWA)                   │
│                                              │
│  React 19 + Vite 8                           │
│  ┌─────────────────────────────────────────┐ │
│  │  Admin UI                               │ │
│  │  Dashboard · Pedidos · Egresos          │ │
│  │  Clientes · Productos · Usuarios        │ │
│  │  /produccion (vista operativa)          │ │
│  │  /reparto    (vista operativa)          │ │
│  └────────────────────┬────────────────────┘ │
│                       │                      │
│  ┌────────────────────▼────────────────────┐ │
│  │   TanStack Query + Zustand (authStore)  │ │
│  └────────────────────┬────────────────────┘ │
│                       │                      │
│  ┌────────────────────▼────────────────────┐ │
│  │  Service Worker (Workbox) — assets      │ │
│  │  idb — preparado para cola offline      │ │
│  └────────────────────────────────────────-┘ │
└───────────────────────┬──────────────────────┘
                        │ HTTPS (@supabase/supabase-js)
┌───────────────────────▼──────────────────────┐
│                   SUPABASE                   │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Auth (JWT)  │  │ PostgreSQL           │   │
│  │             │  │ + RLS por rol        │   │
│  └──────┬──────┘  │ + RPC (PL/pgSQL)     │   │
│         │         └──────────────────────┘   │
│   tabla perfiles                             │
│   (rol, activo)                              │
└──────────────────────────────────────────────┘
```

---

## Estructura de carpetas

```
burbuja-gestion/
├── public/
│   ├── manifest.json
│   ├── Logo_sin_fondo_negro.png
│   └── icons/              # 192x192, 512x512, apple-touch-icon
│
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ui/             # shadcn/ui sobre Radix
│   │   ├── common/         # AdminLayout, Sidebar, HamburgerMenu,
│   │   │                   # BottomNav, Drawer, BadgeEstado,
│   │   │                   # ProtectedRoute, TopBar, etc.
│   │   └── pedidos/        # DrawerPedido, DrawerDetalle, FacturaCanvas
│   │
│   ├── pages/
│   │   ├── admin/          # Dashboard, Pedidos, Clientes, Productos,
│   │   │                   # Usuarios, Egresos, Perfil
│   │   ├── produccion/     # ProduccionPage (accesible al Admin)
│   │   ├── reparto/        # RepartoPage (accesible al Admin)
│   │   ├── print/          # Facturas, PrintPedido
│   │   └── LoginPage.tsx
│   │
│   ├── hooks/              # useAuth, useSidebar, useToast,
│   │                       # useDebounce, useCompartirFactura
│   ├── store/              # authStore.ts (Zustand)
│   ├── lib/
│   │   ├── supabase.ts     # Cliente Supabase
│   │   ├── offlineQueue.ts # Cola offline (preparada, no activa en MVP)
│   │   └── utils.ts
│   ├── services/           # pedidos, clientes, productos,
│   │                       # usuarios, egresos, produccion
│   └── types/              # Pedido, Cliente, Producto, Perfil,
│                           # Egreso, EstadoPedido, etc.
│
├── supabase/
│   └── rpcs_and_indexes.sql
│
├── .env.local              # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── vercel.json
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Variables de entorno

```env
VITE_SUPABASE_URL=https://[proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=[anon key]
VITE_SUPABASE_SERVICE_ROLE_KEY=[service role key — solo para gestión de usuarios]
```

---

## Dependencias principales

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^6",
    "@tanstack/react-query": "^5",
    "zustand": "^4",
    "react-hook-form": "^7",
    "@hookform/resolvers": "^5",
    "zod": "^4",
    "@supabase/supabase-js": "^2",
    "lucide-react": "^1",
    "chart.js": "^4",
    "html2canvas": "^1",
    "idb": "^8",
    "workbox-window": "^7",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^3"
  },
  "devDependencies": {
    "vite": "^8",
    "vite-plugin-pwa": "^1",
    "typescript": "~6",
    "tailwindcss": "^3",
    "@vitejs/plugin-react": "^6"
  }
}
```

---

## Seguridad

- **Auth:** Supabase Auth (JWT en sesión, persistido en `localStorage`).
- **Autorización real:** RLS en Postgres — el frontend solo hace ocultamiento visual.
- **Perfil y rol:** tabla `perfiles` con columna `activo` — usuario desactivado pierde acceso (`useAuth` cierra sesión si `activo = false`).
- **Variables de entorno:** `VITE_SUPABASE_ANON_KEY` es pública por diseño de Supabase; la seguridad depende de RLS. `SERVICE_ROLE_KEY` nunca va al cliente — solo usada en funciones administrativas con el cliente admin de Supabase.

---

## Sincronización

Sin Supabase Realtime ni WebSockets. Cada vista hace refetch con TanStack Query al entrar o tras una acción. En el MVP no hay polling ni modo offline activo.

---

## vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Configuración PWA (vite.config.ts)

```typescript
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  devOptions: { enabled: true },
  manifest: {
    name: 'Burbuja Gestión',
    short_name: 'Burbuja',
    theme_color: '#3DD6B5',
    background_color: '#F5F7F9',
    display: 'standalone',
    orientation: 'portrait',
    icons: [/* 192x192, 512x512, apple-touch-icon */],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 300 },
        },
      },
    ],
  },
})
```
