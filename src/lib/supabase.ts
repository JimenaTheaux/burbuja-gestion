import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// noopLock: evita NavigatorLockAcquireTimeoutError con múltiples pestañas
const noopLock = <T>(_name: string, _timeout: number, fn: () => Promise<T>): Promise<T> => fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock:               noopLock,
    persistSession:     true,
    detectSessionInUrl: false,
    autoRefreshToken:   true,
    storageKey:         'burbuja-supabase-session',
  },
})
