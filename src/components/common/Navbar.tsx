import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Users, Package, TrendingDown, UserCog,
  FlaskConical, Truck, LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  to:    string
  icon:  React.ReactNode
  label: string
  end?:  boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin',            icon: <LayoutDashboard size={14} />, label: 'Dashboard',  end: true },
  { to: '/admin/pedidos',    icon: <ClipboardList   size={14} />, label: 'Pedidos' },
  { to: '/admin/clientes',   icon: <Users           size={14} />, label: 'Clientes' },
  { to: '/admin/productos',  icon: <Package         size={14} />, label: 'Productos' },
  { to: '/admin/egresos',    icon: <TrendingDown    size={14} />, label: 'Egresos' },
  { to: '/admin/usuarios',   icon: <UserCog         size={14} />, label: 'Usuarios' },
  { to: '/admin/produccion', icon: <FlaskConical    size={14} />, label: 'Producción' },
  { to: '/admin/repartidor', icon: <Truck           size={14} />, label: 'Reparto' },
]

function getIniciales(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function Navbar() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const [logoError, setLogoError] = useState(false)

  const handleLogout = async () => {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <header
      style={{
        background:   '#FFFFFF',
        borderBottom: '1px solid #E5E5EA',
        height:       52,
        display:      'flex',
        alignItems:   'center',
        padding:      '0 20px',
        position:     'sticky',
        top:          0,
        zIndex:       50,
        width:        '100%',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 28, flexShrink: 0 }}>
        {!logoError ? (
          <img
            src="/Logo_sin_fondo_negro.png"
            alt="Burbuja"
            style={{ height: 40, width: 'auto', objectFit: 'contain' }}
            onError={() => setLogoError(true)}
          />
        ) : (
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   8,
            background:     'linear-gradient(135deg, #3DD6B5, #7EB8E8)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       12,
            fontWeight:     900,
            color:          '#fff',
            flexShrink:     0,
          }}>
            Bu
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `navbar-link${isActive ? ' navbar-link--active' : ''}`}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
        <div style={{
          width:          26,
          height:         26,
          borderRadius:   8,
          background:     'linear-gradient(135deg, #3DD6B5, #7EB8E8)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#fff',
          fontSize:       10,
          fontWeight:     700,
          flexShrink:     0,
        }}>
          {usuario ? getIniciales(usuario.nombre) : 'U'}
        </div>
        <span style={{ fontSize: 11, color: '#8E8E93', whiteSpace: 'nowrap' }}>
          {usuario?.nombre ?? '—'}
        </span>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="navbar-logout"
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
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
