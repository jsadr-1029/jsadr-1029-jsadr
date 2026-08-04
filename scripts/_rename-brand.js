#!/usr/bin/env node
// =====================================================
// Reemplazo de marca: "Aurora Bancaria" → "Jo*** Se*** Al*** D** R**"
// -----------------------------------------------------
// Conservador: NO toca claves criptográficas ni listas de
// contraseñas históricas que romperían backups existentes.
// =====================================================

const fs = require('fs')
const path = require('path')

// Archivos que NO se deben tocar (claves criptográficas / contraseñas)
const SKIP_FILES = new Set([
  '/home/z/my-project/src/lib/security.ts',           // clave de backup JSADR-AURORA-BANCARIA-BACKUP-KEY-v1
  '/home/z/my-project/scripts/test-restaurar-backup.js', // misma clave
  '/home/z/my-project/scripts/poblar-smtp-backup.js',    // misma clave
  '/home/z/my-project/scripts/unlock_admin.js',          // lista de contraseñas antiguas
  '/home/z/my-project/src/app/globals.css',              // tema visual "Aurora" (gradiente, no marca)
  '/home/z/my-project/src/app/login/page.tsx',           // comentario "Aurora animada" = animación visual
])

// Mapeo de reemplazos (de más específico a menos específico)
const REPLACEMENTS = [
  // Formas compuestas con "Jsadr" / "JSADR"
  { from: /Jsadr\s*-\s*Aurora\s*Bancaria/gi, to: 'Jsadr · Jo*** Se*** Al*** D** R**' },
  { from: /Jsadr\s*Aurora\s*Bancaria/gi, to: 'Jsadr · Jo*** Se*** Al*** D** R**' },
  { from: /JSADR\s*Aurora\s*Bancaria/gi, to: 'JSADR Jo*** Se*** Al*** D** R**' },
  { from: /JSADR\s*·\s*Aurora\s*Bancaria/gi, to: 'JSADR · Jo*** Se*** Al*** D** R**' },
  // Forma sola
  { from: /Aurora\s*Bancaria/g, to: 'Jo*** Se*** Al*** D** R**' },
  { from: /Aurora\s*Bancaria/gi, to: 'Jo*** Se*** Al*** D** R**' },
  // Emails y dominios internos
  { from: /system@aurora\.local/gi, to: 'system@jsadr.local' },
  // Comentario hardcoded key (solo el string viejo en comentarios, no la clave misma)
  { from: /jsadr-aurora-bancaria-dynamic-key-secret-2026-v1/gi, to: 'jsadr-dynamic-key-secret-2026-v1' },
  // Versiones con v4.0 / v5.0 — preservar el número de versión
  { from: /Aurora\s*Bancaria\s*v(\d+\.\d+)/gi, to: 'Jo*** Se*** Al*** D** R** v$1' },
]

const filesToProcess = [
  '/home/z/my-project/prisma/schema.prisma',
  '/home/z/my-project/src/app/api/chat/notas/route.ts',
  '/home/z/my-project/src/app/api/chat/clave-dinamica/route.ts',
  '/home/z/my-project/scripts/audit-prestamos-scenarios.js',
  '/home/z/my-project/scripts/sync-brevo-to-conexionapi.js',
  '/home/z/my-project/scripts/setup-brevo-local.js',
  '/home/z/my-project/scripts/_generate-stats.js',
  '/home/z/my-project/scripts/update-brevo-key.js',
  '/home/z/my-project/scripts/reasignar-permisos-apis.js',
  '/home/z/my-project/scripts/_generate-judicial-review.js',
  '/home/z/my-project/scripts/test-brevo-send.js',
  '/home/z/my-project/scripts/test-brevo-with-key.js',
  '/home/z/my-project/scripts/test-otp-e2e.js',
  '/home/z/my-project/scripts/test-app-email-path.js',
]

let totalChanges = 0
const results = []

for (const file of filesToProcess) {
  if (SKIP_FILES.has(file)) {
    results.push(`SKIP  ${file} (protegido)`)
    continue
  }
  if (!fs.existsSync(file)) {
    results.push(`MISS  ${file} (no existe)`)
    continue
  }
  const original = fs.readFileSync(file, 'utf8')
  let modified = original
  let changes = 0
  for (const { from, to } of REPLACEMENTS) {
    const matches = modified.match(from)
    if (matches) {
      changes += matches.length
      modified = modified.replace(from, to)
    }
  }
  if (changes > 0) {
    fs.writeFileSync(file, modified, 'utf8')
    results.push(`OK    ${file} — ${changes} reemplazo(s)`)
    totalChanges += changes
  } else {
    results.push(`NOOP  ${file} (sin coincidencias)`)
  }
}

console.log('=== Resultado del reemplazo ===')
results.forEach((r) => console.log(r))
console.log(`\nTotal: ${totalChanges} reemplazo(s) en ${filesToProcess.length} archivos`)
console.log(`Archivos protegidos (no modificados): ${SKIP_FILES.size}`)
