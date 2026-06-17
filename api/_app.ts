import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth } from './auth.js'
import { requireAuth } from './middleware/auth.js'
import clientesRouter   from './routes/clientes.js'
import productosRouter  from './routes/productos.js'
import usuariosRouter   from './routes/usuarios.js'
import pedidosRouter    from './routes/pedidos.js'
import produccionRouter from './routes/produccion.js'
import dashboardRouter  from './routes/dashboard.js'

const app = new Hono().basePath('/api')

// ─── Middleware global ────────────────────────────────────────────────────────

app.use('*', logger())

const isProd = process.env.NODE_ENV === 'production'

app.use('*', cors({
  origin: isProd
    ? [
        process.env.BETTER_AUTH_URL ?? '',
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
      ].filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:3000',
        'http://localhost:3001',
      ],
  credentials: true,
}))

// ─── Auth (better-auth maneja /api/auth/*) ───────────────────────────────────
// app.use con wildcard matchea rutas anidadas: /auth/sign-in/email, /auth/get-session, etc.

app.use('/auth/*', (c) => auth.handler(c.req.raw))

// ─── Rutas del negocio (requieren sesión válida) ─────────────────────────────

app.use('/clientes/*',   requireAuth)
app.use('/productos/*',  requireAuth)
app.use('/usuarios/*',   requireAuth)
app.use('/pedidos/*',    requireAuth)
app.use('/produccion/*', requireAuth)
app.use('/dashboard/*',  requireAuth)

app.route('/clientes',   clientesRouter)
app.route('/productos',  productosRouter)
app.route('/usuarios',   usuariosRouter)
app.route('/pedidos',    pedidosRouter)
app.route('/produccion', produccionRouter)
app.route('/dashboard',  dashboardRouter)

export default app
