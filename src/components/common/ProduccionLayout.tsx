import { Outlet, useNavigate } from 'react-router-dom'
import { Factory, List, LogOut } from 'lucide-react'
import { BottomNav }          from './BottomNav'
import { useAuth }            from '@/hooks/useAuth'
import { useScrollDirection } from '@/hooks/useScrollDirection'

export function ProduccionLayout() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate     = useNavigate()
  const scrollDir    = useScrollDirection()

  const handleLogout = async () => {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8' }}>
      {/* Topbar — se oculta al scrollear hacia abajo en mobile */}
      <header
        className="topbar-scroll-aware"
        style={{
          height:         56,
          background:     'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom:   '1px solid #D1D5DB',
          padding:        '0 16px',
          display:        'flex',
          alignItems:     'center',
          gap:            12,
          position:       'sticky',
          top:            0,
          zIndex:         50,
          transform:      scrollDir === 'down' ? 'translateY(-100%)' : 'translateY(0)',
          transition:     'transform 0.25s ease',
        }}
      >
        <div
          style={{
            width:          28,
            height:         28,
            borderRadius:   6,
            background:     '#1B9ED6',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          '#fff',
            fontSize:       11,
            fontWeight:     900,
            flexShrink:     0,
          }}
        >
          LM
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2B3C' }}>
            Producción
          </span>
          {usuario && (
            <span style={{ fontSize: 12, color: '#4A5568', marginLeft: 6 }}>
              — {usuario.nombre}
            </span>
          )}
        </div>

        <button
          onClick={handleLogout}
          style={{
            background:  'transparent',
            border:      'none',
            cursor:      'pointer',
            color:       '#4A5568',
            padding:     6,
            borderRadius:6,
            display:     'flex',
            alignItems:  'center',
          }}
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Contenido */}
      <main style={{ padding: '16px', paddingBottom: 72 }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <BottomNav items={[
        { to: '/produccion',        icon: Factory, label: 'Producción', end: true },
        { to: '/produccion/listos', icon: List,    label: 'Listos' },
      ]} />
    </div>
  )
}
