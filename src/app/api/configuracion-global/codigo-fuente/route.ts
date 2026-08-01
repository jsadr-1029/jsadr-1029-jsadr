import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const execAsync = promisify(exec)

// =====================================================
// GET /api/configuracion-global/codigo-fuente
// =====================================================
// Retorna metadata del ZIP del código fuente del proyecto:
//   - tamaño, fecha de generación, hash, número de archivos
//   - link de descarga
// Query: ?accion=info  → retorna metadata (default)
//        ?accion=descargar → redirige al ZIP para descargar
//        ?accion=regenerar → regenera el ZIP con los últimos cambios
// =====================================================

const ZIP_PATH = '/home/z/my-project/download/jsadr-proyecto.zip'
const PROJECT_DIR = '/home/z/my-project'
const ZIP_RELATIVE = 'jsadr-proyecto.zip'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`codigo-fuente:${clientInfo.ip}`, 10)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion') || 'info'

    // === MODO DESCARGAR ===
    if (accion === 'descargar') {
      // Asegurarse de que el ZIP existe (regenerar si no)
      if (!fs.existsSync(ZIP_PATH)) {
        await generarZip()
      }
      // Retornar el archivo como descarga
      const buffer = fs.readFileSync(ZIP_PATH)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': buffer.length.toString(),
          'Content-Disposition': `attachment; filename="${ZIP_RELATIVE}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    // === MODO REGENERAR ===
    if (accion === 'regenerar') {
      const resultado = await generarZip()

      // Audit log
      await db.auditLog.create({
        data: {
          usuarioNombre: authResult.nombre,
          accion: 'CODIGO_FUENTE_REGENERADO',
          modulo: 'configuracion-global',
          entidadNombre: 'ZIP código fuente',
          detalles: JSON.stringify({
            tamaño: resultado.tamano,
            archivos: resultado.archivos,
            hash: resultado.hash,
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        },
      })

      return NextResponse.json({
        success: true,
        data: resultado,
        mensaje: `ZIP regenerado correctamente. ${resultado.archivos} archivos, ${formatearTamano(resultado.tamano)}.`,
      })
    }

    // === MODO INFO (default) ===
    // Si no existe, generar primero
    if (!fs.existsSync(ZIP_PATH)) {
      await generarZip()
    }

    const stats = fs.statSync(ZIP_PATH)
    const hash = await calcularHash(ZIP_PATH)
    const numArchivos = await contarArchivosZip(ZIP_PATH)

    // Detectar última modificación del código fuente (excluyendo carpetas grandes)
    const ultimaModificacionCodigo = await obtenerUltimaModificacionCodigo()

    // Verificar si el ZIP está desactualizado respecto al código
    const zipDesactualizado = stats.mtime < ultimaModificacionCodigo

    return NextResponse.json({
      success: true,
      data: {
        existeZip: true,
        ruta: ZIP_PATH,
        nombreArchivo: ZIP_RELATIVE,
        tamano: stats.size,
        tamanoFormateado: formatearTamano(stats.size),
        archivos: numArchivos,
        hash,
        fechaGeneracion: stats.mtime.toISOString(),
        ultimaModificacionCodigo: ultimaModificacionCodigo.toISOString(),
        zipDesactualizado,
        urlDescarga: '/api/configuracion-global/codigo-fuente?accion=descargar',
      },
    })
  } catch (error: any) {
    console.error('[codigo-fuente GET] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// Funciones auxiliares
// =====================================================

async function generarZip(): Promise<{
  tamano: number
  archivos: number
  hash: string
  fechaGeneracion: string
}> {
  // Asegurar que la carpeta download existe
  const downloadDir = path.dirname(ZIP_PATH)
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true })
  }

  // Eliminar ZIP anterior si existe
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH)
  }

  // Comando para crear el ZIP excluyendo carpetas pesadas y archivos sensibles
  // Lista de exclusiones: node_modules, .next, .git, db, download, upload, snapshots, etc.
  const exclusiones = [
    'node_modules',
    '.next',
    '.git',
    'db',
    'download',
    'upload',
    'snapshots',
    'tool-results',
    'agent-ctx',
    '*.log',
    'dev.log',
    'server.log',
    '.env',
    '.env.local',
    '.DS_Store',
  ]
    .map((e) => `-x "${e}/*" "${e}"`)
    .join(' ')

  const cmd = `cd ${PROJECT_DIR} && zip -r ${ZIP_PATH} . ${exclusiones} -q`
  await execAsync(cmd)

  const stats = fs.statSync(ZIP_PATH)
  const hash = await calcularHash(ZIP_PATH)
  const archivos = await contarArchivosZip(ZIP_PATH)

  return {
    tamano: stats.size,
    archivos,
    hash,
    fechaGeneracion: stats.mtime.toISOString(),
  }
}

async function calcularHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex').substring(0, 32)))
    stream.on('error', reject)
  })
}

async function contarArchivosZip(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`unzip -l ${filePath} | tail -1`)
    const match = stdout.match(/\s+(\d+)\s+files?/)
    return match ? parseInt(match[1], 10) : 0
  } catch {
    return 0
  }
}

async function obtenerUltimaModificacionCodigo(): Promise<Date> {
  try {
    // Buscar el archivo más reciente en src/, prisma/, public/, scripts/
    const { stdout } = await execAsync(
      `find ${PROJECT_DIR}/src ${PROJECT_DIR}/prisma ${PROJECT_DIR}/public ${PROJECT_DIR}/scripts ${PROJECT_DIR}/package.json ${PROJECT_DIR}/tsconfig.json ${PROJECT_DIR}/next.config.ts -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -printf '%T@ %p\\n' 2>/dev/null | sort -rn | head -1`
    )
    const match = stdout.match(/^([\d.]+)/)
    if (match) {
      return new Date(parseFloat(match[1]) * 1000)
    }
  } catch {
    // ignorar
  }
  return new Date()
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
