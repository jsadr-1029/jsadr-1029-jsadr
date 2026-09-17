// =====================================================
// /api/solicitudes-nuevos-clientes/[id] — Operaciones por ID
// GET: ver solicitud completa CON fotos (GESTOR+)
// PATCH: cambiar estado (aprobar/rechazar/convertir)
//       accion='convertir' → crea Cliente + PIN aleatorio + Categoria opcional
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog, hashPassword } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { generateToken } from '@/lib/format'
import bcrypt from 'bcryptjs'

// === GET — Detalle completo (CON fotos) ===
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const solicitud = await db.solicitudNuevoCliente.findUnique({ where: { id } })
    if (!solicitud) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, data: solicitud })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// Generar PIN numérico aleatorio de 4 dígitos
function generarPinAleatorio(): string {
  const n = Math.floor(1000 + Math.random() * 9000)
  return String(n)
}

// === PATCH — Cambiar estado / convertir ===
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const body = await req.json()
    const { accion, observaciones, categoriaId, cuentaRecaudoId } = body
    const clientInfo = getClientInfo(req)

    const solicitud = await db.solicitudNuevoCliente.findUnique({ where: { id } })
    if (!solicitud) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })

    let nuevoEstado = solicitud.estado
    let mensaje = ''
    let clienteCreado: { id: string; cedula: string; pin: string } | null = null

    if (accion === 'aprobar') {
      nuevoEstado = 'APROBADA'
      mensaje = 'Solicitud aprobada (pendiente de convertir a cliente)'
    } else if (accion === 'rechazar') {
      nuevoEstado = 'RECHAZADA'
      mensaje = 'Solicitud rechazada'
    } else if (accion === 'revisar') {
      nuevoEstado = 'REVISADA'
      mensaje = 'Solicitud marcada como revisada'
    } else if (accion === 'convertir') {
      // === CONVERTIR EN CLIENTE ===
      // Validar que no exista ya un cliente con la misma cédula
      const clienteExistente = await db.cliente.findFirst({
        where: { cedula: solicitud.cedula },
        select: { id: true, nombre: true },
      })
      if (clienteExistente) {
        return NextResponse.json(
          { success: false, error: `Ya existe un cliente con cédula ${solicitud.cedula}: ${clienteExistente.nombre}` },
          { status: 400 }
        )
      }

      // Resolver categoría: parámetro explícito > heredar de la solicitud > ninguna
      let catId: string | null = categoriaId || null
      let cueId: string | null = cuentaRecaudoId || null

      if (catId) {
        const cat = await db.categoriaCliente.findUnique({ where: { id: catId }, select: { id: true, cuentaRecaudoId: true } })
        if (!cat) {
          return NextResponse.json({ success: false, error: 'La categoría seleccionada no existe' }, { status: 400 })
        }
        // Si la categoría tiene cuenta de recaudo y no se pasó una explícita, heredarla
        if (!cueId && cat.cuentaRecaudoId) cueId = cat.cuentaRecaudoId
      }

      if (cueId) {
        const cue = await db.cuentaRecaudo.findUnique({ where: { id: cueId }, select: { id: true } })
        if (!cue) {
          return NextResponse.json({ success: false, error: 'La cuenta de recaudo seleccionada no existe' }, { status: 400 })
        }
      }

      // Generar PIN inicial de 4 dígitos
      const pinPlano = generarPinAleatorio()
      const pinHash = await bcrypt.hash(pinPlano, 12)

      // Crear el cliente
      const cliente = await db.cliente.create({
        data: {
          nombre: `${solicitud.nombre} ${solicitud.apellido}`.trim(),
          cedula: solicitud.cedula,
          telefono: solicitud.telefono,
          email: solicitud.email || null,
          ciudad: solicitud.ciudad || null,
          municipio: solicitud.municipio || null,
          direccion: solicitud.direccion || null,
          pinHash,
          pinCreatedAt: new Date(),
          categoriaId: catId || undefined,
          cuentaRecaudoId: cueId || undefined,
          activo: true,
        },
        select: { id: true, cedula: true, nombre: true },
      })

      // Subir las 3 fotos como DocumentoGestor asociados al cliente
      const docsBase: { tipo: string; titulo: string; b64: string; nombre: string }[] = [
        { tipo: 'FOTO_DOCUMENTO', titulo: 'Cédula frente', b64: solicitud.fotoCedulaFrente || '', nombre: solicitud.fotoCedulaFrenteNombre || 'cedula-frente.jpg' },
        { tipo: 'FOTO_DOCUMENTO', titulo: 'Cédula reverso', b64: solicitud.fotoCedulaReverso || '', nombre: solicitud.fotoCedulaReversoNombre || 'cedula-reverso.jpg' },
        { tipo: 'FOTO_SELFI', titulo: 'Selfie con cédula', b64: solicitud.fotoSelfie || '', nombre: solicitud.fotoSelfieNombre || 'selfie.jpg' },
      ]
      for (const d of docsBase) {
        if (!d.b64) continue
        try {
          await db.documentoGestor.create({
            data: {
              clienteId: cliente.id,
              tipo: d.tipo,
              titulo: d.titulo,
              descripcion: `Cargada desde solicitud ${solicitud.codigo}`,
              archivoBase64: d.b64,
              archivoNombre: d.nombre,
              archivoTipo: d.b64.startsWith('data:image/png') ? 'image/png' : d.b64.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
              archivoTamano: Math.round(d.b64.length * 0.75),
              subidoPor: auth.nombre,
            },
          })
        } catch (e) {
          console.error('Error guardando documento', d.titulo, e)
        }
      }

      nuevoEstado = 'CONVERTIDA'
      mensaje = `Cliente creado: ${cliente.nombre} (CC ${cliente.cedula}). PIN inicial: ${pinPlano}`
      clienteCreado = { id: cliente.id, cedula: cliente.cedula, pin: pinPlano }

      // Actualizar la solicitud con el id del cliente creado + código de revisión
      const actualizada = await db.solicitudNuevoCliente.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          observaciones: observaciones || solicitud.observaciones,
          revisadoPorId: auth.id,
          revisadoPorNombre: auth.nombre,
          fechaRevision: new Date(),
          clienteCreadoId: cliente.id,
          clienteCreadoCodigo: cliente.cedula,
        },
      })

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'CLIENTE_CREADO_DESDE_SOLICITUD',
        modulo: 'solicitudes-nuevos-clientes',
        entidadId: cliente.id,
        entidadNombre: `${cliente.nombre} - CC ${cliente.cedula}`,
        detalles: `Convertido desde solicitud ${solicitud.codigo}. PIN generado.`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })

      return NextResponse.json({
        success: true,
        data: actualizada,
        clienteCreado,
        mensaje,
      })
    } else {
      return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
    }

    // Para acciones que no son 'convertir'
    const actualizada = await db.solicitudNuevoCliente.update({
      where: { id },
      data: {
        estado: nuevoEstado,
        observaciones: observaciones || solicitud.observaciones,
        revisadoPorId: auth.id,
        revisadoPorNombre: auth.nombre,
        fechaRevision: new Date(),
      },
    })

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'SOLICITUD_NUEVO_CLIENTE',
      modulo: 'solicitudes-nuevos-clientes',
      entidadId: id,
      entidadNombre: `${solicitud.nombre} ${solicitud.apellido} - ${solicitud.codigo}`,
      detalles: mensaje,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, data: actualizada, mensaje })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
