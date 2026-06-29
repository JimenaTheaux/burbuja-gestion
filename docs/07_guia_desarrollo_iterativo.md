# 07 — Guía de Desarrollo Iterativo

## Filosofía
Lanzar simple, lanzar rápido. El MVP debe funcionar y ser usado. Cada decisión técnica prioriza velocidad de entrega y facilidad de mantenimiento.

El proyecto base existe en `github.com/JimenaTheaux/burbuja-gestion` y levanta en `localhost:5173`.

---

## Orden de desarrollo

### FASE 1 — Setup del proyecto
1. Limpiar identidad visual de Limpimax: reemplazar colores, nombre, logo en manifest y PWA
2. Actualizar `tailwind.config.ts` con los tokens de `08_estilos_y_diseno.md`
3. Crear tablas en Supabase (proyecto "burbuja") desde `06_estructura_de_datos.md`
   - Incluye el campo nuevo `costo_produccion` en `productos`
   - Incluye el campo nuevo `costo_snapshot` en `pedido_items`
4. Ejecutar `supabase/rpcs_and_indexes.sql` — verificar RPC e índices
5. Configurar RLS por tabla y por rol
6. **Commit:** `feat: burbuja setup — tokens, schema, rls`

### FASE 2 — Autenticación y routing
1. Pantalla de login (float labels, colores Burbuja, sin logo de Limpimax)
2. Hook `useAuth` consumiendo Supabase Auth + tabla `perfiles`
3. Routing protegido por rol (`ProtectedRoute`)
4. **AdminLayout:** Sidebar blanco colapsable (desktop) + HamburgerMenu + BottomNav (mobile)
5. Probar login con usuario admin antes de avanzar
6. **Commit:** `feat: auth and admin layout`

### FASE 3 — ABM base
1. ABM de Clientes (lista + drawer crear/editar)
2. ABM de Productos (lista + drawer crear/editar — incluir campo `costo_produccion`)
3. Gestión de Usuarios básica
4. **Commit:** `feat: clients and products ABM`

### FASE 4 — Módulo de pedidos
1. Formulario crear pedido en drawer lateral (guardar `costo_snapshot` al crear ítem)
2. Lista de pedidos: tabla con tabs + filtros + badges de estado
3. Detalle de pedido en drawer + historial de estados
4. Editar pedido + alerta de precio desactualizado
5. Anular pedido con motivo
6. Probar flujo completo: crear → confirmar → cerrar → ver KPI margen
7. **Commit:** `feat: orders module`

### FASE 5 — Dashboard
1. KPIs del día: pedidos · cobrado · pendiente · margen bruto
2. Gráfico evolución semanal (Chart.js)
3. Tablero de estados (conteo por estado)
4. Dashboard de ventas con selector de rango y KPI de margen
5. **Commit:** `feat: dashboard and KPIs`

### FASE 6 — Vistas operativas (Admin)
1. Página `/produccion` — lista de pedidos en_produccion/listo_reparto, sin precios
2. Página `/reparto` — cards con pedidos listo_reparto/en_reparto/entrega_fallida
3. Acciones de avance de estado desde ambas vistas
4. **Commit:** `feat: production and delivery views`

### FASE 7 — Documentos, cobros y egresos
1. Factura imprimible por pedido
2. Compartir por WhatsApp (html2canvas + Web Share API)
3. Edición de cobro en pedidos cerrados
4. Módulo de egresos completo
5. **Commit:** `feat: documents, billing and expenses`

### FASE 8 — Polish y deploy
1. Íconos PWA definitivos con logo Burbuja
2. Revisión UX en celular Android real
3. Deploy en Vercel + variables de entorno
4. **Commit:** `feat: branding and deploy`

---

## Git

### Estructura de ramas
```
main    → producción
dev     → desarrollo activo
feat/X  → funcionalidades nuevas
fix/X   → correcciones
```

### Convención de commits
```
feat:     nueva funcionalidad
fix:      corrección de bug
refactor: mejora sin cambio funcional
style:    cambios de UI/CSS
docs:     documentación
```

### .gitignore mínimo obligatorio
```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

---

## Prompts tipo para Claude

### Nueva funcionalidad
```
Proyecto: Burbuja Gestión — PWA gestión de pedidos (empresa limpieza argentina).
Stack: React 19 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (DB + Auth + RLS + RPC).
Iconos: lucide-react exclusivamente. Cero emojis.
Docs de contexto adjuntos: [adjuntar los .md relevantes]

Necesito implementar: [FUNCIONALIDAD]
Comportamiento esperado: [descripción del punto en 04_funcionalidades_por_modulo.md]

ESTILO OBLIGATORIO (ver 08_estilos_y_diseno.md):
- Color primary: #3DD6B5 (verde agua)
- Cards: border-radius 20px, fondo blanco, sombra mínima (0 1px 3px rgba(0,0,0,0.05))
- Inputs: float label
- Botón primary: bg #3DD6B5, border-radius 10px, mín 44px altura
- Drawer lateral: 50% desktop, 100% mobile, overlay oscuro
- Sidebar blanco colapsable: 240px / 64px
- Mobile: hamburguesa + bottom nav (Dashboard · Pedidos · Egresos)
- Mobile-first siempre
```

### Debug
```
Componente: [pegar código]
Problema: [descripción]
Comportamiento esperado: [citar requisito de 04_funcionalidades_por_modulo.md]
```

### Query de base de datos
```
Necesito la query Supabase (supabase-js) para: [caso de uso]
Schema en 06_estructura_de_datos.md.
Rol: admin — acceso total por RLS.
```

---

## Testing manual — checklist por fase

### Auth
- [ ] Login redirige al Dashboard
- [ ] Usuario inactivo no puede entrar
- [ ] Logout funciona desde cualquier vista

### Pedidos
- [ ] Cliente mayorista → precarga precio mayorista
- [ ] Al crear ítem, se guarda `costo_snapshot` del producto
- [ ] Total se recalcula al agregar/quitar ítems
- [ ] Total editado manualmente no se sobreescribe
- [ ] Confirmar pedido pasa a `en_produccion`
- [ ] Cerrar pedido registra cobro correctamente
- [ ] `estado_pago` se deriva de `forma_cobro`
- [ ] Pedido CERRADO no puede anularse

### KPI Margen
- [ ] Margen bruto = cobrado - (suma costo_snapshot × cantidad) para pedidos cerrados del período
- [ ] Cambiar `costo_produccion` en ABM NO modifica pedidos existentes (usan `costo_snapshot`)

### Datos
- [ ] Cambiar precio en ABM no modifica pedidos existentes
- [ ] Cambiar dirección de cliente no modifica pedidos anteriores

### UI/UX
- [ ] Sidebar blanco se colapsa a 64px sin texto
- [ ] Hamburguesa mobile abre menú con todas las páginas
- [ ] Bottom nav mobile muestra Dashboard · Pedidos · Egresos
- [ ] Drawers 50% desktop, 100% mobile
- [ ] Float labels funcionan en todos los inputs
- [ ] Iconos Lucide en todos los elementos — ningún emoji
- [ ] Botones mínimo 44px en mobile

---

## Checklist antes de lanzar MVP

- [ ] Flujo completo probado (crear → confirmar → producción → reparto → cerrar → cobro)
- [ ] KPI margen bruto verificado con datos reales
- [ ] Probado en celular Android con Chrome
- [ ] Sin errores de consola en producción
- [ ] Variables de entorno en Vercel (no en el código)
- [ ] Al menos 1 usuario admin creado
- [ ] Productos cargados con `costo_produccion`
- [ ] Clientes existentes migrados
- [ ] Sidebar colapsable probada en desktop
- [ ] Mobile: hamburguesa + bottom nav funcionan
- [ ] Login con usuario `produccion` probado: marcar "listo para reparto" actualiza la cola del repartidor
- [ ] Login con usuario `repartidor` probado: salir a repartir, cerrar pedido con cobro, registrar entrega fallida
- [ ] Repartidor probado sin conexión: encola acciones y sincroniza al volver online

---

## Checklist de pendientes para arrancar

- [ ] Logo PNG 512×512 confirmado (`Logo_sin_fondo_negro.png`)
- [ ] URL definitiva de deploy (para Supabase Auth allowlist)
- [ ] Lista de usuarios iniciales: nombre, email, rol
- [ ] Catálogo de productos con precios Y costos de producción
- [ ] Lista de clientes existentes

---

## Post-MVP — roadmap

> Roles operativos (Producción, Repartidor) y soporte offline para Repartidor ya están activos — ver `02_roles_y_permisos.md` y Módulos 3/4 en `04_funcionalidades_por_modulo.md`. Para dar de alta un usuario operativo: crearlo en Supabase Auth e insertar su perfil con el rol correspondiente en `perfiles`; el login lo redirige automáticamente a `/produccion` o `/repartidor`.

### Otras funcionalidades futuras
- Módulo de stock de insumos
- Reportes exportables (PDF/Excel)
- Integración WhatsApp automática (Twilio o similar)
- Notificaciones push (Web Push API)
- Facturación electrónica (AFIP)
