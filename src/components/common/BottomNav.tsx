import React, { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'

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
  items:         NavItem[]
  logoutAction?: () => Promise<void> | void
}

export function BottomNav({ items, logoutAction }: Props) {
  const [showLogoutSheet, setShowLogoutSheet] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showLogoutSheet) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogoutSheet(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showLogoutSheet])

  useEffect(() => {
    if (showLogoutSheet) cancelRef.current?.focus()
  }, [showLogoutSheet])

  const handleLogout = async () => {
    setShowLogoutSheet(false)
    await logoutAction?.()
  }

  const totalItems    = items.length + (logoutAction ? 1 : 0)
  const showLabel     = totalItems <= 4

  return (
    <>
      <nav
        style={{
          position:       'fixed',
          bottom:         0,
          left:           0,
          right:          0,
          height:         'calc(56px + env(safe-area-inset-bottom))',
          background:     '#fff',
          borderTop:      '0.5px solid #E5E5EA',
          display:        'flex',
          alignItems:     'stretch',
          justifyContent: 'space-around',
          zIndex:         100,
          paddingBottom:  'env(safe-area-inset-bottom)',
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
                  <div
                    style={{
                      transform:  isActive ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                      display:    'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Icon size={22} color={isActive ? '#3DD6B5' : '#9A9A9A'} />
                  </div>

                  {isActive && (
                    <span
                      style={{
                        fontSize:   10,
                        fontWeight: 600,
                        color:      '#3DD6B5',
                        lineHeight: 1,
                        animation:  'fadeIn 0.15s ease',
                      }}
                    >
                      {item.label}
                    </span>
                  )}

                  {isActive && (
                    <div
                      style={{
                        width:        4,
                        height:       4,
                        borderRadius: '50%',
                        background:   '#3DD6B5',
                        animation:    'fadeIn 0.2s ease',
                      }}
                    />
                  )}
                </div>
              )}
            </NavLink>
          )
        })}

        {logoutAction && (
          <button
            onClick={() => setShowLogoutSheet(true)}
            aria-label="Cerrar sesión"
            style={{
              flex:                    1,
              display:                 'flex',
              flexDirection:           'column',
              alignItems:              'center',
              justifyContent:          'center',
              gap:                     showLabel ? 2 : 0,
              padding:                 '6px 8px',
              background:              'transparent',
              border:                  'none',
              cursor:                  'pointer',
              WebkitTapHighlightColor: 'transparent',
              userSelect:              'none',
            }}
          >
            <LogOut size={22} color="#9CA3AF" />
            {showLabel && (
              <span style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1 }}>
                Salir
              </span>
            )}
          </button>
        )}
      </nav>

      {showLogoutSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar cierre de sesión"
          onClick={() => setShowLogoutSheet(false)}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.4)',
            zIndex:     300,
            display:    'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background:    '#fff',
              width:         '100%',
              borderRadius:  '16px 16px 0 0',
              padding:       '20px 24px',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', marginBottom: 6, textAlign: 'center' }}>
              ¿Cerrar sesión?
            </p>
            <p style={{ fontSize: 12, color: '#8E8E93', marginBottom: 20, textAlign: 'center' }}>
              Vas a volver a la pantalla de inicio.
            </p>
            <button
              onClick={handleLogout}
              style={{
                width:        '100%',
                height:       48,
                background:   '#D32F2F',
                color:        '#fff',
                border:       'none',
                borderRadius: 10,
                fontSize:     14,
                fontWeight:   500,
                marginBottom: 8,
                cursor:       'pointer',
              }}
            >
              Sí, cerrar sesión
            </button>
            <button
              ref={cancelRef}
              onClick={() => setShowLogoutSheet(false)}
              style={{
                width:      '100%',
                height:     44,
                background: 'transparent',
                color:      '#8E8E93',
                border:     'none',
                fontSize:   14,
                cursor:     'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
