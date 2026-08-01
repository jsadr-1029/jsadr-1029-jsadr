# JSADR — Plataforma de Gestión de Préstamos

Sistema integral de gestión de préstamos, clientes, pagos, contabilidad y portal del cliente, con módulos de seguridad avanzados y sincronización con GitHub, Vercel y Neon Database.

## Stack tecnológico

- **Framework:** Next.js 16.1.3 (App Router)
- **Base de datos:** Prisma ORM + SQLite (dev) / PostgreSQL en Neon (prod)
- **Auth:** JWT (access + refresh) con cifrado AES-256-GCM
- **UI:** Tailwind CSS + shadcn/ui + Radix UI
- **Lenguaje:** TypeScript estricto
- **Deployment:** Vercel + GitHub Actions CI/CD

## Quick start

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus secretos (genera con: openssl rand -hex 32)

# 3. Aplicar schema a la BD
npx prisma generate
npx prisma db push --accept-data-loss

# 4. Iniciar servidor
npm run dev
# Abre http://localhost:3000
```

## Acceso

- **Admin:** username `adm-jsadr` / password `Js121473164*`
- **Portal cliente:** usa cédula + token recibido por WhatsApp/SMS

## Documentación

- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — Reconstrucción completa de infraestructura GitHub + Vercel + Neon
- [`INFORME_FINAL.md`](./INFORME_FINAL.md) — Informe ejecutivo de la reconstrucción
- [`.env.example`](./.env.example) — Plantilla de variables de entorno

## Estructura del proyecto

```
src/
├── app/
│   ├── api/                    # API routes (21+ endpoints)
│   │   ├── seguridad/
│   │   │   ├── modulos/        # Módulos protegidos
│   │   │   ├── plataformas-sync/   # ⭐ Sincronización GitHub/Vercel/Neon
│   │   │   │   ├── route.ts
│   │   │   │   └── webhook/    # Recibe webhooks de las 3 plataformas
│   │   │   ├── audit/
│   │   │   ├── credenciales/
│   │   │   └── route.ts
│   │   ├── auth/
│   │   ├── clientes/
│   │   ├── prestamos/
│   │   ├── pagos/
│   │   ├── cuentas/
│   │   └── ...
│   ├── login/                  # Pantalla de login multi-rol
│   ├── juridico/               # Portal del abogado
│   ├── firma/                  # Firma de documentos
│   ├── page.tsx                # Dashboard principal
│   └── layout.tsx
├── components/
│   ├── views/                  # Vistas principales del dashboard
│   │   ├── SeguridadView.tsx   # ⭐ Módulo de seguridad con sync de plataformas
│   │   ├── DashboardView.tsx
│   │   ├── ClientesView.tsx
│   │   ├── PrestamosView.tsx
│   │   └── ...
│   ├── ui/                     # Componentes shadcn/ui
│   └── shared/                 # Componentes compartidos
├── lib/                        # Utilidades, bots, lógica de negocio
├── hooks/                      # React hooks personalizados
└── middleware.ts               # Middleware de autenticación

prisma/
└── schema.prisma               # Modelo de datos (40+ modelos)

.github/
└── workflows/
    └── ci-cd.yml               # Pipeline CI/CD para GitHub + Vercel

vercel.json                     # Configuración de deployment en Vercel
DEPLOYMENT_GUIDE.md             # Guía de reconstrucción de infraestructura
INFORME_FINAL.md                # Informe ejecutivo
```

## Características principales

### Seguridad
- **Módulos protegidos:** módulos del sistema que requieren clave maestra para acceder
- **Plataformas de sincronización:** activa/desactiva en tiempo real la sincronización con GitHub, Vercel y Neon Database
- **Cifrado AES-256-GCM:** tokens de API almacenados cifrados en BD
- **Webhooks firmados:** validación HMAC-SHA256 para webhooks entrantes

### Roles y permisos
- **ADMIN:** acceso completo al dashboard y módulos
- **GESTOR:** acceso a clientes, préstamos, pagos
- **CONSULTOR:** solo lectura
- **CLIENTE:** acceso al portal del cliente (por cédula + token)
- **ABOGADO:** acceso al portal jurídico

## Comandos útiles

```bash
# Desarrollo
npm run dev                     # Inicia servidor de desarrollo
npm run build                   # Build de producción
npm run lint                    # ESLint

# Base de datos
npm run db:push                 # Aplica schema a la BD
npm run db:generate             # Genera cliente Prisma
npm run db:migrate              # Crea migración
npm run db:reset                # Resetea BD (¡borra datos!)
```

## Licencia

Propietaria — JSADR © 2025
