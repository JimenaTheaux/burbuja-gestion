import { useIsFetching } from '@tanstack/react-query'

export function RefreshBar() {
  const isFetching = useIsFetching() > 0
  if (!isFetching) return null
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
