import type { EstadoPedido } from '@/types'
import { ESTADO_CONFIG } from '@/types'

interface Props {
  estado: EstadoPedido
}

export function BadgeEstado({ estado }: Props) {
  const cfg = ESTADO_CONFIG[estado]
  return (
    <span style={{
      backgroundColor: cfg.bg,
      color:           cfg.color,
      fontSize:        9,
      fontWeight:      700,
      padding:         '2px 7px',
      borderRadius:    99,
      display:         'inline-block',
      whiteSpace:      'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// Badge genérico de rol
const ROL_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  admin:      { bg: '#EBF5FF', color: '#7EB8E8', label: 'ADMIN' },
  superadmin: { bg: '#EDE9FE', color: '#7C3AED', label: 'SUPERADMIN' },
  produccion: { bg: '#FFF3E0', color: '#F57C00', label: 'PRODUCCIÓN' },
  repartidor: { bg: '#E8F8F0', color: '#2E9E5C', label: 'REPARTIDOR' },
}

export function BadgeRol({ rol }: { rol: string }) {
  const cfg = ROL_CONFIG[rol] ?? { bg: '#F0F0F0', color: '#9A9A9A', label: rol.toUpperCase() }
  return (
    <span style={{
      backgroundColor: cfg.bg,
      color:           cfg.color,
      fontSize:        9,
      fontWeight:      700,
      padding:         '2px 7px',
      borderRadius:    99,
      display:         'inline-block',
    }}>
      {cfg.label}
    </span>
  )
}

// Badge activo/inactivo
export function BadgeActivo({ activo }: { activo: boolean }) {
  return (
    <span style={{
      backgroundColor: activo ? '#E8F8F0' : '#F0F0F0',
      color:           activo ? '#2E9E5C' : '#9A9A9A',
      fontSize:        9,
      fontWeight:      700,
      padding:         '2px 7px',
      borderRadius:    99,
      display:         'inline-block',
    }}>
      {activo ? 'ACTIVO' : 'INACTIVO'}
    </span>
  )
}
