import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema.js'

// Fallback evita que neon() lance TypeError al iniciar si la variable no está seteada.
// La función arrancará, y la query fallará con un error claro en lugar de FUNCTION_INVOCATION_FAILED.
const sql = neon(process.env.DATABASE_URL ?? 'postgresql://not-configured/limpimax')

export const db = drizzle(sql, { schema })

export type DB = typeof db
