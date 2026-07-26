# MiniPost — Agente Comercial Inteligente para PyMEs

MVP de hackathon: un agente de IA que analiza ventas, inventario y clientes de una PyME, genera recomendaciones y **ejecuta acciones reales** sobre la base de datos.

Todo corre con **Supabase Cloud** y **Gemini**. Sin Docker, sin Supabase CLI y sin backend propio.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Base de datos y auth:** Supabase Cloud (PostgreSQL + Auth + Realtime)
- **IA:** Gemini con *function calling*, ejecutándose en el navegador
- **Deploy:** Netlify, Vercel o cualquier hosting estático

## Arquitectura

```
React ─┬─> Supabase Auth        (login y registro)
       ├─> PostgreSQL + Realtime (datos en vivo)
       └─> Agente Gemini ──> herramientas ──> Supabase
```

No hay servidor intermedio: el agente vive en el navegador, pide herramientas a Gemini y las ejecuta contra Supabase. El descuento de inventario al vender lo hace un **trigger de PostgreSQL** en el servidor.

---

## Puesta en marcha

Requisitos: **Node.js 20+** y una cuenta de Supabase (gratis).

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Elige región y contraseña de base de datos (la contraseña no la usa la app, solo el panel).

### 3. Ejecutar el esquema SQL

1. Abre **SQL Editor** → **New query**.
2. Copia y pega **todo** el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. Pulsa **Run**.

El script crea tablas, RLS, triggers, la función `setup_new_user` (datos demo al registrarse) y habilita Realtime. Es idempotente: puedes volver a ejecutarlo.

Ver también [`supabase/README.md`](supabase/README.md).

### 4. Configurar Authentication

**Authentication** → **Sign In / Providers** → **Email**:

- Activa **Email**.
- Desactiva **Confirm email** (para la demo del hackathon).

### 5. Copiar credenciales al `.env`

**Project Settings** → **API Keys** → copia **Project URL** y la clave **anon** (public).

Crea `.env` en la raíz (usa [`.env.example`](.env.example) como plantilla):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GEMINI_API_KEY=AIza...
```

La API key de Gemini la obtienes en [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### 6. Arrancar

```bash
npm run dev
```

Abre **http://localhost:5173**.

> Vite lee el `.env` solo al arrancar. Si lo editas, reinicia el servidor.
> Si falta configuración, la app muestra una pantalla con los pasos pendientes en vez de fallar.

---

## Primer uso

1. Entra a `/signup` y regístrate con tu nombre y el nombre del negocio.
2. Se llama a `setup_new_user` y se crean automáticamente tu empresa y los **datos demo**: 8 productos, inventario, 5 clientes y ventas históricas.
3. Explora Dashboard, POS, Productos, Inventario, Clientes y Agente IA.

Los datos demo están preparados para que el agente encuentre problemas reales: Coca Cola y Azúcar por debajo del mínimo, Brownie con mucho stock y una sola venta, y María González sin comprar desde hace 35 días.

## Demo de 3 minutos

1. **Login** → el Dashboard muestra ventas del día, stock bajo, alertas y recomendaciones.
2. **POS** → agrega Coca Cola y Brownie, elige un cliente y pulsa **Registrar venta**.
3. **Inventario** → el stock ya bajó solo (trigger PG + Realtime).
4. **Agente IA** → **Analizar negocio**. El agente consulta inventario, ventas y clientes, y crea alertas y 3 recomendaciones.
5. **Aceptar y ejecutar** una recomendación:
   - *Crear promoción* → aparece una promoción activa nueva.
   - *Reponer stock* → el inventario sube de verdad.
   - *Contactar cliente* → se registra el contacto programado.

Para repetir el ensayo, borra tu usuario en **Authentication → Users** y vuelve a registrarte, o usa otro correo.

## Cómo funciona el agente

El bucle vive en [`src/features/agent/agentService.ts`](src/features/agent/agentService.ts):

1. Se envía el prompt del sistema y las declaraciones de herramientas a Gemini.
2. Gemini responde pidiendo llamadas a funciones.
3. Cada llamada se ejecuta contra los datos del negocio y se le devuelve el resultado.
4. El ciclo se repite (máximo 6 turnos) hasta que produce el resumen final.

### Herramientas disponibles

| Herramienta | Qué hace |
|---|---|
| `getInventory` | Lee productos, precios y stock |
| `getLowStock` | Filtra los productos bajo mínimo |
| `getSales` | Resume ventas y unidades vendidas de 30 días |
| `getCustomers` | Lista clientes y días sin comprar |
| `createAlert` | Crea una alerta en Supabase |
| `createRecommendation` | Crea una recomendación aceptable con un clic |
| `createPromotion` | Crea una promoción activa |

Lo importante para la presentación: el agente no solo responde, **usa herramientas, decide y escribe en la base de datos**.

---

## Estructura del proyecto

```
MINIPOST/
├── src/
│   ├── components/         # ui, layout, shared, auth
│   ├── features/
│   │   ├── agent/          # agentService, tools, prompt, actions, AgentPage
│   │   ├── auth/           # login y registro
│   │   ├── customers/
│   │   ├── inventory/
│   │   ├── pos/
│   │   └── products/
│   ├── hooks/              # useAuth, useCompanyData (fetch + Realtime)
│   ├── lib/                # supabase, gemini, db, utils
│   ├── pages/              # DashboardPage
│   └── types/              # database, models
├── supabase/
│   └── schema.sql          # Ejecutar en SQL Editor (sin CLI)
├── netlify.toml
└── README.md
```

## Modelo de datos en PostgreSQL

```
companies              → { id, name, created_at }
profiles               → { id → auth.users, company_id, full_name, role }
products               → { company_id, name, sku, price, active }
inventory              → { product_id, quantity, min_stock }
customers              → { company_id, name, email, phone, last_purchase_at }
sales                  → { company_id, customer_id, total }
sale_items             → { sale_id, product_id, quantity, unit_price }
alerts                 → { company_id, type, title, message, status }
recommendations        → { company_id, type, title, action_type, metadata, status }
promotions             → { company_id, product_id, discount_pct, status }
```

Decisiones clave:

- **Inventario en tabla separada** (`inventory`), unida a `products`.
- **Líneas de venta normalizadas** en `sale_items`.
- **Triggers PG** descuentan stock al insertar ventas y actualizan `last_purchase_at` del cliente.

La seguridad usa **Row Level Security (RLS)**: cada usuario solo ve datos de su `company_id`.

---

## Deploy

### Netlify / Vercel

1. Conecta el repositorio. Build: `npm run build`, publish: `dist` (ya está en [`netlify.toml`](netlify.toml)).
2. Añade las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_GEMINI_API_KEY` en **Environment variables**.
3. En Supabase → **Authentication → URL Configuration**, agrega tu dominio de producción a **Redirect URLs** si usas magic links (no aplica con email/password simple).

## Nota sobre la API key de Gemini

El agente corre en el navegador, así que la key de Gemini viaja al cliente. Es un compromiso aceptable para una demo de hackathon. Para producción, muévela detrás de un servidor o Edge Function y restringe la key por dominio en Google Cloud Console.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| Sale "Conecta tu proyecto de Supabase Cloud" | Rellena el `.env` con URL y anon key reales y reinicia `npm run dev`. |
| Error al registrarse / sin datos demo | Ejecuta `supabase/schema.sql` en SQL Editor. Revisa que exista la función `setup_new_user`. |
| "Tu cuenta no tiene negocio asociado" | El RPC falló: revisa la consola del navegador y los logs de Supabase. |
| El botón "Analizar negocio" está deshabilitado | Falta `VITE_GEMINI_API_KEY` en el `.env`. |
| El agente responde pero no crea nada | Revisa la consola: suele ser RLS o falta de `company_id` en el perfil. |
| El stock no baja tras una venta | Verifica que el trigger `on_sale_item_insert` exista (vuelve a ejecutar `schema.sql`). |
