import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Sin timeout propio, un fetch colgado (red móvil en estado intermedio) queda
// pendiente indefinidamente y la UI no sale del "cargando". 20s fuerza el error.
const FETCH_TIMEOUT_MS = 20_000

// Sin `lock` custom: desde auth-js 2.10x el default es lockless. Pasar cualquier
// lock activa el camino legacy, que se traba si un callback de
// onAuthStateChange hace await de una consulta.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    detectSessionInUrl: false,
    autoRefreshToken:   true,
    storageKey:         'burbuja-supabase-session',
  },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
  },
})
