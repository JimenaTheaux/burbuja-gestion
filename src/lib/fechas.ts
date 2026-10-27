// Fechas de día ('YYYY-MM-DD') en hora de Argentina, sin depender de la zona
// del dispositivo. toISOString() da el día en UTC: después de las 21 h de
// Argentina ya es "mañana" — nunca usarlo para fechas de día.
//
// Las columnas de día (fecha_produccion, fecha_pago, fecha_egreso, fecha_cobro)
// son DATE; created_at/updated_at son timestamptz. Del lado del servidor el
// equivalente es public.hoy_local().

export const ZONA_LOCAL = 'America/Argentina/Cordoba'
// Argentina no tiene horario de verano: el offset es fijo.
export const OFFSET_LOCAL = '-03:00'

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_LOCAL, year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Día local de un instante, 'YYYY-MM-DD'. */
export function aFechaLocal(instante: Date): string {
  const partes = Object.fromEntries(formato.formatToParts(instante).map(p => [p.type, p.value]))
  return `${partes.year}-${partes.month}-${partes.day}`
}

/** Hoy en Argentina, 'YYYY-MM-DD'. */
export function hoyLocal(): string {
  return aFechaLocal(new Date())
}

// Aritmética sobre 'YYYY-MM-DD': se opera en UTC al mediodía, así ningún
// offset puede mover el día.
const aUTC  = (fecha: string) => new Date(`${fecha}T12:00:00Z`)
const deUTC = (d: Date) => d.toISOString().slice(0, 10)

export function sumarDias(fecha: string, dias: number): string {
  const d = aUTC(fecha)
  d.setUTCDate(d.getUTCDate() + dias)
  return deUTC(d)
}

/** Misma semántica que Date#setMonth (31/03 - 1 mes → 03/03). */
export function sumarMeses(fecha: string, meses: number): string {
  const d = aUTC(fecha)
  d.setUTCMonth(d.getUTCMonth() + meses)
  return deUTC(d)
}

export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

/** Último día del mes (mes 1-12). */
export function ultimoDiaDelMes(anio: number, mes: number): string {
  return deUTC(new Date(Date.UTC(anio, mes, 0, 12)))
}

/** Rango de un día local para filtrar columnas timestamptz. */
export function inicioDiaLocal(fecha: string): string {
  return `${fecha}T00:00:00${OFFSET_LOCAL}`
}

export function finDiaLocal(fecha: string): string {
  return `${fecha}T23:59:59.999${OFFSET_LOCAL}`
}

/** Milisegundos hasta la próxima medianoche local. */
export function msHastaMedianocheLocal(): number {
  return Date.parse(inicioDiaLocal(sumarDias(hoyLocal(), 1))) - Date.now()
}
