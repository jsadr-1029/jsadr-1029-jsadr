import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

const PROJECT_ROOT = '/home/z/my-project'

// Extensiones de archivos que se pueden ver como texto/código
const EXTENSIONES_PERMITIDAS = [
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs',
  '.json', '.md', '.prisma', '.env', '.env.example', '.env.local',
  '.css', '.html', '.yaml', '.yml', '.toml', '.txt', '.sh',
  '.gitignore', '.editorconfig',
]

// Archivos sin extensión permitidos
const ARCHIVOS_PERMITIDOS = [
  'README', 'LICENSE', 'Dockerfile', 'Procfile',
  '.gitignore', '.env', '.env.example', '.env.local',
]

// Directorios que NO se deben mostrar (sensibles o irrelevantes)
const DIRECTORIOS_IGNORADOS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.turbo',
  '.cache',
  'coverage',
  'dist',
  'build',
  'tool-results',
  'examples',
  'mini-services',
  'skills',
  'upload',
  'db',
  'download',
])

function esArchivoPermitido(nombre: string): boolean {
  if (ARCHIVOS_PERMITIDOS.includes(nombre)) return true
  const ext = path.extname(nombre).toLowerCase()
  return EXTENSIONES_PERMITIDAS.includes(ext)
}

function esDirectorioIgnorado(nombre: string): boolean {
  return DIRECTORIOS_IGNORADOS.has(nombre)
}

interface ArchivoInfo {
  nombre: string
  ruta: string // ruta relativa al proyecto
  esDirectorio: boolean
  tamano?: number
  modificado?: string
  extension?: string
}

// GET - listar directorio (sin ruta) o leer archivo (con ruta)
export async function GET(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede navegar el código fuente (puede exponer .env y secretos)
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const { searchParams } = new URL(req.url)
    const rutaRelativa = searchParams.get('ruta') || ''

    // Si no hay ruta, listar raíz del proyecto
    const rutaAbsoluta = path.join(PROJECT_ROOT, rutaRelativa)

    // Validar que la ruta esté dentro del proyecto (evitar path traversal)
    const rutaNormalizada = path.normalize(rutaAbsoluta)
    if (!rutaNormalizada.startsWith(PROJECT_ROOT)) {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado: ruta fuera del proyecto' },
        { status: 403 }
      )
    }

    // Verificar que existe
    if (!fs.existsSync(rutaNormalizada)) {
      return NextResponse.json(
        { success: false, error: `No existe: ${rutaRelativa || 'raíz'}` },
        { status: 404 }
      )
    }

    const stats = fs.statSync(rutaNormalizada)

    // Si es directorio, listar contenido
    if (stats.isDirectory()) {
      const items = fs.readdirSync(rutaNormalizada)
      const archivos: ArchivoInfo[] = items
        .filter((nombre) => !esDirectorioIgnorado(nombre))
        .map((nombre) => {
          const rutaItem = path.join(rutaNormalizada, nombre)
          const stat = fs.statSync(rutaItem)
          const esDir = stat.isDirectory()
          return {
            nombre,
            ruta: path.relative(PROJECT_ROOT, rutaItem),
            esDirectorio: esDir,
            tamano: esDir ? undefined : stat.size,
            modificado: stat.mtime.toISOString(),
            extension: esDir ? undefined : path.extname(nombre).toLowerCase().slice(1),
          }
        })
        .sort((a, b) => {
          // Directorios primero, luego alfabético
          if (a.esDirectorio && !b.esDirectorio) return -1
          if (!a.esDirectorio && b.esDirectorio) return 1
          return a.nombre.localeCompare(b.nombre)
        })

      return NextResponse.json({
        success: true,
        tipo: 'directorio',
        ruta: rutaRelativa || '/',
        archivos,
      })
    }

    // Si es archivo, leer contenido
    if (stats.isFile()) {
      // Validar extensión
      if (!esArchivoPermitido(path.basename(rutaNormalizada))) {
        return NextResponse.json(
          {
            success: false,
            error: `Tipo de archivo no permitido. Extensiones válidas: ${EXTENSIONES_PERMITIDAS.join(', ')}`,
          },
          { status: 403 }
        )
      }

      const contenido = fs.readFileSync(rutaNormalizada, 'utf8')
      const lineas = contenido.split('\n').length

      return NextResponse.json({
        success: true,
        tipo: 'archivo',
        ruta: rutaRelativa,
        nombre: path.basename(rutaNormalizada),
        extension: path.extname(rutaNormalizada).toLowerCase().slice(1),
        contenido,
        lineas,
        tamano: stats.size,
        modificado: stats.mtime.toISOString(),
      })
    }

    return NextResponse.json(
      { success: false, error: 'Tipo de ruta no soportado' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
