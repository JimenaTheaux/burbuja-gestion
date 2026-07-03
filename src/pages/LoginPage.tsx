import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FloatInput } from '@/components/common/FloatInput'
import type { Rol } from '@/types'

const RUTA_POR_ROL: Record<Rol, string> = {
  admin:      '/admin',
  superadmin: '/admin',
  produccion: '/produccion',
  repartidor: '/repartidor',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, usuario, cargando } = useAuth()
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!cargando && usuario) {
      navigate(RUTA_POR_ROL[usuario.rol as Rol] ?? '/admin', { replace: true })
    }
  }, [cargando, usuario, navigate])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    setError('')

    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setLoading(false)
      emailRef.current?.focus()
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#3DD6B5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter Variable, sans-serif',
      }}
    >
      {/* SVG decorativo de fondo */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}
        viewBox="0 0 390 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path d="M0 480 C80 460, 160 500, 240 475 S340 450, 390 470 L390 600 L0 600Z" fill="#7EB8E8"/>
        <path d="M0 510 C90 490, 180 530, 270 505 S360 480, 390 500 L390 600 L0 600Z" fill="rgba(255,255,255,0.06)"/>
        <path d="M40 80 C40 60, 28 40, 28 25 C28 11, 38 2, 48 2 C58 2, 68 11, 68 25 C68 40, 56 60, 56 80 C56 90, 40 90, 40 80Z" fill="#7EB8E8"/>
        <path d="M330 50 C330 36, 321 20, 321 9 C321 -1, 329 -7, 337 -7 C345 -7, 353 -1, 353 9 C353 20, 344 36, 344 50 C344 58, 330 58, 330 50Z" fill="rgba(255,255,255,0.25)"/>
        <path d="M360 200 C360 191, 354 181, 354 174 C354 167, 359 163, 364 163 C369 163, 374 167, 374 174 C374 181, 368 191, 368 200 C368 206, 360 206, 360 200Z" fill="rgba(255,255,255,0.15)"/>
        <circle cx="22" cy="280" r="14" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <circle cx="22" cy="280" r="5" fill="rgba(255,255,255,0.1)"/>
        <circle cx="370" cy="360" r="22" fill="none" stroke="rgba(27,158,214,0.5)" strokeWidth="1"/>
        <circle cx="370" cy="360" r="8" fill="rgba(27,158,214,0.2)"/>
        <circle cx="55" cy="170" r="8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
        <path d="M310 120 Q325 150, 315 180 Q305 210, 320 240" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M75 320 Q88 345, 78 370 Q68 395, 82 420" fill="none" stroke="rgba(27,158,214,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
        <g transform="translate(18, 430)" opacity="0.2">
          <rect x="0" y="12" width="36" height="48" rx="4" fill="none" stroke="white" strokeWidth="1.2"/>
          <rect x="10" y="6" width="16" height="10" rx="3" fill="none" stroke="white" strokeWidth="1"/>
          <line x1="0" y1="28" x2="36" y2="28" stroke="white" strokeWidth="0.8"/>
          <circle cx="18" cy="42" r="5" fill="none" stroke="white" strokeWidth="0.8"/>
        </g>
        <g transform="translate(340, 30)" opacity="0.12">
          <rect x="0" y="9" width="28" height="36" rx="3" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="8" y="4" width="12" height="8" rx="2" fill="none" stroke="white" strokeWidth="0.8"/>
          <line x1="0" y1="20" x2="28" y2="20" stroke="white" strokeWidth="0.6"/>
        </g>
      </svg>

      {/* Logo mark + nombre */}
      <div style={{ zIndex: 1, textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            width: 48,
            height: 48,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.18)',
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src="/icons/icon-192.png" width={32} height={32} alt="" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '-0.3px' }}>
          Burbuja
        </div>
        <div style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
          Sistema de gestión de pedidos
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          zIndex: 1,
          width: '100%',
          maxWidth: 360,
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', marginBottom: 20 }}>
          Iniciá sesión
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FloatInput
            id="email"
            label="Email"
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
          />

          <div>
            <FloatInput
              id="password"
              label="Contraseña"
              ref={passwordRef}
              type={mostrarPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setMostrarPassword(prev => !prev)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#9CA3AF', padding: 0, lineHeight: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#3DD6B5' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            {error && (
              <p
                id="login-error"
                role="alert"
                style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: '#D32F2F' }}
              >
                {error}
              </p>
            )}
          </div>

          {/* Botón ingresar */}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Ingresar al sistema"
            style={{
              width: '100%',
              height: 48,
              background: canSubmit ? '#3DD6B5' : 'rgba(61,214,181,0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'Inter Variable, sans-serif',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              marginTop: 8,
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = '#28B99A' }}
            onMouseLeave={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = '#3DD6B5' }}
            onMouseDown={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p
        style={{
          zIndex: 1,
          fontSize: 11,
          color: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
          marginTop: 20,
        }}
      >
        ¿Sin acceso? Contactá con{' '}
        <a
          href="https://www.decidata.com.ar"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500, textDecoration: 'underline' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#fff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)' }}
        >
          deciDATA
        </a>
      </p>
    </div>
  )
}
