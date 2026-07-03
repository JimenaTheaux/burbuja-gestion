// Query keys centralizadas — evita typos y deja explícito qué prefijo
// invalida cada dominio. Las queries "compuestas" (ej. dashboard) deben
// anidarse bajo el prefijo del dominio del que dependen para que las
// mutaciones de ese dominio las invaliden automáticamente (invalidateQueries
// matchea por prefijo).
export const queryKeys = {
  pedidos:         { all: () => ['pedidos']         as const },
  clientes:        { all: () => ['clientes']        as const },
  productos:       { all: () => ['productos']       as const },
  categorias:      { all: () => ['categorias']      as const },
  egresos:         { all: () => ['egresos']         as const },
  usuarios:        { all: () => ['usuarios']        as const },
  produccion:      { all: () => ['produccion']      as const },
  dashboard:       { all: () => ['dashboard']       as const },
  perfilesActivos: () => ['perfiles-activos'] as const,
}
