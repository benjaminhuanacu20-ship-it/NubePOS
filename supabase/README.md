# Supabase Cloud — MiniPost

Este proyecto **no usa Supabase CLI ni Docker**. Solo necesitas el dashboard web.

## Setup en 3 pasos

### 1. Crear proyecto

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.

### 2. Ejecutar el esquema

1. **SQL Editor** → **New query**
2. Pega el contenido completo de [`schema.sql`](schema.sql)
3. **Run**

Incluye:

- 10 tablas (`companies`, `profiles`, `products`, `inventory`, `customers`, `sales`, `sale_items`, `alerts`, `recommendations`, `promotions`)
- Políticas RLS por `company_id`
- Triggers: descuento de inventario al vender, `last_purchase_at` del cliente
- Función `setup_new_user(p_company_name, p_full_name)` con datos demo
- Publicación Realtime para alertas, recomendaciones y promociones

El script es **idempotente**: puedes ejecutarlo otra vez si añades cambios al archivo.

### 3. Auth para la demo

**Authentication** → **Sign In / Providers** → **Email**:

- Email activado
- **Confirm email** desactivado

## Credenciales para la app

**Project Settings** → **API Keys**:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon (public) key |

Ponlas en `.env` en la raíz del repo y ejecuta `npm run dev`.

## Resetear datos demo

- **Authentication → Users** → elimina el usuario y regístrate de nuevo, o
- Borra filas de tu `company_id` en el **Table Editor** (respeta FKs), o
- Crea otro proyecto Supabase y repite el setup.

## ¿Por qué no CLI?

Para hackathons y entornos sin Docker, el SQL Editor es suficiente: un solo archivo define todo el backend. Si más adelante quieres migraciones versionadas, puedes adoptar Supabase CLI sin cambiar la app.
