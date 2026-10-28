// =====================================================
// /api/snapshots/[id] — Operaciones por ID
// GET: obtener detalles
// PATCH: restaurar snapshot
// DELETE: eliminar snapshot
// POST (con accion): comparar, importar, duplicar
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { restaurarSnapshot, compararSnapshots, leerResumen, crearSnapshot, generarUUID } from '@/lib/snapshot-manager'
import fs from 'fs'
import path from 'path'

// === GET — Detalles del snapshot ===
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const snapshot = await db.snapshotProyecto.findUnique({ where: { id } })
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Snapshot no encontrado' }, { status: 404 })
    }

    // Leer resumen del archivo
    const rutaFisica = path.join(process.cwd(), snapshot.rutaArchivo)
    let resumen: any = null
    try {
      resumen = leerResumen(rutaFisica)
    } catch (e) {
      // archivo no existe
    }

    return NextResponse.json({ success: true, data: snapshot, resumen })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// === PATCH — Restaurar snapshot ===
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await req.json()
    const { accion } = body

    const clientInfo = getClientInfo(req)

    if (accion === 'restaurar') {
      const snapshot = await db.snapshotProyecto.findUnique({ where: { id } })
      if (!snapshot) {
        return NextResponse.json({ success: false, error: 'Snapshot no encontrado' }, { status: 404 })
      }

      // Crear snapshot automático antes de restaurar (punto de seguridad)
      const uuidAuto = generarUUID()
      try {
        crearSnapshot({
          uuid: uuidAuto,
          version: `${snapshot.version}-pre-restore`,
          nombre: `Auto-snapshot antes de restaurar ${snapshot.version}`,
          descripcion: 'Snapshot automático generado antes de restaurar',
          usuarioId: auth.id,
          usuarioNombre: auth.nombre,
          motivo: 'AUTO_PRE_RESTORE',
        })

        // Guardar auto-snapshot en BD
        const autoRuta = path.join(process.cwd(), 'download', 'snapshots', `snapshot_${uuidAuto}.json`)
        const autoStats = fs.statSync(autoRuta)
        const autoChecksum = require('crypto').createHash('sha256').update(fs.readFileSync(autoRuta)).digest('hex')

        await db.snapshotProyecto.create({
          data: {
            uuid: uuidAuto,
            version: `${snapshot.version}-pre-restore`,
            nombre: `Auto-snapshot antes de restaurar ${snapshot.version}`,
            descripcion: 'Snapshot automático generado antes de restaurar',
            estado: 'COMPLETADO',
            tamano: autoStats.size,
            rutaArchivo: path.relative(process.cwd(), autoRuta),
            checksum: autoChecksum,
            archivosTotal: 0,
            tipo: 'AUTO_PRE_CAMBIO',
            usuarioId: auth.id,
            usuarioNombre: auth.nombre,
            motivo: 'AUTO_PRE_RESTORE',
          },
        })
      } catch (e) {
        console.error('[snapshots] Error creando auto-snapshot pre-restore:', e)
      }

      // Restaurar
      const rutaFisica = path.join(process.cwd(), snapshot.rutaArchivo)
      const resultado = restaurarSnapshot(rutaFisica)

      // Actualizar estado
      await db.snapshotProyecto.update({
        where: { id },
        data: { estado: 'RESTAURADO' },
      })

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'SNAPSHOT_RESTAURADO',
        modulo: 'snapshots',
        entidadId: id,
        entidadNombre: `${snapshot.version} - ${snapshot.nombre}`,
        detalles: `Restaurado: ${resultado.archivosRestaurados} archivos. Módulos: ${resultado.modulosAfectados.join(', ')}. Errores: ${resultado.errores.length}`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })

      return NextResponse.json({
        success: true,
        mensaje: `Snapshot restaurado: ${resultado.archivosRestaurados} archivos recuperados`,
        data: resultado,
      })
    }

    if (accion === 'duplicar') {
      const snapshot = await db.snapshotProyecto.findUnique({ where: { id } })
      if (!snapshot) {
        return NextResponse.json({ success: false, error: 'Snapshot no encontrado' }, { status: 404 })
      }

      // Leer snapshot original
      const rutaOriginal = path.join(process.cwd(), snapshot.rutaArchivo)
      const contenido = fs.readFileSync(rutaOriginal, 'utf-8')
      const data = JSON.parse(contenido)

      // Crear copia con nuevo UUID
      const nuevoUuid = generarUUID()
      const nuevaVersion = `${snapshot.version}-copy`
      data.uuid = nuevoUuid
      data.version = nuevaVersion
      data.nombre = `${snapshot.nombre} (copia)`
      data.timestamp = new Date().toISOString()

      const nuevaRuta = path.join(process.cwd(), 'download', 'snapshots', `snapshot_${nuevoUuid}.json`)
      fs.writeFileSync(nuevaRuta, JSON.stringify(data, null, 2), 'utf-8')
      const nuevoStats = fs.statSync(nuevaRuta)
      const nuevoChecksum = require('crypto').createHash('sha256').update(fs.readFileSync(nuevaRuta)).digest('hex')

      const nuevoSnapshot = await db.snapshotProyecto.create({
        data: {
          uuid: nuevoUuid,
          version: nuevaVersion,
          nombre: `${snapshot.nombre} (copia)`,
          descripcion: snapshot.descripcion,
          estado: 'COMPLETADO',
          tamano: nuevoStats.size,
          rutaArchivo: path.relative(process.cwd(), nuevaRuta),
          checksum: nuevoChecksum,
          archivosTotal: snapshot.archivosTotal,
          modulosAfectados: snapshot.modulosAfectados,
          tipo: 'MANUAL',
          usuarioId: auth.id,
          usuarioNombre: auth.nombre,
          motivo: 'DUPLICADO',
        },
      })

      return NextResponse.json({
        success: true,
        data: nuevoSnapshot,
        mensaje: `Snapshot duplicado como ${nuevaVersion}`,
      })
    }

    if (accion === 'comparar') {
      const { compararCon } = body
      if (!compararCon) {
        return NextResponse.json({ success: false, error: 'Se requiere compararCon (ID del otro snapshot)' }, { status: 400 })
      }

      const snapA = await db.snapshotProyecto.findUnique({ where: { id } })
      const snapB = await db.snapshotProyecto.findUnique({ where: { id: compararCon } })
      if (!snapA || !snapB) {
        return NextResponse.json({ success: false, error: 'Snapshot no encontrado' }, { status: 404 })
      }

      const rutaA = path.join(process.cwd(), snapA.rutaArchivo)
      const rutaB = path.join(process.cwd(), snapB.rutaArchivo)
      const resultado = compararSnapshots(rutaA, rutaB)

      return NextResponse.json({ success: true, data: resultado })
    }

    if (accion === 'importar') {
      const { contenido } = body // JSON string del snapshot importado
      if (!contenido) {
        return NextResponse.json({ success: false, error: 'Contenido del snapshot requerido' }, { status: 400 })
      }

      // Parsear y validar
      let data
      try {
        data = JSON.parse(contenido)
      } catch {
        return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
      }

      // Validar estructura mínima
      if (!data.uuid || !data.version || !data.files || !data.metadata) {
        return NextResponse.json({ success: false, error: 'Estructura de snapshot inválida' }, { status: 400 })
      }

      // Verificar compatibilidad (acepta tanto "Jsadr" como "Jo*** Se*** Al*** D** R**" para snapshots antiguos)
      if (!data.proyecto || (data.proyecto !== 'Jsadr' && data.proyecto !== 'Jo*** Se*** Al*** D** R**')) {
        return NextResponse.json({ success: false, error: 'Snapshot no compatible con este proyecto' }, { status: 400 })
      }

      // Guardar archivo
      const nuevoUuid = data.uuid + '-imported'
      const nuevaRuta = path.join(process.cwd(), 'download', 'snapshots', `snapshot_${nuevoUuid}.json`)
      fs.writeFileSync(nuevaRuta, JSON.stringify(data, null, 2), 'utf-8')
      const stats = fs.statSync(nuevaRuta)
      const checksum = require('crypto').createHash('sha256').update(fs.readFileSync(nuevaRuta)).digest('hex')

      const nuevoSnapshot = await db.snapshotProyecto.create({
        data: {
          uuid: nuevoUuid,
          version: `${data.version}-imported`,
          nombre: data.nombre + ' (importado)',
          descripcion: data.descripcion || 'Snapshot importado',
          estado: 'COMPLETADO',
          tamano: stats.size,
          rutaArchivo: path.relative(process.cwd(), nuevaRuta),
          checksum,
          archivosTotal: data.metadata.totalFiles || 0,
          modulosAfectados: JSON.stringify(data.metadata.modulos || []),
          tipo: 'MANUAL',
          usuarioId: auth.id,
          usuarioNombre: auth.nombre,
          motivo: 'IMPORTADO',
        },
      })

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'SNAPSHOT_IMPORTADO',
        modulo: 'snapshots',
        entidadId: nuevoSnapshot.id,
        entidadNombre: nuevoSnapshot.version,
        detalles: `Snapshot importado: ${data.metadata.totalFiles} archivos`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })

      return NextResponse.json({
        success: true,
        data: nuevoSnapshot,
        mensaje: `Snapshot importado: ${data.metadata.totalFiles} archivos`,
      })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// === DELETE — Eliminar snapshot (ADMIN) ===
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const snapshot = await db.snapshotProyecto.findUnique({ where: { id } })
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Snapshot no encontrado' }, { status: 404 })
    }

    // Eliminar archivo físico
    const rutaFisica = path.join(process.cwd(), snapshot.rutaArchivo)
    if (fs.existsSync(rutaFisica)) {
      fs.unlinkSync(rutaFisica)
    }

    // Eliminar de BD
    await db.snapshotProyecto.delete({ where: { id } })

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'SNAPSHOT_ELIMINADO',
      modulo: 'snapshots',
      entidadId: id,
      entidadNombre: snapshot.version,
      detalles: `Snapshot ${snapshot.uuid} v${snapshot.version} eliminado`,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, mensaje: `Snapshot ${snapshot.version} eliminado` })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
