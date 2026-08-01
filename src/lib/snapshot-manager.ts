// =====================================================
// Snapshot Manager — Captura, restauración y comparación
// de snapshots completos del proyecto
// =====================================================

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// === CONFIGURACIÓN ===
const PROJECT_ROOT = process.cwd()
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, 'download', 'snapshots')

// Directorios y archivos a EXCLUIR del snapshot
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'download',
  'db',
  'scripts',
  'skills',
  'tool-results',
  'agent-ctx',
  'examples',
  'mini-services',
  'upload',
  '.turbo',
]

const EXCLUDE_FILES = ['.env', '.env.local', 'dev.log', 'bun.lock']

// Archivos de configuración clave a capturar siempre
const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'components.json',
  'eslint.config.mjs',
  'Caddyfile',
  'vercel.json',
]

// Extensiones de código a capturar
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.mjs', '.prisma', '.md']

// === TIPOS ===
export interface SnapshotFile {
  path: string
  hash: string
  size: number
  content: string // base64
}

export interface SnapshotData {
  uuid: string
  version: string
  nombre: string
  descripcion: string
  timestamp: string
  proyecto: string
  files: SnapshotFile[]
  configFiles: Record<string, string>
  metadata: {
    totalFiles: number
    totalSize: number
    nodeVersion: string
    prismaVersion: string
    modulos: string[]
  }
}

export interface SnapshotSummary {
  uuid: string
  version: string
  nombre: string
  descripcion: string
  timestamp: string
  totalFiles: number
  totalSize: number
  modulos: string[]
}

export interface CompareResult {
  agregados: string[]
  eliminados: string[]
  modificados: string[]
  modulosAfectados: string[]
  totalCambios: number
}

// === UTILIDADES ===

function shouldExclude(filePath: string): boolean {
  const relative = path.relative(PROJECT_ROOT, filePath)
  for (const dir of EXCLUDE_DIRS) {
    if (relative.startsWith(dir + '/') || relative === dir) return true
  }
  for (const file of EXCLUDE_FILES) {
    if (relative === file) return true
  }
  return false
}

function shouldInclude(filePath: string): boolean {
  const ext = path.extname(filePath)
  return CODE_EXTENSIONS.includes(ext)
}

function hashFile(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function scanDirectory(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (shouldExclude(fullPath)) continue
    if (entry.isDirectory()) {
      scanDirectory(fullPath, files)
    } else if (entry.isFile() && shouldInclude(fullPath)) {
      files.push(fullPath)
    }
  }
  return files
}

function detectModules(files: string[]): string[] {
  const modulos = new Set<string>()
  for (const f of files) {
    const relative = path.relative(PROJECT_ROOT, f)
    // src/app/api/<modulo>/
    const apiMatch = relative.match(/^src\/app\/api\/([^/]+)/)
    if (apiMatch) modulos.add(`API: ${apiMatch[1]}`)
    // src/components/views/<vista>
    const viewMatch = relative.match(/^src\/components\/views\/([^/]+)/)
    if (viewMatch) modulos.add(`View: ${viewMatch[1].replace('.tsx', '')}`)
    // src/lib/<lib>
    const libMatch = relative.match(/^src\/lib\/([^/]+)/)
    if (libMatch) modulos.add(`Lib: ${libMatch[1].replace('.ts', '')}`)
    // src/app/api/
    if (relative.startsWith('src/app/api/')) modulos.add('APIs')
    // prisma/
    if (relative.startsWith('prisma/')) modulos.add('Prisma Schema')
  }
  return Array.from(modulos).sort()
}

// === CAPTURAR SNAPSHOT ===

export function crearSnapshot(params: {
  uuid: string
  version: string
  nombre: string
  descripcion: string
  usuarioId?: string
  usuarioNombre?: string
  motivo?: string
}): { data: SnapshotData; rutaArchivo: string; tamano: number; checksum: string } {
  // Asegurar directorio
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
  }

  // Escanear src/
  const srcDir = path.join(PROJECT_ROOT, 'src')
  const filePaths = scanDirectory(srcDir)

  // Capturar archivos de src/
  const files: SnapshotFile[] = []
  let totalSize = 0

  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath)
      const relativePath = path.relative(PROJECT_ROOT, filePath)
      files.push({
        path: relativePath,
        hash: hashFile(content),
        size: content.length,
        content: content.toString('base64'),
      })
      totalSize += content.length
    } catch (e) {
      // Saltar archivos que no se pueden leer
    }
  }

  // Capturar archivos de configuración
  const configFiles: Record<string, string> = {}
  for (const cfgFile of CONFIG_FILES) {
    const cfgPath = path.join(PROJECT_ROOT, cfgFile)
    if (fs.existsSync(cfgPath)) {
      try {
        configFiles[cfgFile] = fs.readFileSync(cfgPath).toString('base64')
        totalSize += Buffer.byteLength(configFiles[cfgFile], 'base64')
      } catch (e) {
        // Saltar
      }
    }
  }

  // Capturar schema.prisma
  const schemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma')
  if (fs.existsSync(schemaPath)) {
    configFiles['prisma/schema.prisma'] = fs.readFileSync(schemaPath).toString('base64')
    totalSize += Buffer.byteLength(configFiles['prisma/schema.prisma'], 'base64')
  }

  // Detectar módulos
  const modulos = detectModules(filePaths)

  // Crear estructura del snapshot
  const data: SnapshotData = {
    uuid: params.uuid,
    version: params.version,
    nombre: params.nombre,
    descripcion: params.descripcion,
    timestamp: new Date().toISOString(),
    proyecto: 'Jsadr',
    files,
    configFiles,
    metadata: {
      totalFiles: files.length + Object.keys(configFiles).length,
      totalSize,
      nodeVersion: '16.1.3',
      prismaVersion: '6.19.2',
      modulos,
    },
  }

  // Guardar como JSON
  const jsonStr = JSON.stringify(data, null, 2)
  const nombreArchivo = `snapshot_${params.uuid}.json`
  const rutaArchivo = path.join(SNAPSHOTS_DIR, nombreArchivo)
  fs.writeFileSync(rutaArchivo, jsonStr, 'utf-8')

  const tamano = Buffer.byteLength(jsonStr, 'utf-8')
  const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex')

  return { data, rutaArchivo, tamano, checksum }
}

// === RESTAURAR SNAPSHOT ===

export function restaurarSnapshot(rutaArchivo: string): {
  archivosRestaurados: number
  modulosAfectados: string[]
  errores: string[]
} {
  if (!fs.existsSync(rutaArchivo)) {
    throw new Error('Archivo de snapshot no encontrado')
  }

  const jsonStr = fs.readFileSync(rutaArchivo, 'utf-8')
  const data: SnapshotData = JSON.parse(jsonStr)

  let archivosRestaurados = 0
  const errores: string[] = []
  const modulosAfectados = new Set<string>()

  // Restaurar archivos de src/
  for (const file of data.files) {
    try {
      const fullPath = path.join(PROJECT_ROOT, file.path)
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const content = Buffer.from(file.content, 'base64')
      fs.writeFileSync(fullPath, content)
      archivosRestaurados++
      // Detectar módulo
      const modMatch = file.path.match(/^src\/app\/api\/([^/]+)/) || file.path.match(/^src\/components\/views\/([^/]+)/)
      if (modMatch) modulosAfectados.add(modMatch[1])
    } catch (e: any) {
      errores.push(`${file.path}: ${e.message}`)
    }
  }

  // Restaurar archivos de configuración
  for (const [cfgPath, content] of Object.entries(data.configFiles)) {
    try {
      const fullPath = path.join(PROJECT_ROOT, cfgPath)
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(fullPath, Buffer.from(content, 'base64'))
      archivosRestaurados++
    } catch (e: any) {
      errores.push(`${cfgPath}: ${e.message}`)
    }
  }

  return {
    archivosRestaurados,
    modulosAfectados: Array.from(modulosAfectados).sort(),
    errores,
  }
}

// === COMPARAR SNAPSHOTS ===

export function compararSnapshots(rutaA: string, rutaB: string): CompareResult {
  if (!fs.existsSync(rutaA)) throw new Error('Snapshot A no encontrado')
  if (!fs.existsSync(rutaB)) throw new Error('Snapshot B no encontrado')

  const dataA: SnapshotData = JSON.parse(fs.readFileSync(rutaA, 'utf-8'))
  const dataB: SnapshotData = JSON.parse(fs.readFileSync(rutaB, 'utf-8'))

  // Crear mapas path → hash
  const mapA = new Map<string, string>()
  const mapB = new Map<string, string>()

  for (const f of dataA.files) mapA.set(f.path, f.hash)
  for (const [k, v] of Object.entries(dataA.configFiles)) {
    mapA.set(k, crypto.createHash('sha256').update(Buffer.from(v, 'base64')).digest('hex'))
  }

  for (const f of dataB.files) mapB.set(f.path, f.hash)
  for (const [k, v] of Object.entries(dataB.configFiles)) {
    mapB.set(k, crypto.createHash('sha256').update(Buffer.from(v, 'base64')).digest('hex'))
  }

  const agregados: string[] = []
  const eliminados: string[] = []
  const modificados: string[] = []

  // Archivos en B pero no en A = agregados
  for (const [path] of mapB) {
    if (!mapA.has(path)) agregados.push(path)
  }

  // Archivos en A pero no en B = eliminados
  for (const [path] of mapA) {
    if (!mapB.has(path)) eliminados.push(path)
  }

  // Archivos en ambos pero con hash diferente = modificados
  for (const [path, hashA] of mapA) {
    const hashB = mapB.get(path)
    if (hashB && hashA !== hashB) modificados.push(path)
  }

  // Detectar módulos afectados
  const modulosAfectados = new Set<string>()
  for (const p of [...agregados, ...eliminados, ...modificados]) {
    const modMatch = p.match(/^src\/app\/api\/([^/]+)/) || p.match(/^src\/components\/views\/([^/]+)/) || p.match(/^src\/lib\/([^/]+)/)
    if (modMatch) modulosAfectados.add(modMatch[1])
    if (p.endsWith('schema.prisma')) modulosAfectados.add('Prisma Schema')
    if (p === 'package.json') modulosAfectados.add('Dependencias')
  }

  return {
    agregados: agregados.sort(),
    eliminados: eliminados.sort(),
    modificados: modificados.sort(),
    modulosAfectados: Array.from(modulosAfectados).sort(),
    totalCambios: agregados.length + eliminados.length + modificados.length,
  }
}

// === LEER RESUMEN DE SNAPSHOT ===

export function leerResumen(rutaArchivo: string): SnapshotSummary {
  if (!fs.existsSync(rutaArchivo)) throw new Error('Snapshot no encontrado')
  const data: SnapshotData = JSON.parse(fs.readFileSync(rutaArchivo, 'utf-8'))
  return {
    uuid: data.uuid,
    version: data.version,
    nombre: data.nombre,
    descripcion: data.descripcion,
    timestamp: data.timestamp,
    totalFiles: data.metadata.totalFiles,
    totalSize: data.metadata.totalSize,
    modulos: data.metadata.modulos,
  }
}

// === GENERAR UUID ===

export function generarUUID(): string {
  return crypto.randomUUID()
}

// === GENERAR SIGUIENTE VERSIÓN ===

export function sugerirVersion(versiones: string[]): string {
  if (versiones.length === 0) return '1.0.1'
  // Tomar la última versión y incrementar patch
  const ultima = versiones[0] // ya ordenadas desc
  const parts = ultima.split('.').map(Number)
  if (parts.length === 3 && !isNaN(parts[2])) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  }
  return '1.0.1'
}
