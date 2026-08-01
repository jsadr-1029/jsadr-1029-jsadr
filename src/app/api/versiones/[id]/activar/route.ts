// =====================================================
// /api/versiones/[id]/activar — Activa una versión v3.0
// POST: activa la versión especificada y desactiva las demás.
// Genera un backup automático antes de activar (PRE_ACTIVACION).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const generarBackup = body.generarBackup !== false // default: true

    const version = await db.versionSistema.findUnique({ where: { id } })
    if (!version) {
      return NextResponse.json(
        { success: false, error: 'Versión no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (version.activa) {
      return NextResponse.json(
        { success: false, error: 'La versión ya está activa', code: 'ALREADY_ACTIVE' },
        { status: 400 }
      )
    }

    let backupId: string | null = null

    // Generar backup automático antes de activar
    if (generarBackup) {
      try {
        backupId = await generarBackupPreActivacion(version.numero, authResult.id)
      } catch (e) {
        logError('generarBackupPreActivacion', e)
        // No abortar la activación si falla el backup
      }
    }

    // Desactivar todas las demás versiones y activar esta
    await db.$transaction([
      db.versionSistema.updateMany({
        where: { activa: true },
        data: { activa: false },
      }),
      db.versionSistema.update({
        where: { id },
        data: {
          activa: true,
          fechaActivacion: new Date(),
          backupId,
          creadorId: authResult.id,
        },
      }),
    ])

    const actualizada = await db.versionSistema.findUnique({ where: { id } })

    return NextResponse.json({
      success: true,
      data: actualizada,
      message: `Versión ${version.numero} activada correctamente${backupId ? ' (backup generado)' : ''}`,
    })
  } catch (error) {
    logError('/api/versiones/[id]/activar POST', error)
    return errorResponse('/api/versiones/[id]/activar POST', error)
  }
}

async function generarBackupPreActivacion(
  versionNumero: string,
  generadorId: string
): Promise<string> {
  // Crear directorio de backups si no existe
  const backupsDir = path.join(process.cwd(), 'download', 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const nombreArchivo = `backup_pre_activacion_v${versionNumero}_${timestamp}.json`
  const rutaCompleta = path.join(backupsDir, nombreArchivo)

  // Exportar datos críticos
  const [clientes, prestamos, pagos, configuracion] = await Promise.all([
    db.cliente.findMany(),
    db.prestamo.findMany(),
    db.pago.findMany(),
    db.configuracion.findMany(),
  ])

  const contenido = JSON.stringify(
    {
      metadata: {
        version: versionNumero,
        fechaGeneracion: new Date().toISOString(),
        tipo: 'PRE_ACTIVACION',
        generadorId,
      },
      clientes,
      prestamos,
      pagos,
      configuracion,
    },
    null,
    2
  )

  fs.writeFileSync(rutaCompleta, contenido, 'utf-8')

  // Calcular tamaño y checksum
  const stats = fs.statSync(rutaCompleta)
  const tamano = stats.size
  const checksum = crypto.createHash('sha256').update(contenido).digest('hex')

  const backup = await db.backup.create({
    data: {
      nombre: `Backup Pre-Activación v${versionNumero}`,
      tipo: 'PRE_ACTIVACION',
      tamano,
      rutaArchivo: `download/backups/${nombreArchivo}`,
      checksum,
      entidadTipo: 'TODOS',
      estado: 'COMPLETADO',
      generadoPor: generadorId,
      metadata: JSON.stringify({
        version: versionNumero,
        counts: {
          clientes: clientes.length,
          prestamos: prestamos.length,
          pagos: pagos.length,
          configuracion: configuracion.length,
        },
      }),
    },
  })

  return backup.id
}
