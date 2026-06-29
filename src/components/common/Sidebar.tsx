import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, ShoppingCart,
  ChevronRight, LogOut, Settings, UserCircle, Receipt,
  FlaskConical, Truck,
} from 'lucide-react'
import { useSidebar } from '@/hooks/useSidebar'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  to:    string
  icon:  React.ReactNode
  label: string
}

const NAV_ADMIN: NavItem[] = [
  { to: '/admin',           icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/admin/pedidos',   icon: <ShoppingCart    size={18} />, label: 'Pedidos' },
  { to: '/admin/clientes',  icon: <Users           size={18} />, label: 'Clientes' },
  { to: '/admin/productos', icon: <Package         size={18} />, label: 'Productos' },
  { to: '/admin/egresos',  icon: <Receipt         size={18} />, label: 'Egresos' },
  { to: '/admin/usuarios',  icon: <Settings        size={18} />, label: 'Usuarios' },
]

const NAV_OPERATIVAS: NavItem[] = [
  { to: '/admin/produccion', icon: <FlaskConical size={18} />, label: 'Producción' },
  { to: '/admin/repartidor', icon: <Truck        size={18} />, label: 'Reparto' },
]

const NAV_PERFIL: NavItem[] = [
  { to: '/admin/perfil', icon: <UserCircle size={18} />, label: 'Mi perfil' },
]

function getIniciales(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function Sidebar() {
  const { isOpen, toggle } = useSidebar()
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      style={{
        position:   'fixed',
        top:        0,
        left:       0,
        bottom:     0,
        width:      isOpen ? 240 : 64,
        background: '#FFFFFF',
        borderRight:'1px solid #E5E5EA',
        transition: 'width 0.25s ease',
        zIndex:     100,
        display:    'flex',
        flexDirection: 'column',
        overflow:   'hidden',
      }}
    >
      {/* Header — Logo */}
      <div
        style={{
          height:      64,
          display:     'flex',
          alignItems:  'center',
          padding:     isOpen ? '0 16px' : '0',
          justifyContent: isOpen ? 'flex-start' : 'center',
          gap:         10,
          flexShrink:  0,
          borderBottom:'1px solid #E5E5EA',
        }}
      >
        {/* Logo mark */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          border: '1px solid #E5E5EA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          <img src="/icons/icon-192.png" width={36} height={36} alt="" />
        </div>

        {/* Texto (solo visible cuando sidebar abierto) */}
        {isOpen && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px' }}>
              burbuja
            </div>
            <div style={{ fontSize: 9, fontWeight: 500, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Limpieza Superpoderosa
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ADMIN.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            title={!isOpen ? item.label : undefined}
            style={({ isActive }) => ({
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        isOpen ? '10px 16px' : '10px 0',
              justifyContent: isOpen ? 'flex-start' : 'center',
              margin:         '2px 8px',
              borderRadius:   10,
              textDecoration: 'none',
              fontSize:       13,
              fontWeight:     isActive ? 600 : 500,
              color:          isActive ? '#28B99A' : '#3A3A3C',
              background:     isActive ? '#E8FAF6' : 'transparent',
              transition:     'all 0.15s ease',
              whiteSpace:     'nowrap',
              overflow:       'hidden',
            })}
          >
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            {isOpen && item.label}
          </NavLink>
        ))}

        {/* Vistas operativas — lo que vería producción/repartidor, dentro del propio admin */}
        {isOpen && (
          <div style={{
            padding: '10px 16px 4px', fontSize: 9, fontWeight: 700,
            color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Vistas operativas
          </div>
        )}
        {NAV_OPERATIVAS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={!isOpen ? item.label : undefined}
            style={({ isActive }) => ({
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        isOpen ? '10px 16px' : '10px 0',
              justifyContent: isOpen ? 'flex-start' : 'center',
              margin:         '2px 8px',
              borderRadius:   10,
              textDecoration: 'none',
              fontSize:       13,
              fontWeight:     isActive ? 600 : 500,
              color:          isActive ? '#28B99A' : '#3A3A3C',
              background:     isActive ? '#E8FAF6' : 'transparent',
              transition:     'all 0.15s ease',
              whiteSpace:     'nowrap',
              overflow:       'hidden',
            })}
          >
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            {isOpen && item.label}
          </NavLink>
        ))}

        {NAV_PERFIL.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={!isOpen ? item.label : undefined}
            style={({ isActive }) => ({
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        isOpen ? '10px 16px' : '10px 0',
              justifyContent: isOpen ? 'flex-start' : 'center',
              margin:         '2px 8px',
              borderRadius:   10,
              textDecoration: 'none',
              fontSize:       13,
              fontWeight:     isActive ? 600 : 500,
              color:          isActive ? '#28B99A' : '#3A3A3C',
              background:     isActive ? '#E8FAF6' : 'transparent',
              transition:     'all 0.15s ease',
              whiteSpace:     'nowrap',
              overflow:       'hidden',
            })}
          >
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            {isOpen && item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — usuario + logout */}
      <div
        style={{
          padding:     isOpen ? '12px 16px' : '12px 0',
          borderTop:   '1px solid #E5E5EA',
          display:     'flex',
          alignItems:  'center',
          gap:         10,
          justifyContent: isOpen ? 'flex-start' : 'center',
          flexShrink:  0,
        }}
      >
        {/* Avatar iniciales */}
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

        {isOpen && (
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
        )}

        {isOpen && (
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
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={toggle}
        title={isOpen ? 'Colapsar' : 'Expandir'}
        style={{
          position:       'absolute',
          right:          -12,
          top:            72,
          width:          24,
          height:         24,
          borderRadius:   '50%',
          background:     '#7EB8E8',
          border:         'none',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#fff',
          zIndex:         101,
          transition:     'transform 0.25s ease',
          transform:      isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <ChevronRight size={13} />
      </button>
    </aside>
  )
}
