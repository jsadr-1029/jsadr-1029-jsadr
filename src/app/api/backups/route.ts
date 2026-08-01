// =====================================================
// /api/backups — List / Create / Delete v3.0
// GET    : lista backups
// POST   : crea backup manual
// DELETE : elimina un backup por ID
// Solo ADMIN puede gestionar backups.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const descargar = searchParams.get('descargar')
    const tipo = searchParams.get('tipo')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // === Descarga directa de un backup ===
    if (descargar) {
      const backup = await db.backup.findUnique({ where: { id: descargar } })
      if (!backup) {
        return NextResponse.json(
          { success: false, error: 'Backup no encontrado', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      const rutaFisica = path.join(process.cwd(), backup.rutaArchivo)
      if (!fs.existsSync(rutaFisica)) {
        return NextResponse.json(
          { success: false, error: 'Archivo físico no existe', code: 'FILE_NOT_FOUND' },
          { status: 404 }
        )
      }
      const contenido = fs.readFileSync(rutaFisica)
      const nombreSeguro = backup.nombre.replace(/[^a-zA-Z0-9_-]/g, '_')
      return new NextResponse(contenido, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nombreSeguro}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const where: any = {}
    if (tipo) where.tipo = tipo

    const backups = await db.backup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ success: true, data: backups })
  } catch (error) {
    logError('/api/backups GET', error)
    return errorResponse('/api/backups GET', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => ({}))
    const {
      nombre = `Backup Manual ${new Date().toLocaleString('es-CO')}`,
      entidadTipo = 'TODOS',
      descripcion,
    } = body

    // Crear directorio si no existe
    const backupsDir = path.join(process.cwd(), 'download', 'backups')
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const nombreArchivo = `backup_manual_${timestamp}.json`
    const rutaCompleta = path.join(backupsDir, nombreArchivo)

    // Exportar todos los datos
    const [
      clientes,
      prestamos,
      pagos,
      casosJuridicos,
      cronologia,
      documentos,
      alertas,
      notificaciones,
      configuracion,
      usuarios,
      cajas,
      movimientosCaja,
      categorias,
      cuentas,
      automatizaciones,
      ejecucionesAuto,
      versiones,
      accesosPortal,
      firmas,
      tokensFirma,
      bitacoras,
      auditLogs,
      codigosConfirmacion,
      campañas,
      campañasVistas,
      conexionesAPI,
    ] = await Promise.all([
      db.cliente.findMany(),
      db.prestamo.findMany(),
      db.pago.findMany(),
      db.casoJuridico.findMany(),
      db.cronologiaCaso.findMany(),
      db.documentoLegal.findMany(),
      db.alertaLegal.findMany(),
      db.notificacionLog.findMany(),
      db.configuracion.findMany(),
      db.usuario.findMany({ select: { id: true, nombre: true, email: true, username: true, rol: true, activo: true, permisos: true, createdAt: true } }),
      db.cajaMenor.findMany(),
      db.movimientoCaja.findMany(),
      db.categoriaCliente.findMany(),
      db.cuentaRecaudo.findMany(),
      db.automatizacion.findMany(),
      db.ejecucionAutomatizacion.findMany(),
      db.versionSistema.findMany(),
      db.accesoPortal.findMany(),
      db.firmaElectronica.findMany(),
      db.tokenFirma.findMany(),
      db.bitacoraPrestamo.findMany(),
      db.auditLog.findMany(),
      db.codigoConfirmacion.findMany(),
      db.campaña.findMany(),
      db.campañaVista.findMany(),
      db.conexionAPI.findMany(),
    ])

    const contenido = JSON.stringify(
      {
        metadata: {
          fechaGeneracion: new Date().toISOString(),
          tipo: 'MANUAL',
          entidadTipo,
          generadorId: authResult.id,
          schemaVersion: '3.0',
        },
        counts: {
          clientes: clientes.length,
          prestamos: prestamos.length,
          pagos: pagos.length,
          casosJuridicos: casosJuridicos.length,
          auditLogs: auditLogs.length,
        },
        data: {
          clientes,
          prestamos,
          pagos,
          casosJuridicos,
          cronologia,
          documentos,
          alertas,
          notificaciones,
          configuracion,
          usuarios,
          cajas,
          movimientosCaja,
          categorias,
          cuentas,
          automatizaciones,
          ejecucionesAuto,
          versiones,
          accesosPortal,
          firmas,
          tokensFirma,
          bitacoras,
          auditLogs,
          codigosConfirmacion,
          campañas,
          campañasVistas,
          conexionesAPI,
        },
      },
      null,
      2
    )

    fs.writeFileSync(rutaCompleta, contenido, 'utf-8')

    const stats = fs.statSync(rutaCompleta)
    const tamano = stats.size
    const checksum = crypto.createHash('sha256').update(contenido).digest('hex')

    const backup = await db.backup.create({
      data: {
        nombre,
        tipo: 'MANUAL',
        tamano,
        rutaArchivo: `download/backups/${nombreArchivo}`,
        checksum,
        entidadTipo,
        estado: 'COMPLETADO',
        generadoPor: authResult.id,
        metadata: JSON.stringify({
          descripcion: descripcion || null,
          counts: {
            clientes: clientes.length,
            prestamos: prestamos.length,
            pagos: pagos.length,
          },
        }),
      },
    })

    return NextResponse.json({ success: true, data: backup }, { status: 201 })
  } catch (error) {
    logError('/api/backups POST', error)
    return errorResponse('/api/backups POST', error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido', code: 'MISSING_ID' },
        { status: 400 }
      )
    }

    const backup = await db.backup.findUnique({ where: { id } })
    if (!backup) {
      return NextResponse.json(
        { success: false, error: 'Backup no encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Eliminar archivo físico
    try {
      const rutaFisica = path.join(process.cwd(), backup.rutaArchivo)
      if (fs.existsSync(rutaFisica)) {
        fs.unlinkSync(rutaFisica)
      }
    } catch (e) {
      logError('eliminarArchivoBackup', e)
      // continuar aunque no se pueda eliminar el archivo
    }

    await db.backup.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Backup eliminado correctamente',
    })
  } catch (error) {
    logError('/api/backups DELETE', error)
    return errorResponse('/api/backups DELETE', error)
  }
}
