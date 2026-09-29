// =====================================================
// /api/solicitudes-nuevos-clientes/[id] — Operaciones por ID
// GET: ver solicitud completa CON fotos (GESTOR+)
// PATCH: cambiar estado (aprobar/rechazar/convertir/devolver)
//       accion='convertir' → crea Cliente + PIN aleatorio + Categoria opcional
//       accion='devolver'  → marca como DEVUELTA, genera token de corrección,
//                            envía email al cliente con link /corregir-solicitud/[token]
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog, hashPassword } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { generateToken } from '@/lib/format'
import { enviarEmail } from '@/lib/email'
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
    } else if (accion === 'devolver') {
      // === DEVOLVER SOLICITUD AL CLIENTE PARA CORRECCIÓN ===
      // Marca como DEVUELTA, genera token de corrección (72h),
      // envía email al cliente con link /corregir-solicitud/[token]
      const motivo = (body.motivoDevolucion || '').trim()
      const detalle = (body.detalleDevolucion || '').trim()
      const fotosARecargar: string[] = Array.isArray(body.fotosARecargar)
        ? body.fotosARecargar
        : []

      if (!motivo) {
        return NextResponse.json(
          { success: false, error: 'El motivo de devolución es obligatorio' },
          { status: 400 }
        )
      }
      if (!solicitud.email) {
        return NextResponse.json(
          { success: false, error: 'La solicitud no tiene email asociado para notificar al cliente' },
          { status: 400 }
        )
      }

      const tokenCorreccion = generateToken(40)
      const tokenExpira = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 horas

      const actualizada = await db.solicitudNuevoCliente.update({
        where: { id },
        data: {
          estado: 'DEVUELTA',
          motivoDevolucion: motivo,
          detalleDevolucion: detalle || null,
          fotosARecargar: fotosARecargar.length > 0 ? JSON.stringify(fotosARecargar) : null,
          vecesDevuelta: (solicitud.vecesDevuelta || 0) + 1,
          fechaDevolucion: new Date(),
          devueltoPorId: auth.id,
          devueltoPorNombre: auth.nombre,
          tokenCorreccion,
          tokenCorreccionExpira: tokenExpira,
          // Limpiar correcciones previas si las hubiera
          fotoCedulaFrenteCorregida: null,
          fotoCedulaReversoCorregida: null,
          fotoSelfieCorregida: null,
          fotoCedulaFrenteCorregidaNombre: null,
          fotoCedulaReversoCorregidaNombre: null,
          fotoSelfieCorregidaNombre: null,
          fechaCorreccion: null,
        },
      })

      // === Enviar email al cliente ===
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jsadr.com.co'
      const linkCorreccion = `${baseUrl}/corregir-solicitud/${tokenCorreccion}`

      const fotosTexto =
        fotosARecargar.length > 0
          ? `\n\nDocumentos que debes volver a cargar:\n${fotosARecargar
              .map((f) => {
                if (f === 'CEDULA_FRENTE') return '• Cédula (foto frontal)'
                if (f === 'CEDULA_REVERSO') return '• Cédula (foto reverso)'
                if (f === 'SELFIE') return '• Selfie sosteniendo la cédula'
                return `• ${f}`
              })
              .join('\n')}`
          : '\n\nPor favor revisa todos los documentos cargados.'

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f4f6fb;">
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(15,23,42,0.08);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #5b5bf7, #8b5bf7); color: white; padding: 8px 16px; border-radius: 12px; font-weight: bold; letter-spacing: -0.5px;">JSADR</div>
              <h1 style="color: #0b1220; font-size: 22px; margin: 16px 0 8px;">Tu solicitud necesita correcciones</h1>
              <p style="color: #5b6478; font-size: 14px; margin: 0;">Solicitud ${solicitud.codigo}</p>
            </div>

            <p style="color: #0b1220; font-size: 15px; line-height: 1.6;">Hola <strong>${solicitud.nombre}</strong>,</p>

            <p style="color: #5b6478; font-size: 14px; line-height: 1.6;">Gracias por tu interés en un crédito con JSADR. Hemos revisado tu solicitud y necesitamos que corrijas algunos documentos antes de continuar con el estudio.</p>

            <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #92400e; font-size: 12px; font-weight: 600; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Motivo de la devolución</p>
              <p style="color: #0b1220; font-size: 14px; margin: 0; line-height: 1.5;">${motivo}</p>
              ${detalle ? `<p style="color: #5b6478; font-size: 13px; margin: 8px 0 0; line-height: 1.5;">${detalle}</p>` : ''}
            </div>

            <p style="color: #0b1220; font-size: 14px; line-height: 1.6;">${fotosARecargar.length > 0 ? 'Debes volver a cargar los siguientes documentos:' : 'Por favor ingresa al enlace y revisa los documentos cargados.'}${fotosARecargar.map((f) => {
              if (f === 'CEDULA_FRENTE') return '<br>• Cédula (foto frontal)'
              if (f === 'CEDULA_REVERSO') return '<br>• Cédula (foto reverso)'
              if (f === 'SELFIE') return '<br>• Selfie sosteniendo la cédula'
              return `<br>• ${f}`
            }).join('')}</p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${linkCorreccion}" style="display: inline-block; background: linear-gradient(135deg, #5b5bf7, #8b5bf7); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">Corregir mi solicitud</a>
            </div>

            <p style="color: #8b94a8; font-size: 12px; text-align: center; margin: 16px 0 0;">El enlace expira en 72 horas.</p>

            <hr style="border: 0; border-top: 1px solid #e5e9f2; margin: 24px 0;">

            <p style="color: #8b94a8; font-size: 12px; line-height: 1.6;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${linkCorreccion}" style="color: #5b5bf7; word-break: break-all;">${linkCorreccion}</a>
            </p>

            <p style="color: #8b94a8; font-size: 12px; text-align: center; margin-top: 24px;">
              © JSADR Microfinanzas · Este es un mensaje automático, no respondas a este correo.
            </p>
          </div>
        </div>
      `

      const textoPlano = `Hola ${solicitud.nombre},

Tu solicitud ${solicitud.codigo} fue revisada y necesita correcciones.

Motivo: ${motivo}
${detalle ? `Detalle: ${detalle}` : ''}

${fotosARecargar.length > 0 ? 'Documentos a recargar:\n' + fotosARecargar.map((f) => {
  if (f === 'CEDULA_FRENTE') return '- Cédula (foto frontal)'
  if (f === 'CEDULA_REVERSO') return '- Cédula (foto reverso)'
  if (f === 'SELFIE') return '- Selfie sosteniendo la cédula'
  return `- ${f}`
}).join('\n') : ''}

Para corregir tu solicitud, ingresa al siguiente enlace (expira en 72 horas):
${linkCorreccion}

Saludos,
JSADR Microfinanzas
`

      try {
        await enviarEmail({
          to: solicitud.email,
          subject: `Tu solicitud ${solicitud.codigo} necesita correcciones — JSADR`,
          html,
          text: textoPlano,
        })
      } catch (emailErr: any) {
        console.error('[devolver solicitud] error enviando email:', emailErr?.message)
        // No fallar todo el flujo si el email falla — el token queda en BD
      }

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'SOLICITUD_DEVUELTA',
        modulo: 'solicitudes-nuevos-clientes',
        entidadId: id,
        entidadNombre: `${solicitud.nombre} ${solicitud.apellido} - ${solicitud.codigo}`,
        detalles: `Devolvida. Motivo: ${motivo}. Fotos a recargar: ${fotosARecargar.join(', ') || 'todas'}. Email enviado a ${solicitud.email}.`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })

      return NextResponse.json({
        success: true,
        data: actualizada,
        mensaje: `Solicitud devuelta. Se envió email a ${solicitud.email} con el link de corrección.`,
        linkCorreccion,
        tokenCorreccion,
      })
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
