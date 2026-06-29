import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Rol } from '@/types'

interface Props {
  children: React.ReactNode
  roles?:   Rol[]
}

export function ProtectedRoute({ children, roles }: Props) {
  const { autenticado, cargando, usuario } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F5F7F9' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40, height: 40,
              borderRadius: '50%',
              border: '3px solid #E5E5EA',
              borderTopColor: '#3DD6B5',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <p style={{ color: '#8E8E93', fontSize: 14 }}>Cargando…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!autenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && usuario && !roles.includes(usuario.rol as Rol)) {
    const homeRol: Record<Rol, string> = {
      admin:      '/admin',
      superadmin: '/admin',
      produccion: '/produccion',
      repartidor: '/repartidor',
    }
    return <Navigate to={homeRol[usuario.rol as Rol]} replace />
  }

  return <>{children}</>
}
