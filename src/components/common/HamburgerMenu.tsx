import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Receipt, Users, Package, Settings,
  LogOut, X, FlaskConical, Truck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  to:    string
  icon:  React.ReactNode
  label: string
  end?:  boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { to: '/admin',          icon: <LayoutDashboard size={18} />, label: 'Dashboard', end: true },
      { to: '/admin/pedidos',  icon: <ShoppingCart    size={18} />, label: 'Pedidos' },
      { to: '/admin/egresos',  icon: <Receipt         size={18} />, label: 'Egresos' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/admin/clientes',  icon: <Users    size={18} />, label: 'Clientes' },
      { to: '/admin/productos', icon: <Package  size={18} />, label: 'Productos' },
      { to: '/admin/usuarios',  icon: <Settings size={18} />, label: 'Usuarios' },
    ],
  },
  {
    label: 'Vistas operativas',
    items: [
      { to: '/admin/produccion', icon: <FlaskConical size={18} />, label: 'Producción' },
      { to: '/admin/repartidor', icon: <Truck        size={18} />, label: 'Reparto' },
    ],
  },
]

function getIniciales(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

interface Props {
  isOpen:  boolean
  onClose: () => void
}

export function HamburgerMenu({ isOpen, onClose }: Props) {
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    onClose()
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.4)',
          zIndex:     300,
          opacity:    isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Panel */}
      <aside
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          bottom:        0,
          width:         '80%',
          maxWidth:      320,
          background:    '#FFFFFF',
          zIndex:        301,
          display:       'flex',
          flexDirection: 'column',
          transform:     isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:    'transform 0.2s ease',
          boxShadow:     '2px 0 12px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div
          style={{
            height:        64,
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'space-between',
            padding:       '0 16px',
            borderBottom:  '1px solid #E5E5EA',
            flexShrink:    0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #3DD6B5, #7EB8E8)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-1px',
              flexShrink: 0,
            }}>
              Bu
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px' }}>
                burbuja
              </div>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Limpieza Superpoderosa
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            style={{
              background: 'transparent',
              border:     'none',
              cursor:     'pointer',
              color:      '#8E8E93',
              padding:    6,
              borderRadius: 8,
              display:    'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {SECTIONS.map((section) => (
            <div key={section.label} style={{ marginBottom: 8 }}>
              <div style={{
                padding: '8px 16px 4px',
                fontSize: 9,
                fontWeight: 700,
                color: '#8E8E93',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  style={({ isActive }) => ({
                    display:        'flex',
                    alignItems:     'center',
                    gap:            10,
                    padding:        '10px 16px',
                    margin:         '2px 8px',
                    borderRadius:   10,
                    textDecoration: 'none',
                    fontSize:       14,
                    fontWeight:     isActive ? 600 : 500,
                    color:          isActive ? '#28B99A' : '#3A3A3C',
                    background:     isActive ? '#E8FAF6' : 'transparent',
                  })}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer — usuario + logout */}
        <div
          style={{
            padding:    '12px 16px',
            borderTop:  '1px solid #E5E5EA',
            display:    'flex',
            alignItems: 'center',
            gap:        10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width:          32,
              height:         32,
              borderRadius:   10,
              background:     'linear-gradient(135deg, #3DD6B5, #7EB8E8)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          '#fff',
              fontSize:       12,
              fontWeight:     700,
              flexShrink:     0,
            }}
          >
            {usuario ? getIniciales(usuario.nombre) : 'U'}
          </div>

          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <p style={{
              color: '#1C1C1E', fontSize: 13, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              margin: 0,
            }}>
              {usuario?.nombre ?? '—'}
            </p>
            <p style={{ color: '#8E8E93', fontSize: 11, margin: 0 }}>
              {usuario?.rol ?? '—'}
            </p>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{
              background: 'transparent',
              border:     'none',
              cursor:     'pointer',
              color:      '#8E8E93',
              padding:    4,
              borderRadius: 6,
              display:    'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  )
}
