# CANOO

Next.js (App Router) + TypeScript + Supabase (solo backend) listo para Vercel.

## 1) Configurar variables de entorno

### Local

1. Copia `.env.example` a `.env.local`
2. Rellena:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; nunca en el cliente)
   - `ADMIN_SECRET` (HMAC para cookie `adm`)
   - `NEXT_PUBLIC_APP_NAME` (opcional)

### Vercel

En Vercel → Project → Settings → Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET`
- `NEXT_PUBLIC_APP_NAME` (opcional)

## 2) Crear funciones SQL (RPC) en Supabase

Estas RPC hacen las operaciones transaccionales (evita carreras con dos tabs):

- `scripts/sql/assign_challenges_for_block.sql`
- `scripts/sql/complete_player_challenge.sql`

Ejecuta ambos en Supabase → SQL Editor.

## 3) Seed de retos (27 challenges)

1. Asegúrate de tener `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
2. Ejecuta:

```bash
npm run seed
```

También existe el endpoint admin `POST /api/admin/seed` si tu `admin_settings` ya está configurado.

## 4) Configurar contraseña admin (bcrypt)

`admin_settings` usa una fila con `id = true` y `admin_password_hash` (bcrypt).

1. Genera un hash bcrypt local (ejemplo):

```bash
node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync(process.argv[1], 10))" "TU_PASSWORD"
```

2. Guarda el hash en Supabase (SQL Editor), por ejemplo:

```sql
insert into public.admin_settings (id, admin_password_hash, game_status)
values (true, '<BCRYPT_HASH>', 'running')
on conflict (id) do update set admin_password_hash = excluded.admin_password_hash;
```

3. Entra en `/admin` y usa tu contraseña.

## Seguridad básica (qué hace el proyecto)

- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en Route Handlers y scripts (`src/lib/supabaseAdmin.ts`); el frontend nunca accede a tablas.
- Validación de inputs en endpoints (nickname, uuid, etc.).
- `src/middleware.ts` añade headers básicos en `/api/*` y gestiona CORS (solo permite mismo origen / localhost en dev).
- `GET /api/leaderboard` tiene rate-limit simple in-memory (1 req/seg por IP). En serverless puede reiniciarse; para producción “seria” usa un store compartido.
- Subidas grandes: el cliente sube el fichero directamente a Supabase Storage con URL firmada (`/api/upload-url` + PUT + `/api/upload-confirm`) para evitar límites de Vercel.

## Desarrollo

```bash
npm i
npm run dev
```
