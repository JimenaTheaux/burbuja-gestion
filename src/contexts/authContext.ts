import { createContext } from 'react'
import type { Rol } from '@/types'

export interface UsuarioActual {
  id:     string
  nombre: string
  email:  string
  rol:    Rol
}

export interface AuthContextValue {
  usuario:      UsuarioActual | null
  cargando:     boolean
  autenticado:  boolean
  login:        (email: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
