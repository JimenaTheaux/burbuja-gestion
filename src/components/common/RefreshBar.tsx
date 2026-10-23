import { useEffect, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'

// Solo aparece si una carga sigue en curso después de este tiempo: los
// refetch cortos (o en segundo plano rápidos) no muestran nada.
const DEMORA_MS = 400

export function RefreshBar() {
  const isFetching = useIsFetching() > 0
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isFetching) return
    const t = setTimeout(() => setVisible(true), DEMORA_MS)
    return () => {
      clearTimeout(t)
      setVisible(false)
    }
  }, [isFetching])

  if (!isFetching || !visible) return null
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 2,
      zIndex: 9999,
      overflow: 'hidden',
      background: 'rgba(27,158,214,0.15)',
      pointerEvents: 'none',
    }}>
      <div style={{
        position:   'absolute',
        top:        0,
        left:       0,
        height:     '100%',
        width:      '40%',
        background: '#7EB8E8',
        animation:  'progress 1s ease infinite',
      }} />
    </div>
  )
}
