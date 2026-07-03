// Monitoreo liviano de Core Web Vitals — solo console, sin dependencias externas.
export function initVitals() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`[vitals] LCP: ${Math.round(entry.startTime)}ms`)
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* no soportado */ }

  try {
    let cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(entry as any).hadRecentInput) cls += (entry as any).value
      }
      if (cls > 0.1) console.warn(`[vitals] CLS alto: ${cls.toFixed(3)}`)
    }).observe({ type: 'layout-shift', buffered: true })
  } catch { /* no soportado */ }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = entry as any
        const inp = e.processingEnd - e.processingStart
        if (inp > 200) console.warn(`[vitals] INP alto: ${Math.round(inp)}ms`)
      }
    }).observe({ type: 'event', buffered: true })
  } catch { /* no soportado */ }
}
