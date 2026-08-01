# Guía de Reconstrucción de Infraestructura — JSADR

> Documento generado automáticamente para la **reconstrucción completa** de la infraestructura GitHub + Vercel + Neon Database, sin reutilizar configuraciones anteriores.

---

## Tabla de contenidos

1. [Inventario previo](#1-inventario-previo)
2. [Fase 1 — Eliminación completa](#2-fase-1--eliminación-completa)
3. [Fase 2 — Creación desde cero (GitHub)](#3-fase-2--creación-desde-cero-github)
4. [Fase 3 — Creación desde cero (Neon)](#4-fase-3--creación-desde-cero-neon)
5. [Fase 4 — Creación desde cero (Vercel)](#5-fase-4--creación-desde-cero-vercel)
6. [Fase 5 — Sincronización](#6-fase-5--sincronización)
7. [Fase 6 — Validaciones](#7-fase-6--validaciones)
8. [Configuración de webhooks en cada plataforma](#8-configuración-de-webhooks)
9. [Migración a PostgreSQL (Neon)](#9-migración-a-postgresql-neon)
10. [Resolución de problemas](#10-resolución-de-problemas)

---

## 1. Inventario previo

Antes de eliminar, anota los siguientes datos de los recursos actuales para tenerlos como referencia (NO para reutilizarlos):

### Recursos actuales a eliminar

| Plataforma | URL | Recurso | Acción |
|---|---|---|---|
| Vercel | https://vercel.com/jsadr | Proyecto Vercel actual | Eliminar |
| GitHub | https://github.com/jsadr-1029/jsadr | Repositorio | Eliminar |
| Neon | https://console.neon.tech/app/projects/rapid-darkness-56995142 | Proyecto + DB | Eliminar |

### Inventario temporal (completar antes de eliminar)

```
# Vercel
VERCEL_OLD_PROJECT_ID=________________
VERCEL_OLD_DOMAIN=________________
VERCEL_OLD_ENV_VARS=________________

# GitHub
GITHUB_OLD_REPO_URL=________________
GITHUB_OLD_WEBHOOKS=________________
GITHUB_OLD_SECRETS=________________

# Neon
NEON_OLD_PROJECT_ID=rapid-darkness-56995142
NEON_OLD_CONNECTION_STRING=postgresql://...
NEON_OLD_BRANCHES=________________
```

---

## 2. Fase 1 — Eliminación completa

> ⚠️ **NO procedas hasta haber completado el inventario anterior.**

### 2.1 Eliminar proyecto en Vercel

1. Inicia sesión en https://vercel.com/jsadr
2. Selecciona el proyecto actual
3. Ve a **Settings → Advanced → Delete Project**
4. Confirma escribiendo el nombre del proyecto
5. Verifica que los dominios asociados quedan liberados

### 2.2 Eliminar repositorio en GitHub

1. Ve a https://github.com/jsadr-1029/jsadr/settings
2. Baja hasta **Danger Zone → Delete this repository**
3. Confirma con el nombre del repo `jsadr-1029/jsadr`
4. Verifica que los webhooks configurados quedan eliminados

### 2.3 Eliminar proyecto en Neon

1. Ve a https://console.neon.tech/app/projects/rapid-darkness-56995142
2. **Settings → Delete project**
3. Confirma escribiendo el nombre del proyecto
4. Verifica que las credenciales (API keys) asociadas quedan revocadas

### 2.4 Limpiar referencias obsoletas

- Revoca tokens antiguos de GitHub, Vercel y Neon
- Elimina entradas DNS que apuntaban a recursos viejos
- Limpia webhooks huérfanos en servicios externos

---

## 3. Fase 2 — Creación desde cero (GitHub)

### 3.1 Crear nuevo repositorio

1. Ve a https://github.com/new
2. Configura:
   - **Owner:** `jsadr-1029`
   - **Repository name:** `jsadr`
   - **Description:** `Plataforma de gestión de préstamos JSADR`
   - **Visibility:** Private
   - **Initialize:** NO marcar ninguna opción (el código ya existe localmente)
3. Click **Create repository**

### 3.2 Configurar rama principal

```bash
cd /home/z/my-project
git init -b main
git add .
git commit -m "Initial commit: JSADR Plataforma reconstruida"
git remote add origin git@github.com:jsadr-1029/jsadr.git
git push -u origin main
```

### 3.3 Verificar archivos de configuración

Confirma que estos archivos existen en el repo:

- ✅ `.gitignore` (protege `.env`, `db/*.db`, etc.)
- ✅ `.env.example` (plantilla, SÍ se commitea)
- ✅ `.github/workflows/ci-cd.yml` (CI/CD)
- ✅ `vercel.json` (configuración de Vercel)
- ✅ `package.json` (dependencias)
- ✅ `prisma/schema.prisma` (modelo de datos)
- ✅ `tsconfig.json` (configuración TypeScript)

### 3.4 Configurar secretos para GitHub Actions

Ve a **Settings → Secrets and variables → Actions → New repository secret** y agrega:

| Nombre | Descripción |
|---|---|
| `VERCEL_TOKEN` | Token de Vercel (generado en el paso 5) |
| `VERCEL_ORG_ID` | Team ID de Vercel |
| `VERCEL_PROJECT_ID` | Project ID del nuevo proyecto en Vercel |

---

## 4. Fase 3 — Creación desde cero (Neon)

### 4.1 Crear nuevo proyecto Neon

1. Ve a https://console.neon.tech/app/projects
2. Click **New Project**
3. Configura:
   - **Name:** `jsadr-plataforma`
   - **PostgreSQL version:** 16 (latest stable)
   - **Region:** `AWS US East (Ohio) - us-east-2` (más cercano a Vercel iad1)
   - **Default branch:** `main`
4. Click **Create project**

### 4.2 Obtener cadena de conexión

Después de crear, Neon mostrará las cadenas de conexión. Copia:

```env
# Cadena principal (DDL, migraciones)
DATABASE_URL="postgresql://USER:PASSWORD@ep-COOL-REGION-POOLER.aws.neon.tech/DBNAME?sslmode=require&schema=public"

# Cadena directa (para prisma migrate)
DATABASE_URL_DIRECT="postgresql://USER:PASSWORD@ep-COOL-REGION.aws.neon.tech/DBNAME?sslmode=require&schema=public"
```

> 💡 Usa siempre la URL con `-pooler` para la app (serverless-friendly).

### 4.3 Crear API key de Neon

1. Ve a https://console.neon.tech/app/settings/api-keys
2. Click **Create new API key**
3. Name: `jsadr-plataforma-sync`
4. Copia el key (formato: `neon_xxxxxxxx...`)

### 4.4 Cambiar Prisma a PostgreSQL en producción

Edita `prisma/schema.prisma`:

```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
}
```

### 4.5 Aplicar migración a Neon

```bash
# Asegúrate de tener DATABASE_URL apuntando a Neon
export DATABASE_URL="postgresql://...neon.tech/dbname?sslmode=require&schema=public"

# Generar cliente
npx prisma generate

# Aplicar schema a Neon
npx prisma db push --accept-data-loss

# Verificar
npx prisma studio
```

### 4.6 Verificar conexión

```bash
# Script rápido de test
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRaw\`SELECT NOW()\`.then(r=>{console.log('OK:',r);process.exit(0)}).catch(e=>{console.error('ERROR:',e);process.exit(1)})"
```

---

## 5. Fase 4 — Creación desde cero (Vercel)

### 5.1 Crear nuevo proyecto Vercel

1. Ve a https://vercel.com/new
2. Selecciona el repo `jsadr-1029/jsadr`
3. Configura:
   - **Framework Preset:** Next.js (auto-detectado)
   - **Root Directory:** `./` (default)
   - **Build Command:** `prisma generate && next build` (definido en vercel.json)
   - **Output Directory:** `.next` (auto)
   - **Install Command:** `npm install --legacy-peer-deps` (definido en vercel.json)
4. Click **Deploy**

### 5.2 Configurar variables de entorno

Ve a **Settings → Environment Variables** y agrega TODAS estas variables:

#### Base de datos
| Key | Value | Environments |
|---|---|---|
| `DATABASE_URL` | `postgresql://...neon.tech/dbname?sslmode=require&schema=public` | Production, Preview, Development |

#### Secretos (generar con `openssl rand -hex 32`)
| Key | Environments |
|---|---|
| `JWT_SECRET` | Production, Preview |
| `JWT_REFRESH_SECRET` | Production, Preview |
| `API_ENCRYPTION_KEY` | Production, Preview |
| `OTP_CHAT_SECRET` | Production, Preview |
| `PORTAL_SESSION_SECRET` | Production, Preview |
| `ADMIN_SESSION_SECRET` | Production, Preview |

#### CORS
| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://jsadr.com.co,https://www.jsadr.com.co,https://preview-*.vercel.app` |

#### Plataformas de sincronización (opcional — puede configurarse desde el módulo de Seguridad)
| Key | Value |
|---|---|
| `GITHUB_TOKEN` | `ghp_xxx` (PAT con repo, workflow, webhook) |
| `GITHUB_OWNER` | `jsadr-1029` |
| `GITHUB_REPO` | `jsadr` |
| `GITHUB_WEBHOOK_SECRET` | (string aleatorio 32 chars) |
| `VERCEL_TOKEN` | `vercel_xxx` |
| `VERCEL_PROJECT_ID` | `prj_xxx` |
| `VERCEL_TEAM_ID` | `team_xxx` |
| `VERCEL_WEBHOOK_SECRET` | (string aleatorio 32 chars) |
| `NEON_API_KEY` | `neon_xxx` |
| `NEON_PROJECT_ID` | `ep-xxx` |
| `NEON_WEBHOOK_SECRET` | (string aleatorio 32 chars) |

#### Email
| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `jsa@jsadr.com.co` |
| `SMTP_PASS` | (app password de Gmail) |
| `SMTP_FROM` | `jsa@jsadr.com.co` |

#### App
| Key | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://jsadr.com.co` |
| `NODE_ENV` | `production` (automático en Vercel) |

### 5.3 Configurar dominio

1. Ve a **Settings → Domains**
2. Click **Add** → ingresa `jsadr.com.co`
3. Click **Add** → ingresa `www.jsadr.com.co`
4. Sigue las instrucciones de Vercel para configurar los registros DNS en tu proveedor:
   - **A record:** `@ → 76.76.21.21`
   - **CNAME:** `www → cname.vercel-dns.com`
5. Espera la verificación (5-30 min)

### 5.4 Trigger del primer despliegue

```bash
# Push a main dispara el deploy automáticamente
git push origin main
```

O desde el dashboard de Vercel: **Deployments → Redeploy**

---

## 6. Fase 5 — Sincronización

### 6.1 Verificar conexión GitHub ↔ Vercel

1. Ve a Vercel → **Settings → Git**
2. Confirma que el repo `jsadr-1029/jsadr` está conectado
3. Verifica que "Production Branch" = `main`

### 6.2 Verificar conexión Vercel ↔ Neon

1. Ve a Vercel → **Settings → Environment Variables**
2. Confirma que `DATABASE_URL` apunta a Neon
3. En Neon → **Branches**, deberías ver consultas activas tras el primer deploy

### 6.3 Verificar sincronización en el Módulo de Seguridad

1. Inicia sesión en la plataforma JSADR como admin (`adm-jsadr` / `Js121473164*`)
2. Ve a **Módulo de Seguridad** (sidebar)
3. Verifica que aparezcan 3 tarjetas: GitHub, Vercel, Neon Database
4. Para cada plataforma:
   - Click **Configurar**
   - Ingresa el token y webhook secret
   - Click **Guardar**
   - Click **Probar** → debe decir "Operativo"
   - Activa el toggle **Sincronización**
   - Activa el toggle **Tiempo real**

---

## 7. Fase 6 — Validaciones

### 7.1 Build

```bash
npm run build
# Debe terminar con "✓ Compiled successfully"
```

### 7.2 Deploy

- En Vercel → Deployments, el último deployment debe tener estado **Ready**
- Visita `https://jsadr.com.co` → debe cargar la página de login

### 7.3 Conexión a BD

```bash
# Desde tu máquina local, usando DATABASE_URL de Neon
npx prisma db execute --stdin <<< "SELECT NOW();"
```

### 7.4 Variables de entorno

```bash
# En Vercel CLI
vercel env ls
# Debe listar todas las variables configuradas
```

### 7.5 API

```bash
# Health check
curl https://jsadr.com.co/api/health

# Plataformas de sincronización
curl -H "Cookie: admin_session=XXX" https://jsadr.com.co/api/seguridad/plataformas-sync
```

### 7.6 Estado del repositorio GitHub

- Ve a https://github.com/jsadr-1029/jsadr/actions
- El workflow "CI/CD - JSADR Plataforma" debe estar ✅ green
- La rama `main` debe ser la default

### 7.7 Estado de Vercel

- Ve a https://vercel.com/jsadr/jsadr
- **Deployments:** último deploy en "Ready"
- **Analytics:** debe empezar a recibir datos
- **Domains:** `jsadr.com.co` debe estar verificado

### 7.8 Estado de Neon

- Ve a https://console.neon.tech/app/projects
- Abre el nuevo proyecto
- **Branches:** `main` activa
- **Tables:** debe tener todas las tablas del schema Prisma
- **Metrics:** debe mostrar consultas tras el primer deploy

---

## 8. Configuración de webhooks

Cada plataforma puede enviar eventos en tiempo real al endpoint:

```
https://jsadr.com.co/api/seguridad/plataformas-sync/webhook
```

### 8.1 GitHub webhook

1. Ve a https://github.com/jsadr-1029/jsadr/settings/hooks/new
2. **Payload URL:** `https://jsadr.com.co/api/seguridad/plataformas-sync/webhook?plataforma=GITHUB`
3. **Content type:** `application/json`
4. **Secret:** (el mismo que configuraste en el Módulo de Seguridad → GitHub → Configurar → Webhook Secret)
5. **Events:** Selecciona "Send me everything" o:
   - Push
   - Pull requests
   - Deployments
   - Workflow runs
6. Click **Add webhook**

### 8.2 Vercel webhook

1. Ve a https://vercel.com/jsadr/jsadr/settings/git
2. Busca "Integrations" o "Webhooks"
3. **URL:** `https://jsadr.com.co/api/seguridad/plataformas-sync/webhook?plataforma=VERCEL`
4. **Secret:** (el mismo configurado en el Módulo de Seguridad)
5. **Events:** deployment.created, deployment.ready, deployment.error, build.complete

### 8.3 Neon webhook

Neon no tiene webhooks nativos para eventos de DB, pero puedes:

1. Configurar un **cron job en Vercel** que consulte el estado de Neon cada 5 min:
   ```
   # En vercel.json:
   "crons": [
     {
       "path": "/api/seguridad/plataformas-sync/cron?plataforma=NEON",
       "schedule": "*/5 * * * *"
     }
   ]
   ```
2. O usar **Neon's Database Webhooks** (si tu plan lo permite) para notificar cambios en tablas específicas:
   - Ve a Neon → Project → Branches → main → Webhooks
   - **URL:** `https://jsadr.com.co/api/seguridad/plataformas-sync/webhook?plataforma=NEON&secret=TU_SECRETO`
   - **Tables:** selecciona las que te interesen
   - **Events:** INSERT, UPDATE, DELETE

---

## 9. Migración a PostgreSQL (Neon)

### 9.1 Cambiar el provider en schema.prisma

```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
}
```

### 9.2 Migrar datos existentes (opcional)

Si tienes datos en SQLite que quieres llevar a Neon:

```bash
# 1. Exportar desde SQLite
npx prisma db pull   # regenera schema desde SQLite
npx prisma studio    # exporta manualmente las tablas críticas

# 2. Apuntar a Neon
export DATABASE_URL="postgresql://...neon.tech/dbname"

# 3. Aplicar schema
npx prisma db push --accept-data-loss

# 4. Importar datos
# Usa scripts/import-backup.ts (después de actualizar nombres de modelos)
```

### 9.3 Compatibilidad SQLite → PostgreSQL

Ten en cuenta estas diferencias:

| Aspecto | SQLite | PostgreSQL |
|---|---|---|
| Boolean | 0/1 | true/false |
| Auto-increment | `INTEGER PRIMARY KEY` | `SERIAL` / `@default(autoincrement())` |
| Strings | TEXT | VARCHAR / TEXT |
| JSON | TEXT con parseo | JSONB (más eficiente) |
| Fechas | TEXT (ISO 8601) | TIMESTAMP |
| Case sensitivity | Insensible | Sensible |

Prisma abstrae la mayoría de estas diferencias, pero revisa queries manuales.

---

## 10. Resolución de problemas

### 10.1 El build falla en Vercel

**Síntoma:** `Error: prisma generate fails`

**Solución:**
- Verifica que `vercel.json` tiene `buildCommand: "prisma generate && next build"`
- Verifica que `DATABASE_URL` está en las variables de entorno de Vercel

### 10.2 Error de conexión a BD

**Síntoma:** `Can't reach database server at ep-xxx.neon.tech:5432`

**Solución:**
- Verifica que la URL incluye `?sslmode=require`
- Verifica que la contraseña no tiene caracteres especiales sin escapar
- Usa la URL con `-pooler` para serverless

### 10.3 El webhook no recibe eventos

**Síntoma:** Contador "Eventos recibidos" no incrementa

**Solución:**
- Verifica que el toggle **Tiempo real** esté activado
- Verifica que la URL del webhook en GitHub/Vercel/Neon apunte a `https://TU_DOMINIO/api/seguridad/plataformas-sync/webhook?plataforma=GITHUB`
- Verifica que el **Webhook Secret** coincide exactamente
- Revisa los logs en Vercel → Functions → logs del endpoint

### 10.4 El token de GitHub expira

Los PATs fine-grained de GitHub expiran por defecto en 1 año. Para evitar interrupciones:

1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Edita el token
3. Cambia expiration a "No expiration" (o crea recordatorio anual)
4. Actualiza el token en el Módulo de Seguridad → GitHub → Configurar

### 10.5 Rate limits

- **GitHub:** 5000 req/hora por token (suficiente para sync normal)
- **Vercel:** 100 req/min por token
- **Neon:** 60 req/min por API key

Si excedes el límite, verás errores HTTP 429. El sistema los maneja automáticamente y los reporta en `ultimoError`.

---

## Apéndice: Comandos útiles

```bash
# Generar cliente Prisma
npx prisma generate

# Aplicar schema a BD
npx prisma db push --accept-data-loss

# Crear migración
npx prisma migrate dev --name mi-cambio

# Resetear BD (¡cuidado!)
npx prisma migrate reset

# Abrir Prisma Studio (GUI para BD)
npx prisma studio

# Generar secretos aleatorios
openssl rand -hex 32

# Verificar build local
npm run build

# Iniciar servidor de desarrollo
npm run dev

# Deploy a Vercel manual
vercel --prod
```
