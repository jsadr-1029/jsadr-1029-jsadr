/**
 * Adds `requireRole(['ADMIN','GESTOR'])` auth check to sensitive endpoints
 * that don't already have it. Idempotent: skips files that already import
 * auth-guard or have requireRole call.
 */
const fs = require('fs')
const path = require('path')

const ENDPOINTS = [
  'src/app/api/prestamos/calcular-cuota-personalizada/route.ts',
  'src/app/api/prestamos/[id]/renovar/route.ts',
  'src/app/api/prestamos/[id]/enviar-codigo/route.ts',
  'src/app/api/prestamos/[id]/aceptar-tyc-otp/route.ts',
  'src/app/api/prestamos/[id]/verificar-codigo/route.ts',
  'src/app/api/prestamos/[id]/enviar-confirmacion/route.ts',
  'src/app/api/pagos/[id]/reversar/route.ts',
]

const AUTH_IMPORT = `import { requireRole } from '@/lib/security'`
const AUTH_CHECK = `    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth
`

let patched = 0
for (const rel of ENDPOINTS) {
  const file = path.join('/home/z/my-project', rel)
  if (!fs.existsSync(file)) {
    console.log(`SKIP (missing): ${rel}`)
    continue
  }
  let src = fs.readFileSync(file, 'utf8')

  if (src.includes('requireRole')) {
    console.log(`SKIP (already has): ${rel}`)
    continue
  }

  // 1. Add import at top (after first line of existing imports)
  if (!src.includes(AUTH_IMPORT)) {
    // Find the last import line
    const lines = src.split('\n')
    let lastImportIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportIdx = i
    }
    if (lastImportIdx === -1) {
      // No imports — prepend
      src = AUTH_IMPORT + '\n' + src
    } else {
      lines.splice(lastImportIdx + 1, 0, AUTH_IMPORT)
      src = lines.join('\n')
    }
  }

  // 2. Add auth check at the start of each exported async function (POST/GET/PATCH/PUT/DELETE)
  // Match: `export async function POST(req: NextRequest) {` then a newline
  src = src.replace(
    /export async function (POST|GET|PATCH|PUT|DELETE)\(([^)]*)\)\s*{\s*\n/g,
    (match, method, args) => {
      // If function signature has no req param, can't add check
      if (!args.includes('req') && !args.includes('NextRequest')) return match
      return `export async function ${method}(${args}) {\n${AUTH_CHECK}`
    }
  )

  fs.writeFileSync(file, src, 'utf8')
  patched++
  console.log(`PATCHED: ${rel}`)
}

console.log(`\nDone. Patched ${patched} files.`)
