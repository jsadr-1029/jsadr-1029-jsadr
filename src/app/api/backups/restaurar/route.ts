// =====================================================
// /api/backups/restaurar — Restaurar desde backup v3.0
// POST: restaura desde un backup existente (id) o desde un archivo
//       JSON subido (contenido en body.archivo).
// Solo ADMIN puede restaurar.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => ({}))
    const { id, archivo, sobrescribir = false } = body

    if (!id && !archivo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Se requiere id del backup o archivo (contenido JSON)',
          code: 'MISSING_SOURCE',
        },
        { status: 400 }
      )
    }

    let contenidoStr: string
    let backupRegistro: any = null

    if (id) {
      // Restaurar desde backup existente
      backupRegistro = await db.backup.findUnique({ where: { id } })
      if (!backupRegistro) {
        return NextResponse.json(
          { success: false, error: 'Backup no encontrado', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      // Reforzado: validar path traversal en rutaArchivo
      // Solo permitir archivos dentro del directorio backups/ o db/
      const backupsDir = path.resolve(process.cwd(), 'download/backups')
      const dbDir = path.resolve(process.cwd(), 'db')
      const rutaResuelta = path.resolve(process.cwd(), backupRegistro.rutaArchivo)
      const isAllowedPath = rutaResuelta.startsWith(backupsDir) || rutaResuelta.startsWith(dbDir)
      if (!isAllowedPath) {
        logError('/api/backups/restaurar', new Error(`Path traversal detectado: ${backupRegistro.rutaArchivo}`))
        return NextResponse.json(
          { success: false, error: 'Ruta de backup inválida (fuera de directorios permitidos)', code: 'PATH_TRAVERSAL' },
          { status: 400 }
        )
      }

      if (!fs.existsSync(rutaResuelta)) {
        return NextResponse.json(
          { success: false, error: 'Archivo de backup no existe en el servidor', code: 'FILE_NOT_FOUND' },
          { status: 404 }
        )
      }

      contenidoStr = fs.readFileSync(rutaResuelta, 'utf-8')
    } else {
      // Restaurar desde contenido JSON subido
      contenidoStr = typeof archivo === 'string' ? archivo : JSON.stringify(archivo)
    }

    // Parsear y validar estructura
    let backup: any
    try {
      backup = JSON.parse(contenidoStr)
    } catch {
      return NextResponse.json(
        { success: false, error: 'El archivo de backup tiene JSON inválido', code: 'INVALID_JSON' },
        { status: 400 }
      )
    }

    if (!backup.data || !backup.metadata) {
      return NextResponse.json(
        { success: false, error: 'Estructura de backup inválida', code: 'INVALID_BACKUP' },
        { status: 400 }
      )
    }

    // Validar checksum si existe
    if (backupRegistro?.checksum) {
      const actualChecksum = crypto.createHash('sha256').update(contenidoStr).digest('hex')
      if (actualChecksum !== backupRegistro.checksum) {
        return NextResponse.json(
          { success: false, error: 'El checksum del backup no coincide (archivo corrupto)', code: 'CHECKSUM_MISMATCH' },
          { status: 400 }
        )
      }
    }

    const data = backup.data
    const statsRestauracion: Record<string, number> = {}

    // Restaurar en orden para respetar dependencias
    // 1. Categorías y Cuentas (no dependen de nada)
    if (data.categorias && sobrescribir) {
      if (sobrescribir) await db.categoriaCliente.deleteMany({})
      for (const c of data.categorias) {
        await db.categoriaCliente.upsert({
          where: { id: c.id },
          create: { ...c, cuentaRecaudoId: null },
          update: { ...c, cuentaRecaudoId: null },
        })
      }
      statsRestauracion.categorias = data.categorias.length
    }

    if (data.cuentas && sobrescribir) {
      if (sobrescribir) await db.cuentaRecaudo.deleteMany({})
      for (const c of data.cuentas) {
        await db.cuentaRecaudo.upsert({
          where: { id: c.id },
          create: c,
          update: c,
        })
      }
      statsRestauracion.cuentas = data.cuentas.length
    }

    // 2. Clientes
    if (data.clientes) {
      if (sobrescribir) await db.cliente.deleteMany({})
      for (const c of data.clientes) {
        await db.cliente.upsert({
          where: { id: c.id },
          create: { ...c, referidoPorId: null, categoriaId: null },
          update: { ...c, referidoPorId: null, categoriaId: null },
        })
      }
      statsRestauracion.clientes = data.clientes.length
    }

    // 3. Solicitudes
    if (data.prestamos) {
      if (sobrescribir) await db.prestamo.deleteMany({})
      for (const p of data.prestamos) {
        await db.prestamo.upsert({
          where: { id: p.id },
          create: { ...p, categoriaId: null },
          update: { ...p, categoriaId: null },
        })
      }
      statsRestauracion.prestamos = data.prestamos.length
    }

    // 4. Pagos
    if (data.pagos) {
      if (sobrescribir) await db.pago.deleteMany({})
      for (const p of data.pagos) {
        await db.pago.upsert({
          where: { id: p.id },
          create: { ...p, cuentaRecaudoId: null, reversadoPorId: null },
          update: { ...p, cuentaRecaudoId: null, reversadoPorId: null },
        })
      }
      statsRestauracion.pagos = data.pagos.length
    }

    // 5. Configuración
    if (data.configuracion) {
      if (sobrescribir) await db.configuracion.deleteMany({})
      for (const c of data.configuracion) {
        await db.configuracion.upsert({
          where: { id: c.id, clave: c.clave },
          create: c,
          update: c,
        }).catch(() => {})
      }
      statsRestauracion.configuracion = data.configuracion.length
    }

    // 6. Cajas y movimientos
    if (data.cajas) {
      if (sobrescribir) await db.cajaMenor.deleteMany({})
      for (const c of data.cajas) {
        await db.cajaMenor.upsert({
          where: { id: c.id },
          create: c,
          update: c,
        })
      }
      statsRestauracion.cajas = data.cajas.length
    }

    if (data.movimientosCaja) {
      if (sobrescribir) await db.movimientoCaja.deleteMany({})
      for (const m of data.movimientosCaja) {
        await db.movimientoCaja.upsert({
          where: { id: m.id },
          create: { ...m, usuarioId: null },
          update: { ...m, usuarioId: null },
        })
      }
      statsRestauracion.movimientosCaja = data.movimientosCaja.length
    }

    // Marcar backup como restaurado
    if (backupRegistro) {
      await db.backup.update({
        where: { id: backupRegistro.id },
        data: { estado: 'RESTAURADO', restauradoEn: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Backup restaurado correctamente',
      data: {
        stats: statsRestauracion,
        backupOrigen: backupRegistro
          ? {
              id: backupRegistro.id,
              nombre: backupRegistro.nombre,
              fecha: backupRegistro.createdAt,
            }
          : {
              nombre: 'Archivo subido',
              fecha: backup.metadata?.fechaGeneracion,
            },
      },
    })
  } catch (error) {
    logError('/api/backups/restaurar POST', error)
    return errorResponse('/api/backups/restaurar POST', error)
  }
}
