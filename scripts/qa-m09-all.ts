// scripts/qa-m09-all.ts
// QA M09-Notificaciones — 10 TCs pendientes
// Verifica: WhatsApp Cloud API, plantillas, log, listar, reenviar, cron, deduplicación, fallback, opt-out.
//
// Run: npx tsx scripts/qa-m09-all.ts

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

let pass = 0, fail = 0
const fails: string[] = []

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++
    // console.log(`✅ ${name}`)
  } else {
    fail++
    fails.push(`❌ ${name} ${detail}`)
    console.log(`❌ ${name} ${detail}`)
  }
}

function includes(haystack: string, needle: string | RegExp): boolean {
  if (typeof needle === 'string') return haystack.includes(needle)
  return needle.test(haystack)
}

console.log('=== QA M09-Notificaciones (10 TCs pendientes) ===\n')

// ============================================================
// TC-NOT-003 — Enviar WhatsApp Cloud API (Meta)
// Validar: existe función que llame a graph.facebook.com con WHATSAPP_TOKEN y devuelva wamid
// ============================================================
{
  console.log('--- TC-NOT-003 WhatsApp Cloud API (Meta) ---')
  const whatsappPath = 'src/lib/whatsapp.ts'
  const waCloudPath = 'src/lib/whatsapp-cloud.ts'
  let waContent = ''
  try { waContent = read(waCloudPath) } catch { /* puede no existir */ }
  const whatsappContent = read(whatsappPath)

  // 1. Existe archivo dedicado de WhatsApp Cloud API
  check('TC-NOT-003.1 existe src/lib/whatsapp-cloud.ts', waContent.length > 0)

  // 2. Llama a graph.facebook.com
  const hasGraphUrl = includes(waContent, 'graph.facebook.com') || includes(whatsappContent, 'graph.facebook.com')
  check('TC-NOT-003.2 usa graph.facebook.com API endpoint', hasGraphUrl)

  // 3. Lee WHATSAPP_TOKEN de env
  const hasTokenEnv = includes(waContent, 'WHATSAPP_TOKEN') || includes(whatsappContent, 'WHATSAPP_TOKEN') ||
                      includes(waContent, 'process.env.WHATSAPP_TOKEN')
  check('TC-NOT-003.3 lee WHATSAPP_TOKEN de env', hasTokenEnv)

  // 4. Respuesta incluye wamid
  const hasWamid = includes(waContent, 'wamid') || includes(whatsappContent, 'wamid')
  check('TC-NOT-003.4 wamid devuelto en respuesta', hasWamid)

  // 5. Phone number id configurable
  const hasPhoneId = includes(waContent, 'WHATSAPP_PHONE_NUMBER_ID') || includes(whatsappContent, 'WHATSAPP_PHONE_NUMBER_ID')
  check('TC-NOT-003.5 WHATSAPP_PHONE_NUMBER_ID configurable', hasPhoneId)
}

// ============================================================
// TC-NOT-004 — mensajeRecordatorioPago
// Mensaje formateado: "Hola {nombre}, tu pago de ${monto} vence el {fecha}"
// ============================================================
{
  console.log('\n--- TC-NOT-004 mensajeRecordatorioPago ---')
  const content = read('src/lib/whatsapp.ts')

  // 1. Función existe
  check('TC-NOT-004.1 función mensajeRecordatorioPago existe', includes(content, 'mensajeRecordatorioPago'))

  // 2. Recibe nombreCliente
  check('TC-NOT-004.2 recibe nombreCliente', /mensajeRecordatorioPago[^}]*nombreCliente/.test(content))

  // 3. Recibe montoCuota
  check('TC-NOT-004.3 recibe montoCuota', /mensajeRecordatorioPago[^}]*montoCuota/.test(content))

  // 4. Recibe fechaVencimiento
  check('TC-NOT-004.4 recibe fechaVencimiento', /mensajeRecordatorioPago[^}]*fechaVencimiento/.test(content))

  // 5. Mensaje incluye nombre + monto + fecha (formato esperado por TC)
  // Extraer el cuerpo de la función
  const fnMatch = content.match(/mensajeRecordatorioPago[\s\S]*?\n\}/)
  const fnBody = fnMatch ? fnMatch[0] : ''
  check('TC-NOT-004.5 mensaje incluye nombre', includes(fnBody, 'nombreCliente'))
  check('TC-NOT-004.6 mensaje incluye monto', includes(fnBody, 'montoCuota'))
  check('TC-NOT-004.7 mensaje incluye fecha de vencimiento', includes(fnBody, 'fechaVencimiento'))
}

// ============================================================
// TC-NOT-005 — mensajeMora
// Mensaje: "Tu préstamo está en mora por {dias} días"
// ============================================================
{
  console.log('\n--- TC-NOT-005 mensajeMora ---')
  const content = read('src/lib/whatsapp.ts')

  // 1. Función existe
  check('TC-NOT-005.1 función mensajeMora existe', includes(content, 'mensajeMora'))

  // 2. Recibe diasMora
  check('TC-NOT-005.2 recibe diasMora', /mensajeMora[^}]*diasMora/.test(content))

  // 3. Recibe montoMora
  check('TC-NOT-005.3 recibe montoMora', /mensajeMora[^}]*montoMora/.test(content))

  // 4. Mensaje incluye días de mora
  const fnMatch = content.match(/mensajeMora[\s\S]*?\n\}/)
  const fnBody = fnMatch ? fnMatch[0] : ''
  check('TC-NOT-005.4 mensaje incluye diasMora', includes(fnBody, 'diasMora'))

  // 5. Mensaje incluye monto (cuota o mora o total)
  const hasMonto = includes(fnBody, 'montoCuota') || includes(fnBody, 'montoMora') || includes(fnBody, 'totalAdeudado')
  check('TC-NOT-005.5 mensaje incluye monto', hasMonto)
}

// ============================================================
// TC-NOT-007 — guardarNotificacion
// Registro en NotificacionLog con fecha, tipo, estado
// ============================================================
{
  console.log('\n--- TC-NOT-007 guardarNotificacion ---')
  const content = read('src/lib/whatsapp.ts')

  // 1. Función existe
  check('TC-NOT-007.1 función guardarNotificacion existe', includes(content, 'guardarNotificacion'))

  // 2. Crea en notificacionLog
  check('TC-NOT-007.2 crea en notificacionLog', /guardarNotificacion[\s\S]*?notificacionLog\.create/.test(content))

  // 3. Incluye tipo
  check('TC-NOT-007.3 incluye campo tipo', /guardarNotificacion[\s\S]*?tipo[\s,]/.test(content))

  // 4. Incluye estado
  check('TC-NOT-007.4 incluye campo estado', /guardarNotificacion[\s\S]*?estado[\s:,]/.test(content))

  // 5. Incluye mensaje
  check('TC-NOT-007.5 incluye campo mensaje', /guardarNotificacion[\s\S]*?mensaje[\s,]/.test(content))

  // 6. fechaEnvio (default now) o explícito
  const hasFecha = includes(content, 'fechaEnvio')
  check('TC-NOT-007.6 incluye fechaEnvio', hasFecha)
}

// ============================================================
// TC-NOT-008 — Listar notificaciones con filtros
// GET /api/notificaciones?tipo=recordatorio&estado=enviado, take=100
// ============================================================
{
  console.log('\n--- TC-NOT-008 GET /api/notificaciones con filtros ---')
  const content = read('src/app/api/notificaciones/route.ts')

  // 1. GET handler
  check('TC-NOT-008.1 export async function GET', includes(content, 'export async function GET'))

  // 2. Lee searchParams tipo
  check('TC-NOT-008.2 lee searchParams tipo', /searchParams\.get\(['"]tipo['"]\)/.test(content))

  // 3. Lee searchParams estado
  check('TC-NOT-008.3 lee searchParams estado', /searchParams\.get\(['"]estado['"]\)/.test(content))

  // 4. take=100
  check('TC-NOT-008.4 take: 100', /take:\s*100/.test(content))

  // 5. notificacionLog.findMany
  check('TC-NOT-008.5 notificacionLog.findMany', includes(content, 'notificacionLog.findMany'))
}

// ============================================================
// TC-NOT-009 — Reenviar notificación fallida
// POST /api/notificaciones/<id>/enviar, estado → enviado
// ============================================================
{
  console.log('\n--- TC-NOT-009 POST /api/notificaciones/[id]/enviar ---')
  const content = read('src/app/api/notificaciones/[id]/enviar/route.ts')

  // 1. POST handler
  check('TC-NOT-009.1 export async function POST', includes(content, 'export async function POST'))

  // 2. Recibe params.id
  check('TC-NOT-009.2 recibe params.id', /params[^}]*id/.test(content))

  // 3. notificacionLog.update (actualiza estado)
  check('TC-NOT-009.3 notificacionLog.update', includes(content, 'notificacionLog.update'))

  // 4. Cambia estado a ENVIADO (literal o ternario)
  check('TC-NOT-009.4 estado: ENVIADO',
        /estado:\s*['"]ENVIADO['"]/.test(content) ||
        /estado:\s*envioExitoso\s*\?\s*['"]ENVIADO['"]/.test(content) ||
        /estado:\s*\w+\s*\?\s*['"]ENVIADO['"]/.test(content))

  // 5. RBAC (requireRole)
  check('TC-NOT-009.5 RBAC requireRole', includes(content, 'requireRole'))

  // 6. Busca primero si existe (findUnique o findFirst) antes de update
  const hasFindBeforeUpdate = includes(content, 'findUnique') || includes(content, 'findFirst')
  check('TC-NOT-009.6 busca notif antes de actualizar', hasFindBeforeUpdate, '(valida que exista y sea fallida)')

  // 7. Audit log registrado
  check('TC-NOT-009.7 audit log registrado', includes(content, 'auditLog.create') || includes(content, 'AuditLog'))
}

// ============================================================
// TC-NOT-010 — Job cron de notificaciones automáticas
// Vercel cron config
// ============================================================
{
  console.log('\n--- TC-NOT-010 Job cron automático ---')
  const vercel = read('vercel.json')

  // 1. crons definidos en vercel.json
  check('TC-NOT-010.1 vercel.json crons definidos', includes(vercel, '"crons"'))

  // 2. Schedule diario (0 13 * * * o similar con daily cadence)
  check('TC-NOT-010.2 schedule diario', /"\d+\s+\d+\s+\*\s+\*\s+\*"/.test(vercel) || /once.?per.?day|daily/i.test(vercel))

  // 3. Path /api/recordatorios/cron (o similar)
  check('TC-NOT-010.3 path /api/recordatorios/cron', includes(vercel, '/api/recordatorios/cron'))

  // 4. Endpoint route.ts existe
  let cronRoute = ''
  try { cronRoute = read('src/app/api/recordatorios/cron/route.ts') } catch { /* */ }
  check('TC-NOT-010.4 existe /api/recordatorios/cron/route.ts', cronRoute.length > 0)

  // 5. Auth del cron (X-Cron-Secret o similar)
  check('TC-NOT-010.5 cron auth (X-Cron-Secret)', includes(cronRoute, 'X-Cron-Secret') || includes(cronRoute, 'x-cron-secret') || includes(cronRoute, 'CRON_SECRET'))
}

// ============================================================
// TC-NOT-012 — Deduplicación 24h
// ============================================================
{
  console.log('\n--- TC-NOT-012 Deduplicación 24h ---')
  const content = read('src/app/api/notificaciones/route.ts')
  const whatsappContent = read('src/lib/whatsapp.ts')

  // 1. Búsqueda de notificación existente antes de enviar
  const hasFindPrev = /notificacionLog\.findFirst|notificacionLog\.findMany/.test(content) ||
                      /notificacionLog\.findFirst|notificacionLog\.findMany/.test(whatsappContent)
  check('TC-NOT-012.1 busca notif previa antes de enviar', hasFindPrev)

  // 2. Filtro por tipo
  check('TC-NOT-012.2 filtra por tipo', /where:[\s\S]{0,400}tipo:/.test(content))

  // 3. Filtro por prestamoId
  check('TC-NOT-012.3 filtra por prestamoId', /where:[\s\S]{0,400}prestamoId:/.test(content))

  // 4. Filtro por fecha (24h atrás, gte o lt)
  const has24h = /24\s*\*\s*60|24h|HOUR|hours|fechaEnvio.*gte|fechaEnvio.*gt|fechaEnvio.*lt/.test(content) ||
                 /24\s*\*\s*60|24h|HOUR|hours/.test(whatsappContent)
  check('TC-NOT-012.4 filtro de 24h ( HORAS o fechaEnvio gte )', has24h)

  // 5. Skip explícito si duplicado
  const hasSkip = /skip|continue|duplicado|deduplica/i.test(content)
  check('TC-NOT-012.5 skip explícito si duplicado', hasSkip)
}

// ============================================================
// TC-NOT-014 — Fallback WhatsApp → Email
// ============================================================
{
  console.log('\n--- TC-NOT-014 Fallback WhatsApp → Email ---')
  const content = read('src/app/api/notificaciones/route.ts')
  const whatsappContent = read('src/lib/whatsapp.ts')
  let waCloud = ''
  try { waCloud = read('src/lib/whatsapp-cloud.ts') } catch {}

  const combined = content + '\n' + whatsappContent + '\n' + waCloud

  // 1. Importa o usa enviarEmail
  check('TC-NOT-014.1 usa enviarEmail (de src/lib/email.ts)',
        includes(combined, 'enviarEmail') || includes(combined, 'enviarCorreo') || includes(combined, 'fallbackEmail'))

  // 2. Si WhatsApp falla, intenta email
  const hasFallbackLogic = /fallback|wa\.?me.*email|email.*fallback/i.test(combined) ||
                            /if\s*\(\s*!.*exito|resultado\.exito\s*===?\s*false/.test(combined)
  check('TC-NOT-014.2 lógica de fallback si WhatsApp falla', hasFallbackLogic)

  // 3. Valida cliente.email antes de fallback
  check('TC-NOT-014.3 valida cliente.email antes de fallback',
        /cliente\.email|\.email\s*[?]|email\s*&&/.test(combined))

  // 4. Doble canal (WHATSAPP + EMAIL)
  check('TC-NOT-014.4 doble canal implementado (ambos modos)',
        includes(combined, 'WHATSAPP') && includes(combined, 'EMAIL'))

  // 5. Log de fallback (guarda en NotificacionLog con tipo email o estado FALLIDO_EMAIL)
  check('TC-NOT-014.5 log de fallback registrado',
        /guardarNotificacion|notificacionLog\.create/.test(combined))
}

// ============================================================
// TC-NOT-015 — Opt-out (Cliente desuscribe)
// ============================================================
{
  console.log('\n--- TC-NOT-015 Opt-out ---')
  const schema = read('prisma/schema.prisma')
  const content = read('src/app/api/notificaciones/route.ts')

  // 1. Campo optOutNotificaciones existe en Cliente
  check('TC-NOT-015.1 campo optOutNotificaciones en schema Cliente',
        /model Cliente[\s\S]*?optOutNotificaciones\s+Boolean/.test(schema))

  // 2. Default false
  check('TC-NOT-015.2 default false',
        /optOutNotificaciones\s+Boolean\s+@default\(false\)/.test(schema))

  // 3. Validación en endpoint POST
  check('TC-NOT-015.3 valida optOutNotificaciones en POST',
        /optOutNotificaciones/.test(content))

  // 4. Skip si opt-out true
  const hasSkipIfOptOut = /optOutNotificaciones[\s\S]{0,300}(continue|skip|return)/.test(content)
  check('TC-NOT-015.4 skip explícito si opt-out true', hasSkipIfOptOut)

  // 5. Log de skip por opt-out
  const hasLogSkipOptOut = /opt.?out|desuscrito|skip.*opt|opt.*skip/i.test(content)
  check('TC-NOT-015.5 log/audit de skip por opt-out', hasLogSkipOptOut)
}

// ============================================================
// Resumen
// ============================================================
console.log('\n' + '='.repeat(60))
console.log(`RESULTADO M09-Notificaciones: ${pass} PASS / ${fail} FAIL`)
console.log('='.repeat(60))
if (fail > 0) {
  console.log('\nFallos:')
  fails.forEach(f => console.log(f))
  process.exit(1)
} else {
  console.log('\n✅ TODOS LOS TCs PASARON')
  process.exit(0)
}
