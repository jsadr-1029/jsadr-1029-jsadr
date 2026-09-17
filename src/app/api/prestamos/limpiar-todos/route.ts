import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// =====================================================
// POST - Borrar TODOS los préstamos y datos relacionados.
//
// ENDPOINT DESTRUCTIVO — Blindaje:
//   1. requireRole ADMIN
//   2. Contraseña leída de env var LIMPIAR_PRESTAMOS_PASSWORD
//      (NO hardcoded en fuente)
//   3. Backup JSON automático en /home/z/my-project/backups/
//      antes de borrar (para recuperación si fue error)
//   4. Ejecución en $transaction para atomicidad
//   5. Audit log con detalles
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { password, motivo } = body

    // Validar password de autorización (desde env var)
    const PASSWORD_AUTORIZACION = process.env.LIMPIAR_PRESTAMOS_PASSWORD
    if (!PASSWORD_AUTORIZACION) {
      return NextResponse.json(
        { success: false, error: 'No se ha configurado LIMPIAR_PRESTAMOS_PASSWORD en .env. Configúralo antes de usar este endpoint.' },
        { status: 500 }
      )
    }
    if (password !== PASSWORD_AUTORIZACION) {
      return NextResponse.json(
        { success: false, error: 'Contraseña de autorización incorrecta' },
        { status: 403 }
      )
    }

    const clientInfo = getClientInfo(req)

    // === 1. Snapshot previo para backup ===
    const [prestamos, pagos, bitacoras, firmas, codigos, casosJuridicos, movimientos] = await Promise.all([
      db.prestamo.findMany({ include: { cliente: { select: { nombre: true, cedula: true, email: true } } } }),
      db.pago.findMany(),
      db.bitacoraPrestamo.findMany(),
      db.firmaElectronica.findMany(),
      db.codigoConfirmacion.findMany(),
      db.casoJuridico.findMany(),
      db.movimientoCaja.findMany({ where: { prestamoId: { not: null } } }),
    ])

    const snapshot = {
      fechaBackup: new Date().toISOString(),
      motivo: motivo || 'No especificado',
      solicitadoPor: auth.username,
      totalPrestamos: prestamos.length,
      totalPagos: pagos.length,
      totalBitacoras: bitacoras.length,
      totalFirmas: firmas.length,
      totalCodigosConfirmacion: codigos.length,
      totalCasosJuridicos: casosJuridicos.length,
      totalMovimientos: movimientos.length,
      prestamos,
      pagos,
      bitacoras,
      firmas,
      codigos,
      casosJuridicos,
      movimientos,
    }

    // Guardar backup en disco
    const backupDir = join(process.cwd(), 'backups')
    try {
      mkdirSync(backupDir, { recursive: true })
    } catch {}
    const backupFile = join(backupDir, `backup-prestamos-${Date.now()}.json`)
    try {
      writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), { encoding: 'utf-8' })
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `No se pudo escribir el backup en ${backupFile}: ${e.message}. Operación abortada por seguridad.` },
        { status: 500 }
      )
    }

    // === 2. Borrado en $transaction (atómico) ===
    // Si cualquier paso falla, se hace rollback y el backup sigue disponible.
    await db.$transaction([
      // 1. Cronología de casos jurídicos
      db.cronologiaCaso.deleteMany(),
      // 2. Casos jurídicos
      db.casoJuridico.deleteMany(),
      // 3. Documentos legales
      db.documentoLegal.deleteMany(),
      // 4. Alertas legales
      db.alertaLegal.deleteMany(),
      // 5. Códigos de confirmación
      db.codigoConfirmacion.deleteMany(),
      // 6. Tokens de firma
      db.tokenFirma.deleteMany(),
      // 7. Firmas electrónicas
      db.firmaElectronica.deleteMany(),
      // 8. Notificaciones
      db.notificacionLog.deleteMany(),
      // 9. Pagos
      db.pago.deleteMany(),
      // 10. Bitácora de préstamos
      db.bitacoraPrestamo.deleteMany(),
      // 11. Movimientos de caja asociados a préstamos
      db.movimientoCaja.deleteMany({ where: { prestamoId: { not: null } } }),
      // 12. Préstamos
      db.prestamo.deleteMany(),
    ])

    // === 3. Audit log ===
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.username,
      accion: 'LIMPIAR_TODOS_PRESTAMOS',
      modulo: 'prestamos',
      entidadNombre: 'TODOS LOS PRÉSTAMOS',
      detalles: JSON.stringify({
        motivo: motivo || 'No especificado',
        backupFile,
        prestamosBorrados: prestamos.length,
        pagosBorrados: pagos.length,
        bitacorasBorradas: bitacoras.length,
        firmasBorradas: firmas.length,
        codigosBorrados: codigos.length,
        casosJuridicosBorrados: casosJuridicos.length,
        movimientosBorrados: movimientos.length,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({
      success: true,
      mensaje: 'Todos los préstamos y datos relacionados han sido borrados. Se generó backup previo.',
      backupFile,
      datosBorrados: {
        prestamos: prestamos.length,
        pagos: pagos.length,
        bitacoras: bitacoras.length,
        firmas: firmas.length,
        codigosConfirmacion: codigos.length,
        casosJuridicos: casosJuridicos.length,
        movimientosCaja: movimientos.length,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
