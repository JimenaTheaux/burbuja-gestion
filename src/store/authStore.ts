import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Rol } from '@/types'

interface UsuarioActual {
  id:     string
  nombre: string
  email:  string
  rol:    Rol
}

interface AuthState {
  usuario: UsuarioActual | null
  setUser: (usuario: UsuarioActual) => void
  logout:  () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      setUser: (usuario) => set({ usuario }),
      logout:  () => set({ usuario: null }),
    }),
    {
      name:        'burbuja-auth',
      partialize:  (state) => ({ usuario: state.usuario }),
    }
  )
)
