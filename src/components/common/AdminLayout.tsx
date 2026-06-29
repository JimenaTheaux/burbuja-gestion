import { useState } from 'react'
import { useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Receipt, Menu,
} from 'lucide-react'
import { Sidebar }        from './Sidebar'
import { BottomNav }      from './BottomNav'
import { HamburgerMenu }  from './HamburgerMenu'
import { RefreshBar }     from './RefreshBar'
import { useSidebar }     from '@/hooks/useSidebar'

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
  const { isOpen } = useSidebar()
  const location    = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const tituloPagina = TITULOS[location.pathname] ?? 'Burbuja'

  return (
    <div style={{ minHeight: '100dvh', background: '#F5F7F9', overflowX: 'hidden' }}>
      <RefreshBar />
      {/* Sidebar — solo desktop */}
      <div className="hidden md:block">
        <Sidebar />
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
          position:       'sticky',
          top:            0,
          zIndex:         50,
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
      <main
        style={{
          minHeight:     '100dvh',
          background:    '#F5F7F9',
          padding:       '24px 16px',
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
          transition:    'margin-left 0.25s ease',
        }}
        className="md:pb-8"
      >
        {/* Spacer desktop para sidebar */}
        <div
          className="hidden md:block"
          style={{
            marginLeft: isOpen ? 240 : 64,
            transition: 'margin-left 0.25s ease',
          }}
        >
          <div style={{ padding: '24px 32px', minHeight: '100vh' }}>
            <Outlet />
          </div>
        </div>

        {/* Mobile: sin sidebar */}
        <div className="block md:hidden">
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
