import { Outlet, useNavigate } from 'react-router-dom'
import { Factory, List, LogOut, UserCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { BottomNav }          from './BottomNav'
import { RefreshBar }         from './RefreshBar'
import { useAuth }            from '@/hooks/useAuth'
import { useScrollDirection } from '@/hooks/useScrollDirection'

export function ProduccionLayout() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const scrollDir    = useScrollDirection()

  const handleLogout = async () => {
    queryClient.clear()
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F5F7F9', overflowX: 'hidden' }}>
      <RefreshBar />
      {/* Topbar — se oculta al scrollear hacia abajo en mobile */}
      <header
        className="topbar-scroll-aware"
        style={{
          height:         56,
          background:     'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom:   '1px solid #E5E5EA',
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
            background:     '#7EB8E8',
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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
            Producción
          </span>
          {usuario && (
            <span style={{ fontSize: 12, color: '#8E8E93', marginLeft: 6 }}>
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
            color:       '#8E8E93',
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
      <main style={{ padding: '16px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <BottomNav
        items={[
          { to: '/produccion',        icon: Factory,     label: 'Producción', end: true },
          { to: '/produccion/listos', icon: List,        label: 'Listos' },
          { to: '/produccion/perfil', icon: UserCircle,  label: 'Perfil' },
        ]}
        logoutAction={handleLogout}
      />
    </div>
  )
}
