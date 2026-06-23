import { useState, useEffect, useRef } from 'react'

export function useScrollDirection() {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const lastScroll = useRef(0)

  useEffect(() => {
    const handler = () => {
      const current = window.scrollY
      // Solo actualizar si el cambio es significativo (evitar micro-cambios)
      if (Math.abs(current - lastScroll.current) < 4) return
      setDirection(current > lastScroll.current ? 'down' : 'up')
      lastScroll.current = current
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return direction
}
