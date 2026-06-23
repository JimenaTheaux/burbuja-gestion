import React from 'react'
import { NavLink } from 'react-router-dom'

type NavIcon = React.ComponentType<{
  size?:      number
  color?:     string
  className?: string
  style?:     React.CSSProperties
}>

interface NavItem {
  to:    string
  icon:  NavIcon
  label: string
  end?:  boolean
}

interface Props {
  items: NavItem[]
}

export function BottomNav({ items }: Props) {
  return (
    <nav
      style={{
        position:       'fixed',
        bottom:         0,
        left:           0,
        right:          0,
        height:         56,
        background:     '#fff',
        borderTop:      '0.5px solid #D1D5DB',
        display:        'flex',
        alignItems:     'stretch',
        justifyContent: 'space-around',
        zIndex:         100,
        paddingBottom:  'max(0px, env(safe-area-inset-bottom))',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={{ textDecoration: 'none', flex: 1, display: 'flex' }}
          >
            {({ isActive }) => (
              <div
                style={{
                  flex:           1,
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            isActive ? 2 : 0,
                  padding:        '6px 8px',
                  cursor:         'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition:     'opacity 0.1s ease',
                  userSelect:     'none',
                }}
              >
                {/* Ícono — escala en activo */}
                <div
                  style={{
                    transform:  isActive ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.15s ease',
                    display:    'flex',
                    alignItems: 'center',
                  }}
                >
                  <Icon size={22} color={isActive ? '#0D5C8A' : '#9A9A9A'} />
                </div>

                {/* Label — solo en activo */}
                {isActive && (
                  <span
                    style={{
                      fontSize:   10,
                      fontWeight: 600,
                      color:      '#0D5C8A',
                      lineHeight: 1,
                      animation:  'fadeIn 0.15s ease',
                    }}
                  >
                    {item.label}
                  </span>
                )}

                {/* Dot indicador */}
                {isActive && (
                  <div
                    style={{
                      width:        4,
                      height:       4,
                      borderRadius: '50%',
                      background:   '#0D5C8A',
                      animation:    'fadeIn 0.2s ease',
                    }}
                  />
                )}
              </div>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
