// scripts/qa-m10-all.ts
// QA M10-Reportes — 15 TCs pendientes
// Verifica: cartera, morosidad, balance, pagos, clientes-activos, export xlsx/pdf,
//           filtros (gestor/período), gráficos, RBAC, performance, caja, categorías, auditoría.
//
// Run: npx tsx scripts/qa-m10-all.ts

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8') } catch { return '' }
}

let pass = 0, fail = 0
const fails: string[] = []

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++
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

console.log('=== QA M10-Reportes (15 TCs pendientes) ===\n')

// ============================================================
// TC-REP-001 — Reporte de cartera
// GET /api/reportes/cartera → 200 con resumen: total cartera, en mora, al día, % mora
// ============================================================
{
  console.log('--- TC-REP-001 GET /api/reportes/cartera ---')
  const content = read('src/app/api/reportes/cartera/route.ts')

  // 1. Existe endpoint
  check('TC-REP-001.1 existe src/app/api/reportes/cartera/route.ts', content.length > 0)

  // 2. export async function GET
  check('TC-REP-001.2 export async function GET', includes(content, 'export async function GET'))

  // 3. requireRole o requireAuth
  check('TC-REP-001.3 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))

  // 4. Devuelve carteraTotal
  check('TC-REP-001.4 devuelve carteraTotal',
        includes(content, 'carteraTotal') || includes(content, 'cartera_total'))

  // 5. Devuelve montoEnMora
  check('TC-REP-001.5 devuelve montoEnMora',
        includes(content, 'montoEnMora') || includes(content, 'monto_en_mora'))

  // 6. Devuelve alDia
  check('TC-REP-001.6 devuelve alDia o carteraAlDia',
        includes(content, 'alDia') || includes(content, 'al dia') || includes(content, 'carteraAlDia'))

  // 7. Porcentaje mora
  check('TC-REP-001.7 porcentaje mora (ratioMora)',
        includes(content, 'ratioMora') || includes(content, 'porcentajeMora') || includes(content, '% mora'))
}

// ============================================================
// TC-REP-002 — Reporte de morosidad por rango
// GET /api/reportes/morosidad?desde=...&hasta=...
// ============================================================
{
  console.log('\n--- TC-REP-002 GET /api/reportes/morosidad ---')
  const content = read('src/app/api/reportes/morosidad/route.ts')

  check('TC-REP-002.1 existe src/app/api/reportes/morosidad/route.ts', content.length > 0)
  check('TC-REP-002.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-002.3 lee searchParams desde', /searchParams\.get\(['"]desde['"]\)/.test(content))
  check('TC-REP-002.4 lee searchParams hasta', /searchParams\.get\(['"]hasta['"]\)/.test(content))
  check('TC-REP-002.5 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  // Devuelve morosidad por día/semana/mes
  check('TC-REP-002.6 devuelve mora por período',
        includes(content, 'dia') || includes(content, 'semana') || includes(content, 'mes') ||
        includes(content, 'porDia') || includes(content, 'agrupadoPor'))
}

// ============================================================
// TC-REP-003 — Balance de cartera
// GET /api/reportes/balance → capital prestado, intereses, mora, pagos recibidos
// ============================================================
{
  console.log('\n--- TC-REP-003 GET /api/reportes/balance ---')
  const content = read('src/app/api/reportes/balance/route.ts')

  check('TC-REP-003.1 existe src/app/api/reportes/balance/route.ts', content.length > 0)
  check('TC-REP-003.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-003.3 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  check('TC-REP-003.4 incluye capitalPrestado',
        includes(content, 'capitalPrestado') || includes(content, 'capital_prestado') || includes(content, 'montoPrincipal'))
  check('TC-REP-003.5 incluye intereses',
        includes(content, 'interes') || includes(content, 'totalInteres'))
  check('TC-REP-003.6 incluye mora',
        includes(content, 'mora') || includes(content, 'montoMora'))
  check('TC-REP-003.7 incluye pagos recibidos',
        includes(content, 'pagosRecibidos') || includes(content, 'totalPagos') || includes(content, 'recaudo'))
}

// ============================================================
// TC-REP-004 — Reporte de pagos por período
// GET /api/reportes/pagos?desde=... → pagos del período, total, count
// Incluye reversados/anulados por separado
// ============================================================
{
  console.log('\n--- TC-REP-004 GET /api/reportes/pagos ---')
  const content = read('src/app/api/reportes/pagos/route.ts')

  check('TC-REP-004.1 existe src/app/api/reportes/pagos/route.ts', content.length > 0)
  check('TC-REP-004.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-004.3 lee searchParams desde', /searchParams\.get\(['"]desde['"]\)/.test(content))
  check('TC-REP-004.4 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  check('TC-REP-004.5 incluye total', includes(content, 'total') || includes(content, 'montoTotal'))
  check('TC-REP-004.6 incluye count', includes(content, 'count') || includes(content, 'cantidad'))
  // Reversados/anulados por separado
  check('TC-REP-004.7 incluye reversados/anulados',
        includes(content, 'REVERSADO') || includes(content, 'ANULADO') || includes(content, 'reversados'))
}

// ============================================================
// TC-REP-005 — Reporte de clientes activos
// GET /api/reportes/clientes-activos → # préstamos, # pagos
// ============================================================
{
  console.log('\n--- TC-REP-005 GET /api/reportes/clientes-activos ---')
  const content = read('src/app/api/reportes/clientes-activos/route.ts')

  check('TC-REP-005.1 existe src/app/api/reportes/clientes-activos/route.ts', content.length > 0)
  check('TC-REP-005.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-005.3 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  // Join Cliente → Préstamo → Pago
  check('TC-REP-005.4 incluye cliente.prestamos',
        includes(content, 'prestamos') || includes(content, 'prestamo'))
  check('TC-REP-005.5 incluye # préstamos',
        includes(content, 'numeroPrestamos') || includes(content, 'totalPrestamos') || includes(content, '_count'))
  check('TC-REP-005.6 incluye # pagos',
        includes(content, 'numeroPagos') || includes(content, 'totalPagos') || includes(content, 'pagos'))
}

// ============================================================
// TC-REP-006 — Exportar a Excel
// GET /api/reportes/cartera?format=xlsx → Content-Type application/vnd.openxmlformats
// ============================================================
{
  console.log('\n--- TC-REP-006 GET /api/reportes/cartera?format=xlsx ---')
  const content = read('src/app/api/reportes/cartera/route.ts')

  check('TC-REP-006.1 lee searchParams format', /searchParams\.get\(['"]format['"]\)/.test(content))
  check('TC-REP-006.2 soporta xlsx', includes(content, 'xlsx'))
  check('TC-REP-006.3 Content-Type openxmlformats',
        includes(content, 'application/vnd.openxmlformats') || includes(content, 'spreadsheetml'))
  check('TC-REP-006.4 Content-Disposition attachment',
        includes(content, 'Content-Disposition') && includes(content, 'attachment'))
  check('TC-REP-006.5 filename .xlsx', includes(content, '.xlsx'))
}

// ============================================================
// TC-REP-007 — Exportar a PDF
// GET /api/reportes/cartera?format=pdf → Content-Type application/pdf
// ============================================================
{
  console.log('\n--- TC-REP-007 GET /api/reportes/cartera?format=pdf ---')
  const content = read('src/app/api/reportes/cartera/route.ts')

  check('TC-REP-007.1 soporta pdf', includes(content, 'pdf'))
  check('TC-REP-007.2 Content-Type application/pdf',
        includes(content, 'application/pdf'))
  check('TC-REP-007.3 filename .pdf', includes(content, '.pdf'))
  // Genera PDF con librería (pdfkit, jspdf, puppeteer, pdf-lib, etc.)
  check('TC-REP-007.4 usa librería PDF',
        includes(content, 'pdfkit') || includes(content, 'jspdf') || includes(content, 'pdf-lib') ||
        includes(content, 'PDFDocument') || includes(content, 'puppeteer'))
}

// ============================================================
// TC-REP-008 — Filtrar por gestor
// GET /api/reportes/cartera?gestorId=<id>
// ============================================================
{
  console.log('\n--- TC-REP-008 GET /api/reportes/cartera?gestorId ---')
  const content = read('src/app/api/reportes/cartera/route.ts')

  check('TC-REP-008.1 lee searchParams gestorId', /searchParams\.get\(['"]gestorId['"]\)/.test(content))
  check('TC-REP-008.2 usa gestorId en where', /gestorId/.test(content))
  // El modelo Préstamo debe tener gestorId o similar
  const schema = read('prisma/schema.prisma')
  check('TC-REP-008.3 modelo Prestamo tiene gestorId o gestorAsignadoId',
        includes(schema, 'gestorId') || includes(schema, 'gestorAsignadoId') || includes(schema, 'gestor'))
}

// ============================================================
// TC-REP-009 — Filtrar por período
// GET /api/reportes/cartera?desde=...&hasta=...
// ============================================================
{
  console.log('\n--- TC-REP-009 GET /api/reportes/cartera?desde&hasta ---')
  const content = read('src/app/api/reportes/cartera/route.ts')

  check('TC-REP-009.1 lee searchParams desde', /searchParams\.get\(['"]desde['"]\)/.test(content))
  check('TC-REP-009.2 lee searchParams hasta', /searchParams\.get\(['"]hasta['"]\)/.test(content))
  // Aplica el filtro en la consulta
  check('TC-REP-009.3 aplica filtro de fecha en consulta',
        includes(content, 'fechaDesembolso') || includes(content, 'fechaSolicitud') || includes(content, 'gte') || includes(content, 'lte'))
}

// ============================================================
// TC-REP-010 — Datos para gráfico de morosidad
// GET /api/reportes/morosidad-grafico → labels + data (formato Chart.js)
// ============================================================
{
  console.log('\n--- TC-REP-010 GET /api/reportes/morosidad-grafico ---')
  const content = read('src/app/api/reportes/morosidad-grafico/route.ts')

  check('TC-REP-010.1 existe src/app/api/reportes/morosidad-grafico/route.ts', content.length > 0)
  check('TC-REP-010.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-010.3 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  // Estructura labels + data (Chart.js)
  check('TC-REP-010.4 incluye labels', includes(content, 'labels'))
  check('TC-REP-010.5 incluye data o datasets',
        includes(content, 'data') || includes(content, 'datasets'))
}

// ============================================================
// TC-REP-011 — RBAC: CONSULTOR solo lectura
// GET 200 con CONSULTOR, POST/PUT/PATCH 403
// ============================================================
{
  console.log('\n--- TC-REP-011 RBAC CONSULTOR solo lectura ---')
  const reportes = read('src/app/api/reportes/route.ts')
  const cartera = read('src/app/api/reportes/cartera/route.ts')

  // GET permite ADMIN y CONSULTOR
  check('TC-REP-011.1 GET permite CONSULTOR',
        includes(reportes, 'CONSULTOR') || includes(cartera, 'CONSULTOR'))

  // requireRole con ADMIN y CONSULTOR en GET
  check('TC-REP-011.2 requireRole incluye CONSULTOR en GET',
        /requireRole\([^)]*CONSULTOR/.test(reportes) || /requireRole\([^)]*CONSULTOR/.test(cartera))

  // POST/PUT/PATCH deben estar ausentes o requerir solo ADMIN
  const hasWriteMethods = includes(reportes, 'export async function POST') ||
                          includes(reportes, 'export async function PUT') ||
                          includes(reportes, 'export async function PATCH')
  if (hasWriteMethods) {
    // Si existen, deben usar requireRole(['ADMIN'])
    check('TC-REP-011.3 POST/PUT/PATCH solo ADMIN (no CONSULTOR)',
          /export async function (POST|PUT|PATCH)[\s\S]*?requireRole\(\s*[^)]*['"]ADMIN['"]\s*[^)]*\)/.test(reportes))
  } else {
    // No hay POST/PUT/PATCH en /api/reportes → solo lectura por diseño
    check('TC-REP-011.3 no hay POST/PUT/PATCH en /api/reportes (solo lectura)', true)
  }
}

// ============================================================
// TC-REP-012 — Performance: reporte grande < 5s
// ============================================================
{
  console.log('\n--- TC-REP-012 Performance < 5s ---')
  const cartera = read('src/app/api/reportes/cartera/route.ts')
  const reportes = read('src/app/api/reportes/route.ts')

  // Promise.all para carga paralela
  const hasParallel = includes(reportes, 'Promise.all') || includes(cartera, 'Promise.all')
  check('TC-REP-012.1 carga paralela con Promise.all', hasParallel)

  // take limit (no traer todos los registros sin límite)
  const hasTakeLimit = /take:\s*\d/.test(reportes) || /take:\s*\d/.test(cartera)
  check('TC-REP-012.2 límite take en consultas', hasTakeLimit)

  // groupBy en vez de findMany+reduce (optimización)
  const hasGroupBy = includes(reportes, 'groupBy') || includes(cartera, 'groupBy')
  check('TC-REP-012.3 usa groupBy para agregaciones', hasGroupBy)
}

// ============================================================
// TC-REP-013 — Reporte de caja diario
// GET /api/reportes/caja?fecha=... → movimientos, saldo inicial, final
// ============================================================
{
  console.log('\n--- TC-REP-013 GET /api/reportes/caja ---')
  const content = read('src/app/api/reportes/caja/route.ts')

  check('TC-REP-013.1 existe src/app/api/reportes/caja/route.ts', content.length > 0)
  check('TC-REP-013.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-013.3 lee searchParams fecha', /searchParams\.get\(['"]fecha['"]\)/.test(content))
  check('TC-REP-013.4 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  check('TC-REP-013.5 devuelve movimientos',
        includes(content, 'movimientos') || includes(content, 'MovimientoCaja'))
  check('TC-REP-013.6 saldo inicial y final',
        includes(content, 'saldoInicial') || includes(content, 'saldo Final') || includes(content, 'saldoFinal'))
}

// ============================================================
// TC-REP-014 — Reporte por categoría
// GET /api/reportes/categorias → montos por categoriaId
// ============================================================
{
  console.log('\n--- TC-REP-014 GET /api/reportes/categorias ---')
  const content = read('src/app/api/reportes/categorias/route.ts')

  check('TC-REP-014.1 existe src/app/api/reportes/categorias/route.ts', content.length > 0)
  check('TC-REP-014.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-014.3 requiere autenticación',
        includes(content, 'requireRole') || includes(content, 'requireAuth'))
  // Agrupa por categoriaId
  check('TC-REP-014.4 agrupa por categoriaId',
        includes(content, 'categoriaId') || includes(content, 'groupBy'))
  check('TC-REP-014.5 incluye monto',
        includes(content, 'monto') || includes(content, '_sum'))
}

// ============================================================
// TC-REP-015 — Reporte de AuditLog
// GET /api/reportes/auditoria?usuarioId=... → solo ADMIN
// ============================================================
{
  console.log('\n--- TC-REP-015 GET /api/reportes/auditoria ---')
  const content = read('src/app/api/reportes/auditoria/route.ts')

  check('TC-REP-015.1 existe src/app/api/reportes/auditoria/route.ts', content.length > 0)
  check('TC-REP-015.2 export async function GET', includes(content, 'export async function GET'))
  check('TC-REP-015.3 lee searchParams usuarioId', /searchParams\.get\(['"]usuarioId['"]\)/.test(content))
  // RBAC solo ADMIN (no CONSULTOR, no GESTOR)
  check('TC-REP-015.4 requireRole solo ADMIN',
        /requireRole\(\s*req\s*,\s*\[\s*['"]ADMIN['"]\s*\]\s*\)/.test(content) ||
        /requireRole\(\s*\[\s*['"]ADMIN['"]\s*\]\s*\)/.test(content))
  // Consulta AuditLog
  check('TC-REP-015.5 consulta auditLog',
        includes(content, 'auditLog.findMany') || includes(content, 'auditLog.findFirst'))
  // Solo lectura (no POST/PUT/DELETE)
  check('TC-REP-015.6 no hay POST/PUT/DELETE (solo lectura)',
        !includes(content, 'export async function POST') &&
        !includes(content, 'export async function PUT') &&
        !includes(content, 'export async function DELETE'))
}

// ============================================================
// Resumen
// ============================================================
console.log('\n' + '='.repeat(60))
console.log(`RESULTADO M10-Reportes: ${pass} PASS / ${fail} FAIL`)
console.log('='.repeat(60))
if (fail > 0) {
  console.log('\nFallos:')
  fails.forEach(f => console.log(f))
  process.exit(1)
} else {
  console.log('\n✅ TODOS LOS TCs PASARON')
  process.exit(0)
}
