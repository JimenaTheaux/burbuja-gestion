import { useState } from 'react'
import { useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Receipt, Menu,
} from 'lucide-react'
import { Navbar }         from './Navbar'
import { BottomNav }      from './BottomNav'
import { HamburgerMenu }  from './HamburgerMenu'
import { RefreshBar }     from './RefreshBar'

const BOTTOM_NAV_ITEMS = [
  { to: '/admin',          icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/pedidos',  icon: ShoppingCart,    label: 'Pedidos' },
  { to: '/admin/egresos',  icon: Receipt,         label: 'Egresos' },
]

const TITULOS: Record<string, string> = {
  '/admin':            'Dashboard',
  '/admin/pedidos':    'Pedidos',
  '/admin/egresos':    'Egresos',
  '/admin/clientes':   'Clientes',
  '/admin/productos':  'Productos',
  '/admin/usuarios':   'Usuarios',
  '/admin/produccion': 'Producción',
  '/admin/repartidor': 'Reparto',
  '/admin/perfil':     'Mi perfil',
}

export function AdminLayout() {
  const location    = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const tituloPagina = TITULOS[location.pathname] ?? 'Burbuja'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <RefreshBar />

      {/* Navbar horizontal — solo desktop */}
      <div className="hidden md:block" style={{ flexShrink: 0 }}>
        <Navbar />
      </div>

      {/* Menú hamburguesa — solo mobile */}
      <HamburgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Topbar — solo mobile */}
      <header
        className="flex md:hidden"
        style={{
          height:         58,
          background:     'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom:   '1px solid #E5E5EA',
          padding:        '0 16px',
          alignItems:     'center',
          gap:            12,
          flexShrink:     0,
        }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          style={{
            background: 'transparent',
            border:     'none',
            cursor:     'pointer',
            display:    'flex',
            alignItems: 'center',
            padding:    4,
          }}
        >
          <Menu size={22} color="#1C1C1E" />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>
          {tituloPagina}
        </span>
      </header>

      {/* Contenido principal */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#F5F7F9' }}>
        {/* Un solo Outlet: padding responsive en vez de duplicar la página por breakpoint.
            Mobile: 24px 16px + espacio para el bottom nav. Desktop: 24px 32px. */}
        <div className="px-4 pt-6 pb-[calc(80px_+_env(safe-area-inset-bottom))] md:px-8 md:pb-6 md:min-h-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — solo mobile */}
      <div className="block md:hidden">
        <BottomNav items={BOTTOM_NAV_ITEMS} />
      </div>
    </div>
  )
}
