import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import type { Rol } from '@/types'

// Perfil en localStorage para evitar parpadeo al recargar
const CACHE_KEY = 'burbuja-perfil-v2'

// ─── Recuperación tras idle ────────────────────────────────────────────────
// Si la pestaña estuvo oculta más de este umbral, autoRefreshToken de Supabase
// puede no haber corrido (el browser throttlea timers en background) y el JWT
// queda vencido. Sin esto, la primera request al volver se cuelga en vez de
// fallar, y la UI queda "congelada" hasta un refresh manual.
const IDLE_REFRESH_THRESHOLD_MS = 60_000
let hiddenAt: number | null = null

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now()
      return
    }
    const estuvoOcultoMucho = hiddenAt !== null && Date.now() - hiddenAt > IDLE_REFRESH_THRESHOLD_MS
    hiddenAt = null
    if (!estuvoOcultoMucho) return

    supabase.auth.refreshSession().then(({ error }) => {
      if (error) {
        useAuthStore.getState().logout()
      } else {
        queryClient.invalidateQueries()
      }
    })
  })
}

function getCachedPerfil() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setCachedPerfil(p: ReturnType<typeof useAuthStore.getState>['usuario']) {
  try {
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p))
    else    localStorage.removeItem(CACHE_KEY)
  } catch {}
}

export function useAuth() {
  const { usuario, setUser, logout } = useAuthStore()
  const cached = getCachedPerfil()
  const [cargando, setCargando] = useState(!cached)

  const fetchPerfil = useCallback(async (userId: string, silent = false) => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      if (!silent) {
        setCachedPerfil(null)
        logout()
        setCargando(false)
      }
      return
    }

    if (!data.activo) {
      setCachedPerfil(null)
      logout()
      supabase.auth.signOut().catch(() => {})
      setCargando(false)
      return
    }

    const perfil = { id: data.id, nombre: data.nombre, email: '', rol: data.rol as Rol }
    setUser(perfil)
    setCachedPerfil(perfil)
    if (!silent) setCargando(false)
  }, [setUser, logout])

  useEffect(() => {
    // Leer sesión local (sync en SDK v2)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        setCachedPerfil(null)
        logout()
        setCargando(false)
        return
      }
      // Si el cache ya tiene el mismo userId, no bloquear la UI
      if (cached?.id === session.user.id) {
        setCargando(false)
        fetchPerfil(session.user.id, true) // actualización silenciosa
      } else {
        fetchPerfil(session.user.id, false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchPerfil(session.user.id, false)
        } else {
          setCachedPerfil(null)
          logout()
          setCargando(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const cerrarSesion = async () => {
    setCachedPerfil(null)
    sessionStorage.clear()
    logout()
    supabase.auth.signOut().catch(() => {})
  }

  return {
    usuario:     usuario ?? cached,
    cargando,
    autenticado: !!(usuario ?? cached),
    login,
    cerrarSesion,
  }
}
