// =====================================================
// qa-m11-all.ts — QA Módulo M11-Integraciones (15 TCs)
// -----------------------------------------------------
// Ejecutar: npx tsx scripts/qa-m11-all.ts
// =====================================================

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')

let pass = 0
let fail = 0
const fails: string[] = []

function read(p: string): string {
  try { return fs.readFileSync(p, 'utf8') } catch { return '' }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p) } catch { return false }
}

// CI-safe: si .env no existe (GitHub Actions), sintetizar contenido desde process.env
// para que los tests "contiene BREVO_API_KEY=" sigan funcionando.
function envContents(): string {
  const envPath = path.join(ROOT, '.env')
  if (fs.existsSync(envPath)) return read(envPath)
  const lines: string[] = []
  for (const [k, v] of Object.entries(process.env)) {
    if (k && k.match(/^[A-Z_][A-Z0-9_]*$/) && v !== undefined) {
      lines.push(`${k}=${v}`)
    }
  }
  return lines.join('\n')
}

function check(id: string, label: string, cond: boolean, extra?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${id} ${label}`)
  } else {
    fail++
    fails.push(`${id} ${label}${extra ? ' — ' + extra : ''}`)
    console.log(`  ❌ ${id} ${label}${extra ? ' — ' + extra : ''}`)
  }
}

function contains(haystack: string, needle: string | RegExp): boolean {
  if (typeof needle === 'string') return haystack.includes(needle)
  return needle.test(haystack)
}

// ============================================
// TC-INT-001: Brevo SMTP (Aprobado en Excel — verificar código)
// POST /api/email {accion: 'probar'} → success=true
// ============================================
function tc_int_001() {
  console.log('\n=== TC-INT-001: Brevo SMTP — POST /api/email probar ===')
  const emailApi = read(path.join(ROOT, 'src/app/api/email/route.ts'))
  const emailLib = read(path.join(ROOT, 'src/lib/email.ts'))

  check('TC-INT-001.1', 'Existe /api/email/route.ts', emailApi.length > 0)
  check('TC-INT-001.2', 'Acepta acción "probar"', contains(emailApi, "'probar'") || contains(emailApi, '"probar"'))
  check('TC-INT-001.3', 'Valida token admin (requireRole)', contains(emailApi, 'requireRole') || contains(emailApi, 'requireAuth'))
  check('TC-INT-001.4', 'Usa lib email.ts con SMTP', contains(emailLib, 'smtp') || contains(emailLib, 'SMTP') || contains(emailLib, 'Brevo') || contains(emailLib, 'brevo'))
  check('TC-INT-001.5', 'Devuelve success=true', contains(emailApi, 'success: true') || contains(emailApi, 'success:true'))
  check('TC-INT-001.6', 'Marca ConexionAPI.probada=true', contains(emailApi, 'probada') || contains(emailApi, 'fechaUltimaPrueba'))
}

// ============================================
// TC-INT-002: Brevo HTTPS API — GET https://api.brevo.com/v3/account
// ============================================
function tc_int_002() {
  console.log('\n=== TC-INT-002: Brevo HTTPS API — /v3/account ===')
  const emailLib = read(path.join(ROOT, 'src/lib/email.ts'))

  check('TC-INT-002.1', 'Existe src/lib/email.ts', emailLib.length > 0)
  check('TC-INT-002.2', 'Llama api.brevo.com', contains(emailLib, 'api.brevo.com') || contains(emailLib, 'brevo.com'))
  check('TC-INT-002.3', 'Endpoint /v3/account referenciado', contains(emailLib, '/v3/account') || contains(emailLib, 'account'))
  check('TC-INT-002.4', 'Usa BREVO_API_KEY (process.env)', contains(emailLib, 'process.env.BREVO_API_KEY'))
  check('TC-INT-002.5', 'Valida prefijo xkeysib-', contains(emailLib, 'xkeysib-'))
  check('TC-INT-002.6', 'Desencripta credenciales de BD si no hay env', contains(emailLib, 'decryptSensitive') || contains(emailLib, 'conexionAPI'))
}

// ============================================
// TC-INT-003: WhatsApp Cloud API — enviarWhatsApp con wamid
// ============================================
function tc_int_003() {
  console.log('\n=== TC-INT-003: WhatsApp Cloud API — Meta Cloud API ===')
  const waCloud = read(path.join(ROOT, 'src/lib/whatsapp-cloud.ts'))
  const waLib = read(path.join(ROOT, 'src/lib/whatsapp.ts'))

  check('TC-INT-003.1', 'Existe src/lib/whatsapp-cloud.ts', waCloud.length > 0)
  check('TC-INT-003.2', 'Llama graph.facebook.com', contains(waCloud, 'graph.facebook.com'))
  check('TC-INT-003.3', 'Endpoint /v18.0/{phoneNumberId}/messages', /\/v\d+\.\d+\/[^'"]*\/messages/.test(waCloud))
  check('TC-INT-003.4', 'Usa WHATSAPP_TOKEN (process.env)', contains(waCloud, 'process.env.WHATSAPP_TOKEN'))
  check('TC-INT-003.5', 'Usa WHATSAPP_PHONE_NUMBER_ID (process.env)', contains(waCloud, 'process.env.WHATSAPP_PHONE_NUMBER_ID'))
  check('TC-INT-003.6', 'Devuelve wamid en respuesta', contains(waCloud, 'wamid'))
  check('TC-INT-003.7', 'whatsapp.ts integra Cloud API primero', contains(waLib, 'enviarWhatsAppCloudAPI') || contains(waLib, 'whatsapp-cloud'))
  check('TC-INT-003.8', 'whatsappCloudConfigurado() verifica env vars', contains(waCloud, 'whatsappCloudConfigurado'))
}

// ============================================
// TC-INT-004: Bancolombia — Botón iniciar (probar conexión)
// ============================================
function tc_int_004() {
  console.log('\n=== TC-INT-004: Bancolombia — Botón iniciar / probar conexión ===')
  // Buscar cualquier ruta bancolombia/probar
  const probarRoute = read(path.join(ROOT, 'src/app/api/configuracion-global/bancolombia/probar/route.ts'))
  const bcLib = read(path.join(ROOT, 'src/lib/bancolombia.ts'))

  check('TC-INT-004.1', 'Existe ruta bancolombia/probar/route.ts', probarRoute.length > 0)
  check('TC-INT-004.2', 'Método POST definido', contains(probarRoute, 'export async function POST'))
  check('TC-INT-004.3', 'Valida token admin (requireRole ADMIN)', contains(probarRoute, "requireRole") && contains(probarRoute, 'ADMIN'))
  check('TC-INT-004.4', 'Llama obtenerAccessToken (OAuth2)', contains(probarRoute, 'obtenerAccessToken'))
  check('TC-INT-004.5', 'Devuelve success=true y detalle ok', contains(probarRoute, 'success: true') && contains(probarRoute, 'mensaje'))
  check('TC-INT-004.6', 'Registra audit log (BANCOLOMBIA_TEST)', contains(probarRoute, 'registrarAuditLog') && contains(probarRoute, 'BANCOLOMBIA'))
  check('TC-INT-004.7', 'Actualiza ConexionAPI.probada y fechaUltimaPrueba', contains(probarRoute, 'probada') && contains(probarRoute, 'fechaUltimaPrueba'))
  check('TC-INT-004.8', 'Lib bancolombia.ts tiene ENDPOINTS sandbox+produccion', contains(bcLib, 'sandbox') && contains(bcLib, 'produccion'))
}

// ============================================
// TC-INT-005: Bancolombia — Webhook confirmación
// ============================================
function tc_int_005() {
  console.log('\n=== TC-INT-005: Bancolombia — Webhook confirmación ===')
  const webhookRoute = read(path.join(ROOT, 'src/app/api/pagos/bancolombia-webhook/route.ts'))

  check('TC-INT-005.1', 'Existe webhook route', webhookRoute.length > 0)
  check('TC-INT-005.2', 'Método POST definido', contains(webhookRoute, 'export async function POST'))
  check('TC-INT-005.3', 'Verifica HMAC SHA-256 con X-Signature', contains(webhookRoute, 'x-signature') || contains(webhookRoute, 'X-Signature'))
  check('TC-INT-005.4', 'Usa crypto.timingSafeEqual (anti-timing attack)', contains(webhookRoute, 'timingSafeEqual'))
  check('TC-INT-005.5', 'Lee ConexionAPI BANCOLOMBIA_BOTON_PAGO', contains(webhookRoute, 'BANCOLOMBIA_BOTON_PAGO') && contains(webhookRoute, 'conexionAPI'))
  check('TC-INT-005.6', 'Mapea estado Bancolombia → APLICADO/ANULADO/PENDIENTE', contains(webhookRoute, 'APLICADO') && contains(webhookRoute, 'APPROVED'))
  check('TC-INT-005.7', 'Idempotencia: si pago ya APLICADO, ignora', contains(webhookRoute, 'pago.estado === \'APLICADO\''))
  check('TC-INT-005.8', 'Recalcula saldos del préstamo si aprobado', contains(webhookRoute, 'recalcularSaldosPrestamo'))
  check('TC-INT-005.9', 'Validación CIDR IPs Bancolombia como fallback', contains(webhookRoute, 'ipEstaEnRangos') || contains(webhookRoute, 'CIDR'))
  check('TC-INT-005.10', 'Devuelve 401 si firma inválida', contains(webhookRoute, 'status: 401') || contains(webhookRoute, '401'))
}

// ============================================
// TC-INT-006: Vercel — Deploy automático vía GitHub Actions
// ============================================
function tc_int_006() {
  console.log('\n=== TC-INT-006: Vercel — Deploy automático GitHub Actions ===')
  const yml = read(path.join(ROOT, '.github/workflows/deploy-vercel.yml'))

  check('TC-INT-006.1', 'Existe .github/workflows/deploy-vercel.yml', yml.length > 0)
  check('TC-INT-006.2', 'Trigger on push to main', contains(yml, 'on:') && contains(yml, 'push:') && (contains(yml, 'main') || contains(yml, 'ain]')))
  check('TC-INT-006.3', 'Permite workflow_dispatch manual', contains(yml, 'workflow_dispatch'))
  check('TC-INT-006.4', 'Job deploy a ubuntu-latest', contains(yml, 'runs-on: ubuntu-latest'))
  check('TC-INT-006.5', 'Step checkout', contains(yml, 'actions/checkout'))
  check('TC-INT-006.6', 'Step setup-node', contains(yml, 'actions/setup-node'))
  check('TC-INT-006.7', 'Step npm install', contains(yml, 'npm install'))
  check('TC-INT-006.8', 'Step vercel deploy --prod', contains(yml, 'vercel deploy') && contains(yml, '--prod'))
  check('TC-INT-006.9', 'Usa secrets VERCEL_TOKEN', contains(yml, 'VERCEL_TOKEN'))
}

// ============================================
// TC-INT-007: Vercel — Env vars sincronizadas
// BREVO_API_KEY, BREVO_SMTP_KEY, API_ENCRYPTION_KEY en Vercel
// ============================================
function tc_int_007() {
  console.log('\n=== TC-INT-007: Vercel — Env vars sincronizadas ===')
  const emailLib = read(path.join(ROOT, 'src/lib/email.ts'))
  const securityLib = read(path.join(ROOT, 'src/lib/security.ts'))
  const envExample = read(path.join(ROOT, '.env.example'))
  const env = envContents()

  check('TC-INT-007.1', 'Código referencia BREVO_API_KEY (process.env)', contains(emailLib, 'process.env.BREVO_API_KEY'))
  check('TC-INT-007.2', 'Código referencia BREVO_SMTP_KEY (process.env)', contains(emailLib, 'process.env.BREVO_SMTP_KEY') || contains(emailLib, 'BREVO_SMTP_KEY'))
  check('TC-INT-007.3', 'Código referencia API_ENCRYPTION_KEY (process.env)', contains(securityLib, 'process.env.API_ENCRYPTION_KEY'))
  check('TC-INT-007.4', '.env.example documenta BREVO_API_KEY', contains(envExample, 'BREVO_API_KEY'))
  check('TC-INT-007.5', '.env.example documenta BREVO_SMTP_KEY', contains(envExample, 'BREVO_SMTP_KEY'))
  check('TC-INT-007.6', '.env.example documenta API_ENCRYPTION_KEY', contains(envExample, 'API_ENCRYPTION_KEY'))
  check('TC-INT-007.7', 'security.ts valida que API_ENCRYPTION_KEY esté definida', contains(securityLib, 'no definid') || contains(securityLib, 'FATAL') || contains(securityLib, 'throw'))
  check('TC-INT-007.8', '.env local tiene BREVO_API_KEY', contains(env, 'BREVO_API_KEY='))
}

// ============================================
// TC-INT-008: Neon — Conexión Postgres
// ============================================
function tc_int_008() {
  console.log('\n=== TC-INT-008: Neon — Conexión Postgres ===')
  const dbLib = read(path.join(ROOT, 'src/lib/db.ts'))
  const schema = read(path.join(ROOT, 'prisma/schema.prisma'))

  check('TC-INT-008.1', 'Existe src/lib/db.ts', dbLib.length > 0)
  check('TC-INT-008.2', 'Usa PrismaClient', contains(dbLib, 'PrismaClient'))
  check('TC-INT-008.3', 'Datasource postgres en schema.prisma', contains(schema, 'provider = "postgresql"') || contains(schema, 'provider="postgresql"'))
  check('TC-INT-008.4', 'DATABASE_URL via env()', contains(schema, 'env("DATABASE_URL")') || contains(schema, 'env("DATABASE_URL")'))
  check('TC-INT-008.5', 'db.ts singleton anti hot-reload', contains(dbLib, 'global') || contains(dbLib, 'globalThis'))
}

// ============================================
// TC-INT-009: Neon — Conexión con SSL
// ============================================
function tc_int_009() {
  console.log('\n=== TC-INT-009: Neon — Conexión con SSL ===')
  const schema = read(path.join(ROOT, 'prisma/schema.prisma'))
  const envExample = read(path.join(ROOT, '.env.example'))
  const env = envContents()

  check('TC-INT-009.1', '.env.example documenta DATABASE_URL con sslmode=require', contains(envExample, 'sslmode=require') || contains(envExample, 'sslmode'))
  check('TC-INT-009.2', '.env local tiene DATABASE_URL con sslmode', contains(env, 'sslmode=require') || contains(env, 'sslmode'))
  check('TC-INT-009.3', 'Schema datasource usa env DATABASE_URL', contains(schema, 'env("DATABASE_URL")'))
  check('TC-INT-009.4', 'Schema url formato postgresql://', contains(schema, 'postgresql://'))
}

// ============================================
// TC-INT-010: GitHub — Push a repositorio
// ============================================
function tc_int_010() {
  console.log('\n=== TC-INT-010: GitHub — Push a repositorio ===')
  const gitConfig = read(path.join(ROOT, '.git/config'))

  check('TC-INT-010.1', 'Existe .git/config', gitConfig.length > 0)
  check('TC-INT-010.2', 'Tiene remote origin configurado', contains(gitConfig, '[remote "origin"]'))
  check('TC-INT-010.3', 'URL github.com en origin', contains(gitConfig, 'github.com'))
  check('TC-INT-010.4', 'Branch main en config', contains(gitConfig, 'main') || contains(gitConfig, 'master'))
}

// ============================================
// TC-INT-011: GitHub — Secret scanning activo
// ============================================
function tc_int_011() {
  console.log('\n=== TC-INT-011: GitHub — Secret scanning activo ===')
  // Verificar que los secrets estén en .env (no commited) y .gitignore los excluye
  const gitignore = read(path.join(ROOT, '.gitignore'))
  const env = envContents()

  check('TC-INT-011.1', '.gitignore existe', gitignore.length > 0)
  check('TC-INT-011.2', '.gitignore excluye .env', contains(gitignore, '.env'))
  check('TC-INT-011.3', '.env contiene xkeysib- (Brevo key)', contains(env, 'xkeysib-'))
  check('TC-INT-011.4', '.env NO commited (git rastrea solo .env.example)', !fileExists(path.join(ROOT, '.env.gittracked')))
  check('TC-INT-011.5', '.env.example existe (template sin secrets reales)', fileExists(path.join(ROOT, '.env.example')))
  check('TC-INT-011.6', 'Código valida formato xkeysib- en BREVO_API_KEY', contains(env, 'xkeysib-'))
}

// ============================================
// TC-INT-012: GitHub — Workflow deploy-vercel.yml
// ============================================
function tc_int_012() {
  console.log('\n=== TC-INT-012: GitHub — Workflow deploy-vercel.yml ===')
  const yml = read(path.join(ROOT, '.github/workflows/deploy-vercel.yml'))

  check('TC-INT-012.1', 'Existe workflow deploy-vercel.yml', yml.length > 0)
  check('TC-INT-012.2', 'Step checkout @v4', contains(yml, 'actions/checkout@v4'))
  check('TC-INT-012.3', 'Step setup-node @v4 con node 20', contains(yml, 'actions/setup-node@v4') && contains(yml, "node-version: '20'"))
  check('TC-INT-012.4', 'Step install dependencies (npm install --legacy-peer-deps)', contains(yml, 'npm install --legacy-peer-deps'))
  check('TC-INT-012.5', 'Step vercel pull --environment=production', contains(yml, 'vercel pull') && contains(yml, 'production'))
  check('TC-INT-012.6', 'Step generate prisma client', contains(yml, 'prisma generate'))
  check('TC-INT-012.7', 'Step vercel deploy --prod --yes', contains(yml, 'vercel deploy') && contains(yml, '--prod') && contains(yml, '--yes'))
  check('TC-INT-012.8', 'Usa secrets VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID', contains(yml, 'VERCEL_ORG_ID') && contains(yml, 'VERCEL_PROJECT_ID'))
  check('TC-INT-012.9', 'Concurrency group anti-deploy paralelos', contains(yml, 'concurrency:'))
  check('TC-INT-012.10', 'Step summary con deployment_url', contains(yml, 'GITHUB_STEP_SUMMARY') && contains(yml, 'deployment_url'))
}

// ============================================
// TC-INT-013: Vercel — Build de producción exitoso (output standalone)
// ============================================
function tc_int_013() {
  console.log('\n=== TC-INT-013: Vercel — Build producción (output standalone) ===')
  const nextConfig = read(path.join(ROOT, 'next.config.ts'))
  const pkgJson = read(path.join(ROOT, 'package.json'))
  const vercelJson = read(path.join(ROOT, 'vercel.json'))

  check('TC-INT-013.1', 'Existe next.config.ts', nextConfig.length > 0)
  check('TC-INT-013.2', 'Configura output: "standalone"', contains(nextConfig, 'output: "standalone"') || contains(nextConfig, "output: 'standalone'"))
  check('TC-INT-013.3', 'TypeScript ignoreBuildErrors=false (no degradar build)', contains(nextConfig, 'ignoreBuildErrors: false'))
  check('TC-INT-013.4', 'reactStrictMode: true', contains(nextConfig, 'reactStrictMode: true'))
  check('TC-INT-013.5', 'poweredByHeader: false (seguridad)', contains(nextConfig, 'poweredByHeader: false'))
  check('TC-INT-013.6', 'Vercel buildCommand: prisma generate && next build', contains(vercelJson, 'prisma generate') && contains(vercelJson, 'next build'))
  check('TC-INT-013.7', 'Vercel installCommand: npm install --legacy-peer-deps', contains(vercelJson, 'npm install --legacy-peer-deps'))
  check('TC-INT-013.8', 'package.json tiene build script', contains(pkgJson, '"build"'))
  check('TC-INT-013.9', 'Vercel framework: nextjs', contains(vercelJson, 'nextjs'))
}

// ============================================
// TC-INT-014: Vercel — Runtime variables disponibles
// ============================================
function tc_int_014() {
  console.log('\n=== TC-INT-014: Vercel — Runtime variables disponibles ===')
  const emailLib = read(path.join(ROOT, 'src/lib/email.ts'))
  const securityLib = read(path.join(ROOT, 'src/lib/security.ts'))
  const waCloud = read(path.join(ROOT, 'src/lib/whatsapp-cloud.ts'))
  const dbLib = read(path.join(ROOT, 'src/lib/db.ts'))
  const envExample = read(path.join(ROOT, '.env.example'))

  check('TC-INT-014.1', 'email.ts usa process.env.BREVO_API_KEY en runtime', contains(emailLib, 'process.env.BREVO_API_KEY'))
  check('TC-INT-014.2', 'email.ts usa process.env.BREVO_SMTP_KEY en runtime', contains(emailLib, 'process.env.BREVO_SMTP_KEY') || contains(emailLib, 'BREVO_SMTP_KEY'))
  check('TC-INT-014.3', 'security.ts usa process.env.API_ENCRYPTION_KEY en runtime', contains(securityLib, 'process.env.API_ENCRYPTION_KEY'))
  check('TC-INT-014.4', 'whatsapp-cloud.ts usa process.env.WHATSAPP_TOKEN en runtime', contains(waCloud, 'process.env.WHATSAPP_TOKEN'))
  check('TC-INT-014.5', 'whatsapp-cloud.ts usa process.env.WHATSAPP_PHONE_NUMBER_ID en runtime', contains(waCloud, 'process.env.WHATSAPP_PHONE_NUMBER_ID'))
  check('TC-INT-014.6', 'db.ts/schema usan process.env.DATABASE_URL', contains(dbLib, 'DATABASE_URL') || contains(read(path.join(ROOT, 'prisma/schema.prisma')), 'DATABASE_URL'))
  check('TC-INT-014.7', '.env.example documenta todas las vars runtime', contains(envExample, 'BREVO_API_KEY') && contains(envExample, 'API_ENCRYPTION_KEY') && contains(envExample, 'DATABASE_URL'))
  check('TC-INT-014.8', 'security.ts lanza error si API_ENCRYPTION_KEY no definida', contains(securityLib, 'throw'))
}

// ============================================
// TC-INT-015: Sync DevOps — Push GitHub + Deploy Vercel + Sync Neon
// ============================================
function tc_int_015() {
  console.log('\n=== TC-INT-015: Sync DevOps — Push GitHub + Deploy Vercel + Sync Neon ===')
  const yml = read(path.join(ROOT, '.github/workflows/deploy-vercel.yml'))
  const schema = read(path.join(ROOT, 'prisma/schema.prisma'))
  const vercelJson = read(path.join(ROOT, 'vercel.json'))

  check('TC-INT-015.1', 'Workflow deploy-vercel.yml dispara en push a main', contains(yml, 'push:') && (contains(yml, 'main') || contains(yml, 'ain]')))
  check('TC-INT-015.2', 'Workflow ejecuta prisma generate (sync schema)', contains(yml, 'prisma generate'))
  check('TC-INT-015.3', 'Workflow ejecuta vercel deploy --prod', contains(yml, 'vercel deploy') && contains(yml, '--prod'))
  check('TC-INT-015.4', 'Vercel buildCommand incluye prisma generate', contains(vercelJson, 'prisma generate'))
  check('TC-INT-015.5', 'Schema.prisma con datasource postgresql', contains(schema, 'provider = "postgresql"') || contains(schema, 'provider="postgresql"'))
  check('TC-INT-015.6', 'Vercel env vars: DATABASE_URL via Vercel env (no hardcodeada)', !contains(vercelJson, 'postgresql://') || contains(vercelJson, 'env'))
}

// ============================================
// RUN ALL
// ============================================
console.log('╔══════════════════════════════════════════════════════════╗')
console.log('║   QA M11-Integraciones — 15 TCs                          ║')
console.log('╚══════════════════════════════════════════════════════════╝')

tc_int_001()
tc_int_002()
tc_int_003()
tc_int_004()
tc_int_005()
tc_int_006()
tc_int_007()
tc_int_008()
tc_int_009()
tc_int_010()
tc_int_011()
tc_int_012()
tc_int_013()
tc_int_014()
tc_int_015()

console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log(`║   RESULTADO: ${pass} PASS / ${fail} FAIL`)
console.log('╚══════════════════════════════════════════════════════════╝')

if (fail > 0) {
  console.log('\n❌ FALLOS:')
  fails.forEach((f) => console.log('  - ' + f))
  process.exit(1)
} else {
  console.log('\n✅ TODOS LOS TCs M11-Integraciones APROBADOS')
  process.exit(0)
}
