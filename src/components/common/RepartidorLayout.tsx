import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  Wifi, WifiOff, LogOut, Truck, Clock, RefreshCw, User,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { BottomNav }          from './BottomNav'
import { RefreshBar }         from './RefreshBar'
import { useAuth }            from '@/hooks/useAuth'
import { useOffline }         from '@/hooks/useOffline'
import { useScrollDirection } from '@/hooks/useScrollDirection'

export function RepartidorLayout() {
  const { cerrarSesion }                            = useAuth()
  const navigate                                    = useNavigate()
  const queryClient                                 = useQueryClient()
  const { isOnline, pendingCount, syncing, sync }   = useOffline()
  const [logoutHover, setLogoutHover]               = useState(false)
  const scrollDir                                   = useScrollDirection()

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
          padding:      '0 16px',
          display:      'flex',
          alignItems:   'center',
          gap:          10,
          position:     'sticky',
          top:          0,
          zIndex:       50,
          transform:    scrollDir === 'down' ? 'translateY(-100%)' : 'translateY(0)',
          transition:   'transform 0.25s ease',
        }}
      >
        {/* LM mark */}
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
            fontWeight:     700,
            flexShrink:     0,
            letterSpacing:  '-0.5px',
          }}
        >
          LM
        </div>

        {/* Título */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>
            Reparto
          </span>
          <span style={{ fontSize: 12, color: '#8E8E93' }}>
            — Repartidor
          </span>
        </div>

        {/* Indicador de conexión — inline, sin pill */}
        <div
          aria-live="polite"
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        4,
            flexShrink: 0,
          }}
        >
          {isOnline ? (
            <>
              <Wifi size={13} color="#2E9E5C" aria-label="En línea" />
              <span className="hidden sm:inline" style={{ fontSize: 11, color: '#2E9E5C' }}>
                En línea
              </span>
            </>
          ) : (
            <>
              <WifiOff size={13} color="#9A9A9A" aria-label="Sin conexión" />
              <span className="hidden sm:inline" style={{ fontSize: 11, color: '#9A9A9A' }}>
                Sin conexión
              </span>
            </>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          aria-label="Cerrar sesión"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7EB8E8] focus-visible:ring-offset-2"
          style={{
            width:        32,
            height:       32,
            background:   'transparent',
            border:       'none',
            cursor:       'pointer',
            color:        logoutHover ? '#D32F2F' : '#8E8E93',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            borderRadius: 6,
            flexShrink:   0,
            transition:   'color 0.15s ease',
          }}
        >
          <LogOut size={16} color={logoutHover ? '#D32F2F' : '#8E8E93'} />
        </button>
      </header>

      {/* Banner: cambios pendientes de sincronizar */}
      {pendingCount > 0 && isOnline && !syncing && (
        <div
          style={{
            background:   '#FFFDE7',
            borderBottom: '0.5px solid #F9A825',
            padding:      '6px 16px',
            fontSize:     11,
            color:        '#F57F17',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            gap:          8,
          }}
        >
          <span>{pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar</span>
          <button
            onClick={sync}
            style={{
              background: '#F9A825', color: '#fff', border: 'none',
              borderRadius: 6, padding: '3px 10px', fontSize: 11,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter Variable, sans-serif',
            }}
          >
            Sincronizar
          </button>
        </div>
      )}

      {/* Banner: sincronizando */}
      {syncing && (
        <div
          style={{
            background:   '#EBF5FF',
            borderBottom: '0.5px solid #7EB8E8',
            padding:      '6px 16px',
            fontSize:     11,
            color:        '#3DD6B5',
            display:      'flex',
            alignItems:   'center',
            gap:          6,
          }}
        >
          <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
          Sincronizando…
        </div>
      )}

      {/* Banner: sin conexión con cambios pendientes */}
      {!isOnline && pendingCount > 0 && (
        <div
          style={{
            background:   '#FFFDE7',
            borderBottom: '0.5px solid #F9A825',
            padding:      '6px 16px',
            fontSize:     11,
            color:        '#F57F17',
          }}
        >
          Sin conexión — {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} en espera
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Contenido */}
      <main style={{ padding: '16px', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <BottomNav
        items={[
          { to: '/repartidor',           icon: Truck,      label: 'Pedidos',   end: true },
          { to: '/repartidor/historial', icon: Clock, label: 'Historial' },
          { to: '/repartidor/perfil',    icon: User,       label: 'Perfil' },
        ]}
        logoutAction={handleLogout}
      />
    </div>
  )
}
