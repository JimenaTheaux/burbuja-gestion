import { useContext } from 'react'
import { AuthContext } from '@/contexts/authContext'

// El estado vive en <AuthProvider> (src/contexts/AuthProvider.tsx) — una sola
// suscripción a Supabase Auth para toda la app.
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
