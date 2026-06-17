import type { MiddlewareHandler } from 'hono'
import { auth } from '../auth.js'

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  c.set('session', session)
  c.set('userId', session.user.id)

  await next()
}

export const requireRole = (roles: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const session = c.get('session')

    if (!session) {
      return c.json({ error: 'No autorizado' }, 401)
    }

    // El rol se guarda en metadata del usuario de better-auth
    const userRole = (session.user as { role?: string }).role ?? ''

    if (!roles.includes(userRole)) {
      return c.json({ error: 'Sin permisos para esta acción' }, 403)
    }

    await next()
  }
}
