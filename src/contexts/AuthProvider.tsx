import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import type { Rol } from '@/types'
import { AuthContext, type UsuarioActual } from './authContext'

// Clave del cache de perfil anterior — reemplazado por authStore. Se borra al montar.
const CACHE_KEY_LEGACY = 'burbuja-perfil-v2'
// Cache del SW con respuestas de Supabase REST (vite.config.ts). Se borra al
// cerrar sesión: el cache es por URL, no por usuario.
const SW_CACHE_DATOS = 'supabase-api-v2'

function borrarCacheDatos() {
  if (typeof caches === 'undefined') return
  caches.delete(SW_CACHE_DATOS).catch(() => {})
}
// Debe coincidir con auth.storageKey de src/lib/supabase.ts.
const SESSION_KEY = 'burbuja-supabase-session'

// Se lee UNA vez al montar: INITIAL_SESSION llega asíncrono (~80ms) y sin esto
// cada F5 mostraría el loader. Solo arranca optimista si el perfil persistido es
// del mismo usuario que la sesión guardada; INITIAL_SESSION lo confirma después.
function leerArranqueOptimista(): UsuarioActual | null {
  try {
    const persistido = useAuthStore.getState().usuario
    if (!persistido) return null
    const raw = localStorage.getItem(SESSION_KEY)
    const userId = raw ? JSON.parse(raw)?.user?.id : null
    return userId && userId === persistido.id ? persistido : null
  } catch {
    return null
  }
}

// Única fuente de verdad de auth: UNA suscripción a onAuthStateChange para toda la app.
//
// - Callback síncrono: Supabase desaconseja llamar a la API adentro del callback,
//   así que la carga del perfil se difiere con setTimeout.
// - TOKEN_REFRESHED se ignora: no recarga perfil ni vuelve a "cargando".
// - `cargando` es true solo en la carga inicial; nunca vuelve a true (desmontaría
//   formularios abiertos).
// - Arranque optimista: si el perfil persistido en authStore es del mismo usuario
//   que la sesión, se muestra la app al instante y el perfil se revalida en silencio.
// - authStore se sigue alimentando desde acá: services y hooks leen usuario.id de ahí.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [inicial]               = useState(leerArranqueOptimista)
  const [usuario,  setUsuario]  = useState<UsuarioActual | null>(inicial)
  const [cargando, setCargando] = useState(!inicial)
  // Usuario cuyo perfil está cargado (o cargándose): decide si un SIGNED_IN es otro usuario.
  const usuarioRef = useRef<string | null>(inicial?.id ?? null)

  const limpiarLocal = useCallback(() => {
    usuarioRef.current = null
    setUsuario(null)
    useAuthStore.getState().logout()
  }, [])

  useEffect(() => {
    let active = true

    try { localStorage.removeItem(CACHE_KEY_LEGACY) } catch { /* storage bloqueado */ }

    const aplicarPerfil = (perfil: UsuarioActual) => {
      setUsuario(prev =>
        prev && prev.id === perfil.id && prev.nombre === perfil.nombre && prev.rol === perfil.rol
          ? prev
          : perfil
      )
      const enStore = useAuthStore.getState().usuario
      if (!enStore || enStore.id !== perfil.id || enStore.nombre !== perfil.nombre || enStore.rol !== perfil.rol) {
        useAuthStore.getState().setUser(perfil)
      }
    }

    // silencioso: revalidación en segundo plano — un error de red no desloguea.
    const cargarPerfil = async (userId: string, silencioso: boolean) => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, rol, activo')
        .eq('id', userId)
        .maybeSingle()

      if (!active || usuarioRef.current !== userId) return

      if (error) {
        if (!silencioso) {
          limpiarLocal()
          setCargando(false)
        }
        return
      }

      if (!data || !data.activo) {
        limpiarLocal()
        setCargando(false)
        supabase.auth.signOut().catch(() => {})
        return
      }

      aplicarPerfil({ id: data.id, nombre: data.nombre, email: '', rol: data.rol as Rol })
      if (!silencioso) setCargando(false)
    }

    const programarPerfil = (userId: string, silencioso: boolean) => {
      usuarioRef.current = userId
      setTimeout(() => {
        if (active) cargarPerfil(userId, silencioso)
      }, 0)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (!session?.user) {
        // SIGNED_OUT, o INITIAL_SESSION sin sesión guardada.
        limpiarLocal()
        if (event === 'SIGNED_OUT') {
          queryClient.clear()
          borrarCacheDatos()
        }
        setCargando(false)
        return
      }

      const userId = session.user.id
      switch (event) {
        case 'INITIAL_SESSION': {
          const persistido = useAuthStore.getState().usuario
          if (persistido?.id === userId) {
            setUsuario(prev => prev ?? persistido)
            setCargando(false)
            programarPerfil(userId, true)
          } else {
            // Camino estricto. Si se arrancó optimista con otro usuario (storage
            // cambiado entre el montaje y este evento), se descarta ese perfil.
            if (usuarioRef.current && usuarioRef.current !== userId) limpiarLocal()
            programarPerfil(userId, false)
          }
          break
        }
        case 'SIGNED_IN':
          if (userId !== usuarioRef.current) programarPerfil(userId, false)
          break
        case 'USER_UPDATED':
          programarPerfil(userId, true)
          break
        default:
          // TOKEN_REFRESHED, PASSWORD_RECOVERY, MFA_*: nada.
          break
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [limpiarLocal])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }, [])

  const cerrarSesion = useCallback(async () => {
    sessionStorage.clear()
    limpiarLocal()
    queryClient.clear()
    borrarCacheDatos()
    supabase.auth.signOut().catch(() => {})
  }, [limpiarLocal])

  const value = useMemo(() => ({
    usuario,
    cargando,
    autenticado: !!usuario,
    login,
    cerrarSesion,
  }), [usuario, cargando, login, cerrarSesion])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
