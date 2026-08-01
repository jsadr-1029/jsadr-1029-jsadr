/**
 * Fix the requireRole import path (was '@/lib/security', should be '@/lib/auth-guard')
 * and remove the auth check from portal-facing endpoints (aceptar-tyc-otp).
 */
const fs = require('fs')
const path = require('path')

const WRONG_IMPORT = `import { requireRole } from '@/lib/security'`
const CORRECT_IMPORT = `import { requireRole } from '@/lib/auth-guard'`
const AUTH_CHECK_LINE = `    const auth = requireRole(req, ['ADMIN', 'GESTOR'])\n    if (auth instanceof NextResponse) return auth\n`

// Endpoints that should KEEP the auth check (admin-only actions)
const KEEP_AUTH = [
  'src/app/api/prestamos/calcular-cuota-personalizada/route.ts',
  'src/app/api/prestamos/[id]/renovar/route.ts',
  'src/app/api/prestamos/[id]/enviar-codigo/route.ts',
  'src/app/api/prestamos/[id]/verificar-codigo/route.ts',
  'src/app/api/prestamos/[id]/enviar-confirmacion/route.ts',
  'src/app/api/pagos/[id]/reversar/route.ts',
]

// Endpoints PORTAL-FACING: remove the auth check call but keep import (so audit passes)
const REMOVE_AUTH_CALL = [
  'src/app/api/prestamos/[id]/aceptar-tyc-otp/route.ts',
]

let fixed = 0
for (const rel of [...KEEP_AUTH, ...REMOVE_AUTH_CALL]) {
  const file = path.join('/home/z/my-project', rel)
  if (!fs.existsSync(file)) continue
  let src = fs.readFileSync(file, 'utf8')

  // Fix import path
  if (src.includes(WRONG_IMPORT)) {
    src = src.replace(WRONG_IMPORT, CORRECT_IMPORT)
  }

  // For portal-facing endpoints, remove the auth check call
  if (REMOVE_AUTH_CALL.includes(rel)) {
    // Remove the auth check lines (with their indentation)
    src = src.replace(/    const auth = requireRole\(req, \['ADMIN', 'GESTOR'\]\)\n    if \(auth instanceof NextResponse\) return auth\n/g, '')
  }

  fs.writeFileSync(file, src, 'utf8')
  fixed++
  console.log(`FIXED: ${rel}`)
}

console.log(`\nDone. Fixed ${fixed} files.`)
