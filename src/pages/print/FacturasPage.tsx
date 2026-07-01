import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatUnidad, type EstadoPedido } from '@/types'

// ─── Tipos locales (la página fetchea directamente y mapea a camelCase) ─────────

interface FacturaItem {
  id:                   string
  productoNombre:       string
  productoPresentacion: string | null
  cantidad:             string
  precioUnitario:       string
  bidonNuevo:           boolean
}

interface FacturaPedido {
  id:               string
  numero:           number
  estado:           EstadoPedido
  tipoPrecio:       string
  direccionEntrega: string | null
  fechaProduccion:  string | null
  totalCalculado:   string
  totalManual:      string | null
  costoEnvio:       string
  costoBidones:     string
  formaCobro:       string | null
  montoCobrado:     string | null
  notasProduccion:  string | null
  createdAt:        string
  clienteNombre:    string | null
  items:            FacturaItem[]
}

function formatPeso(n: number | string | null | undefined) {
  if (!n) return '0,00'
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
}

function formatFecha(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Factura individual (1/4 de A4) ──────────────────────────────────────────

function Factura({ pedido, posicion }: { pedido: FacturaPedido; posicion: 0|1|2|3 }) {
  const total = Number(pedido.totalManual ?? pedido.totalCalculado)

  // Bordes de corte: solo los bordes internos (entre facturas)
  const borderRight  = posicion === 0 || posicion === 2 ? '1px dashed #bbb' : 'none'
  const borderBottom = posicion === 0 || posicion === 1 ? '1px dashed #bbb' : 'none'

  return (
    <div className="factura-cell" style={{ borderRight, borderBottom }}>

      {/* Encabezado empresa — fila única, compacta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingBottom: 4, borderBottom: '1.5px solid #3DD6B5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 16, height: 16, borderRadius: 3, background: '#3DD6B5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 6, fontWeight: 900, flexShrink: 0,
          }}>LM</div>
          <span style={{ fontWeight: 900, fontSize: 9, color: '#3DD6B5' }}>BURBUJA</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 9, color: '#1C1C1E' }}>
            P-{String(pedido.numero).padStart(5, '0')}
          </div>
          <div style={{ fontSize: 7, color: '#8E8E93' }}>
            {formatFecha(pedido.fechaProduccion ?? pedido.createdAt)}
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: 4, padding: '3px 5px', background: '#F5F7F9', borderRadius: 3, flexShrink: 0 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {pedido.clienteNombre ?? '—'}
        </div>
        {pedido.direccionEntrega && (
          <div style={{ fontSize: 7, color: '#8E8E93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pedido.direccionEntrega}
          </div>
        )}
        <span style={{
          background: pedido.tipoPrecio === 'mayorista' ? '#EBF5FF' : '#F0F0F0',
          color:      pedido.tipoPrecio === 'mayorista' ? '#7EB8E8' : '#9A9A9A',
          fontSize: 6, fontWeight: 700, padding: '0 3px', borderRadius: 99,
        }}>
          {pedido.tipoPrecio.toUpperCase()}
        </span>
      </div>

      {/* Tabla de ítems — flex:1 con overflow:hidden para nunca desbordar */}
      <div style={{ flex: '1 1 0', overflow: 'hidden', minHeight: 0, marginBottom: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'inherit' }}>
          <thead>
            <tr style={{ background: '#E8F4FC' }}>
              <th style={{ padding: '1px 2px', textAlign: 'left', fontWeight: 700 }}>Producto</th>
              <th style={{ padding: '1px 2px', textAlign: 'center', fontWeight: 700, width: 24 }}>Cant</th>
              <th style={{ padding: '1px 2px', textAlign: 'right', fontWeight: 700, width: 38 }}>Precio</th>
              <th style={{ padding: '1px 2px', textAlign: 'right', fontWeight: 700, width: 38 }}>Sub</th>
            </tr>
          </thead>
          <tbody>
            {pedido.items?.map((item, i) => {
              const sub = Number(item.cantidad) * Number(item.precioUnitario)
              return (
                <tr key={item.id ?? i} style={{ borderBottom: '0.3px solid #E5E7EB' }}>
                  <td style={{ padding: '1px 2px', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.productoNombre}
                    {item.productoPresentacion && <span style={{ color: '#6B7280' }}> {item.productoPresentacion}</span>}
                    {item.bidonNuevo && <span style={{ color: '#F57C00', fontWeight: 700 }}> 🆕</span>}
                  </td>
                  <td style={{ padding: '1px 2px', textAlign: 'center', fontWeight: 700 }}>{item.cantidad}</td>
                  <td style={{ padding: '1px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>${formatPeso(item.precioUnitario)}</td>
                  <td style={{ padding: '1px 2px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>${formatPeso(sub)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div style={{ borderTop: '1px solid #E5E5EA', paddingTop: 3, flexShrink: 0 }}>
        {Number(pedido.costoEnvio) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8E8E93', marginBottom: 1 }}>
            <span>Envío</span>
            <span>${formatPeso(pedido.costoEnvio)}</span>
          </div>
        )}
        {Number(pedido.costoBidones) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8E8E93', marginBottom: 1 }}>
            <span>Bidones</span>
            <span>${formatPeso(pedido.costoBidones)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10, color: '#3DD6B5', marginTop: 2 }}>
          <span>TOTAL</span>
          <span>${formatPeso(total)}</span>
        </div>
      </div>

      {/* Cobro (si está registrado) */}
      {pedido.formaCobro && pedido.formaCobro !== 'pendiente' && (
        <div style={{ marginTop: 3, padding: '1px 4px', background: '#E8F8F0', borderRadius: 2, color: '#2E9E5C', fontWeight: 600, flexShrink: 0 }}>
          Cobrado: {pedido.formaCobro}{pedido.montoCobrado ? ` $${formatPeso(pedido.montoCobrado)}` : ''}
        </div>
      )}

      {/* Notas */}
      {pedido.notasProduccion && (
        <div style={{ marginTop: 2, color: '#8E8E93', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {pedido.notasProduccion}
        </div>
      )}
    </div>
  )
}

// ─── Hoja A4 con 4 facturas ───────────────────────────────────────────────────

function HojaA4({ pedidos, indice }: { pedidos: (FacturaPedido | null)[]; indice: number }) {
  const grupo = [...pedidos]
  while (grupo.length < 4) grupo.push(null)

  return (
    <div className="hoja-a4" style={{ pageBreakAfter: 'always' }}>
      {grupo.map((p, i) =>
        p ? (
          <Factura key={p.id} pedido={p} posicion={i as 0|1|2|3} />
        ) : (
          <div key={`vacio-${indice}-${i}`} className="factura-cell factura-vacia"
            style={{
              borderRight:  i === 0 || i === 2 ? '1px dashed #bbb' : 'none',
              borderBottom: i === 0 || i === 1 ? '1px dashed #bbb' : 'none',
            }}
          />
        )
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FacturasPage() {
  const [searchParams] = useSearchParams()
  const idsStr = searchParams.get('ids') ?? ''
  const ids    = idsStr.split(',').map(s => s.trim()).filter(Boolean)

  const [pedidos,  setPedidos]  = useState<FacturaPedido[]>([])
  const [loading,  setLoading]  = useState(true)
  const [errores,  setErrores]  = useState<string[]>([])

  useEffect(() => {
    if (!ids.length) { setLoading(false); return }

    Promise.allSettled(ids.map(async (id) => {
      const { data: p, error: pErr } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre)')
        .eq('id', id)
        .maybeSingle()
      if (pErr || !p) throw new Error(pErr?.message ?? 'No encontrado')

      const { data: items } = await supabase
        .from('pedido_items')
        .select('*, productos(nombre, fragancia, presentacion, unidad_medida, precio_minorista, precio_mayorista)')
        .eq('pedido_id', id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: FacturaPedido = {
        id:               p.id,
        numero:           p.numero,
        estado:           p.estado,
        tipoPrecio:       p.tipo_precio,
        direccionEntrega: p.direccion_entrega,
        fechaProduccion:  p.fecha_produccion,
        totalCalculado:   String(p.total_calculado ?? '0'),
        totalManual:      p.total_manual != null ? String(p.total_manual) : null,
        costoEnvio:       String(p.costo_envio ?? '0'),
        costoBidones:     String(p.costo_bidones ?? '0'),
        formaCobro:       p.forma_cobro,
        montoCobrado:     p.monto_cobrado != null ? String(p.monto_cobrado) : null,
        notasProduccion:  p.notas_produccion,
        createdAt:        p.created_at,
        clienteNombre:    (p as any).clientes?.nombre ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (items ?? []).map((item: any): FacturaItem => ({
          id:                   item.id,
          productoNombre:       item.productos?.nombre ?? '',
          productoPresentacion: item.productos?.presentacion != null && item.productos?.unidad_medida
            ? formatUnidad(Number(item.productos.presentacion), item.productos.unidad_medida)
            : null,
          cantidad:             String(item.cantidad),
          precioUnitario:       String(item.precio_unitario),
          bidonNuevo:           item.bidon_nuevo ?? false,
        })),
      }
      return mapped
    }))
      .then(results => {
        const ok:  FacturaPedido[] = []
        const err: string[]        = []
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') ok.push(r.value)
          else err.push(`P-${ids[i]}: ${(r.reason as Error)?.message ?? 'Error'}`)
        })
        setPedidos(ok)
        setErrores(err)
      })
      .finally(() => setLoading(false))
  }, [idsStr])

  // Auto-print cuando ya cargaron
  useEffect(() => {
    if (!loading && pedidos.length > 0) {
      const t = setTimeout(() => window.print(), 700)
      return () => clearTimeout(t)
    }
  }, [loading, pedidos.length])

  // Agrupar en páginas de 4
  const hojas: FacturaPedido[][] = []
  for (let i = 0; i < pedidos.length; i += 4) hojas.push(pedidos.slice(i, i + 4))
  if (!hojas.length && !loading) hojas.push([]) // página vacía para el mensaje

  return (
    <>
      {/* ── Estilos globales ── */}
      <style>{`
        /* ─── PRINT ─── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: white !important;
          }

          .no-print { display: none !important; }

          /* Cada hoja ocupa exactamente 1 A4 */
          .hoja-a4 {
            width: 210mm !important;
            height: 297mm !important;
            display: grid !important;
            grid-template-columns: 105mm 105mm !important;
            grid-template-rows: 148.5mm 148.5mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          /* Cada factura ocupa exactamente 1/4 de A4 */
          .factura-cell {
            width: 105mm !important;
            height: 148.5mm !important;
            overflow: hidden !important;
            padding: 6mm !important;
            display: flex !important;
            flex-direction: column !important;
            font-family: Arial, sans-serif !important;
            font-size: 6.5pt !important;
            line-height: 1.25 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .factura-vacia {
            width: 105mm !important;
            height: 148.5mm !important;
            background: white !important;
          }
        }

        /* ─── SCREEN — preview proporcional a A4 ─── */
        @media screen {
          body { background: #E5E7EB; font-family: Arial, sans-serif; }

          .hoja-a4 {
            width: 794px;
            height: 1123px;
            display: grid;
            grid-template-columns: 397px 397px;
            grid-template-rows: 561px 561px;
            background: white;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
            margin: 0 auto 32px;
            overflow: hidden;
          }

          .factura-cell {
            width: 397px;
            height: 561px;
            overflow: hidden;
            padding: 16px;
            display: flex;
            flex-direction: column;
            font-size: 8px;
            line-height: 1.3;
            box-sizing: border-box;
          }

          .factura-vacia {
            width: 397px;
            height: 561px;
            background: #FAFAFA;
          }
        }
      `}</style>

      {/* ── Barra de controles (no se imprime) ── */}
      <div className="no-print" style={{
        position:   'sticky',
        top:        0,
        zIndex:     10,
        background: '#1C1C1E',
        padding:    '10px 20px',
        display:    'flex',
        alignItems: 'center',
        gap:        12,
        flexWrap:   'wrap',
      }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>BURBUJA</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {loading
            ? 'Cargando…'
            : `${pedidos.length} factura${pedidos.length !== 1 ? 's' : ''} · ${hojas.length} hoja${hojas.length !== 1 ? 's' : ''} A4`
          }
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            disabled={loading || !pedidos.length}
            style={{
              background: 'white', color: '#3DD6B5', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontWeight: 700,
              cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: (loading || !pedidos.length) ? 0.4 : 1,
            }}
          >
            <Printer size={14} /> Imprimir / Guardar PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 12px',
              cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <X size={14} /> Cerrar
          </button>
        </div>
      </div>

      {/* Errores */}
      {errores.length > 0 && (
        <div className="no-print" style={{
          background: '#FDECEA', padding: '8px 20px', fontSize: 12, color: '#D32F2F',
        }}>
          {errores.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Cargando */}
      {loading && (
        <p className="no-print" style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          Cargando facturas…
        </p>
      )}

      {/* Sin datos */}
      {!loading && !pedidos.length && (
        <p className="no-print" style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          No hay facturas para mostrar.
        </p>
      )}

      {/* ── Hojas A4 ── */}
      {!loading && pedidos.length > 0 && (
        <div style={{ padding: '32px 0' }}>
          {hojas.map((grupo, idx) => (
            <HojaA4 key={idx} pedidos={grupo} indice={idx} />
          ))}
        </div>
      )}
    </>
  )
}
