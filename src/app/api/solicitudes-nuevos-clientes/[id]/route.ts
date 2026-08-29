// =====================================================
// /api/solicitudes-nuevos-clientes/[id] — Operaciones por ID
// GET: ver solicitud completa CON fotos (GESTOR+)
// PATCH: cambiar estado (aprobar/rechazar/convertir/devolver/revisar)
//       accion='convertir' → crea Cliente + clave temporal + Categoria opcional
//       accion='devolver' → marca DEVUELTA, guarda motivo, notifica al cliente
//       v4.13: ahora genera una clave temporal alfanumérica (10 chars), la
//       hashea con bcrypt, marca debeCambiarClave=true, y la envía al correo
//       del cliente si tiene email.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
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

// v4.13 — Generar clave temporal alfanumérica robusta (10 chars)
function generarClaveTemporal(longitud: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*'
  const bytes = crypto.randomBytes(longitud)
  let clave = ''
  for (let i = 0; i < longitud; i++) {
    clave += chars[bytes[i] % chars.length]
  }
  return clave
}

// Escapa caracteres HTML para prevenir XSS en el cuerpo del email
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// === PATCH — Cambiar estado / convertir ===
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const body = await req.json()
    const { accion, observaciones, motivoDevolucion, categoriaId, cuentaRecaudoId } = body
    const clientInfo = getClientInfo(req)

    const solicitud = await db.solicitudNuevoCliente.findUnique({ where: { id } })
    if (!solicitud) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })

    let nuevoEstado = solicitud.estado
    let mensaje = ''
    let clienteCreado: { id: string; cedula: string; pin?: string; claveTemporal?: string; emailEnviado?: boolean } | null = null

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
      // === DEVOLVER AL CLIENTE PARA CORRECCIÓN ===
      const motivo = (motivoDevolucion || observaciones || '').trim()
      if (!motivo) {
        return NextResponse.json(
          { success: false, error: 'El motivo de devolución es obligatorio' },
          { status: 400 }
        )
      }
      if (motivo.length > 2000) {
        return NextResponse.json(
          { success: false, error: 'El motivo no puede exceder 2000 caracteres' },
          { status: 400 }
        )
      }
      nuevoEstado = 'DEVUELTA'
      mensaje = 'Solicitud devuelta al cliente para corrección'

      // Actualizar solicitud con estado, motivo, fecha y contador
      const actualizada = await db.solicitudNuevoCliente.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          motivoDevolucion: motivo,
          fechaDevolucion: new Date(),
          vecesDevuelta: (solicitud.vecesDevuelta || 0) + 1,
          observaciones: observaciones || solicitud.observaciones,
          revisadoPorId: auth.id,
          revisadoPorNombre: auth.nombre,
          fechaRevision: new Date(),
        },
      })

      // Enviar email al cliente si tiene correo
      let emailEnviadoDevolucion = false
      if (solicitud.email) {
        const nombreCompleto = `${solicitud.nombre} ${solicitud.apellido}`.trim()
        const urlRegistro = `${process.env.NEXT_PUBLIC_APP_URL || 'https://jsadr.com.co'}/register?cedula=${encodeURIComponent(solicitud.cedula)}&corregir=1`
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">Tu solicitud requiere correcciones</h1>
              <p style="color: #fef3c7; margin: 6px 0 0; font-size: 13px;">JSADR — Registro de cliente</p>
            </div>
            <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #111827; font-size: 15px;">
                Hola <strong>${escapeHtml(nombreCompleto)}</strong>,
              </p>
              <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
                Revisamos tu solicitud de registro <strong>${solicitud.codigo}</strong> y necesitamos que
                realices algunas correcciones antes de poder aprobarla.
              </p>
              <div style="padding: 14px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: 600;">Motivo de la devolución:</p>
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(motivo)}</p>
              </div>
              <p style="margin: 16px 0 8px; color: #374151; font-size: 14px;">
                Para corregir y reenviar tu solicitud, ingresa al siguiente enlace y usa tu cédula:
              </p>
              <p style="margin: 0 0 16px;">
                <a href="${urlRegistro}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  Corregir mi solicitud
                </a>
              </p>
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 12px; line-height: 1.5;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                <span style="color: #4f46e5; word-break: break-all;">${urlRegistro}</span>
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Este es un mensaje automático. No respondas a este correo.<br/>
                © ${new Date().getFullYear()} JSADR — Sistema de Solicitudes
              </p>
            </div>
          </div>
        `
        const text = `Hola ${nombreCompleto},\n\nTu solicitud ${solicitud.codigo} fue devuelta para corrección.\n\nMotivo: ${motivo}\n\nPara corregir, ingresa a: ${urlRegistro}\n\nSaludos,\nJSADR`
        try {
          const resultado = await enviarEmail({
            to: solicitud.email,
            subject: `[JSADR] Tu solicitud ${solicitud.codigo} requiere correcciones`,
            text,
            html,
          })
          emailEnviadoDevolucion = resultado.success
          if (!resultado.success) {
            console.warn('[solicitudes PATCH devolver] Email no enviado:', resultado.error)
          }
        } catch (e) {
          console.error('[solicitudes PATCH devolver] Error enviando email:', e)
        }
      }

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'SOLICITUD_DEVUELTA',
        modulo: 'solicitudes-nuevos-clientes',
        entidadId: id,
        entidadNombre: `${solicitud.nombre} ${solicitud.apellido} - ${solicitud.codigo}`,
        detalles: `Motivo: ${motivo}${solicitud.email ? ` | Email enviado: ${emailEnviadoDevolucion ? 'sí' : 'no'}` : ' | Sin email'}`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })

      return NextResponse.json({
        success: true,
        data: actualizada,
        mensaje: solicitud.email
          ? (emailEnviadoDevolucion
              ? 'Solicitud devuelta. Se envió un correo al cliente con las instrucciones.'
              : 'Solicitud devuelta. No se pudo enviar el correo al cliente (comunícale el motivo por WhatsApp o llamada).')
          : 'Solicitud devuelta. El cliente no tiene email registrado (comunícale el motivo por WhatsApp o llamada).',
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

      // v4.13 — Generar clave temporal alfanumérica robusta (reemplaza al PIN de 4 dígitos)
      const claveTemporalPlana = generarClaveTemporal(10)
      const claveHash = await hashPassword(claveTemporalPlana)
      const ahora = new Date()
      const claveTempToken = crypto.randomBytes(32).toString('hex')
      const claveTempExpira = new Date(ahora.getTime() + 24 * 60 * 60 * 1000) // 24h

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
          // Datos bancarios (copiados de la solicitud — obligatorios desde v4.15)
          bancoCliente: solicitud.banco || null,
          tipoCuentaCliente: solicitud.tipoCuenta || null,
          numeroCuentaCliente: solicitud.numeroCuenta || null,
          // v4.13: usar clave alfanumérica + flag de cambio obligatorio
          claveHash,
          claveCreatedAt: ahora,
          claveIntentos: 0,
          claveBloqueadoHasta: null,
          debeCambiarClave: true,
          claveTempToken,
          claveTempExpira,
          categoriaId: catId || undefined,
          cuentaRecaudoId: cueId || undefined,
          activo: true,
        },
        select: { id: true, cedula: true, nombre: true, email: true },
      })

      // v4.13 — Enviar clave temporal al correo del cliente (si tiene email)
      let emailEnviado = false
      if (cliente.email) {
        const nombreCompleto = `${solicitud.nombre} ${solicitud.apellido}`.trim()
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">Bienvenido a JSADR</h1>
              <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">Portal del Cliente</p>
            </div>
            <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #111827; font-size: 15px;">
                Hola <strong>${escapeHtml(nombreCompleto)}</strong>,
              </p>
              <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
                Tu cuenta ha sido creada exitosamente. Para ingresar al Portal del Cliente
                por primera vez, utiliza las siguientes credenciales temporales:
              </p>
              <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 12px; background: #f3f4f6; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 35%;">Usuario (cédula):</td>
                  <td style="padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: bold;">${escapeHtml(solicitud.cedula)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; background: #f3f4f6; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Clave temporal:</td>
                  <td style="padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb; font-size: 16px; color: #dc2626; font-weight: bold; font-family: monospace; letter-spacing: 1px;">${escapeHtml(claveTemporalPlana)}</td>
                </tr>
              </table>
              <div style="padding: 12px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">⚠️ Importante</p>
                <p style="margin: 6px 0 0; color: #78350f; font-size: 12px; line-height: 1.5;">
                  Por seguridad, deberás cambiar esta clave en tu primer inicio de sesión.
                  La clave temporal expira en 24 horas.
                </p>
              </div>
              <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                Ingresa al portal con tu cédula y esta clave. El sistema te pedirá
                inmediatamente que definas una nueva clave personal antes de continuar.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Este es un mensaje automático. No respondas a este correo.<br/>
                © ${new Date().getFullYear()} JSADR — Sistema de Solicitudes
              </p>
            </div>
          </div>
        `
        const text = `Bienvenido a JSADR\n\nHola ${nombreCompleto},\n\nTu cuenta ha sido creada. Ingresa al Portal del Cliente con:\n\nUsuario (cédula): ${solicitud.cedula}\nClave temporal: ${claveTemporalPlana}\n\nPor seguridad, deberás cambiar esta clave en tu primer inicio de sesión. La clave temporal expira en 24 horas.\n\nSaludos,\nJSADR`
        try {
          const resultado = await enviarEmail({
            to: cliente.email,
            subject: 'Bienvenido a JSADR — Tu clave de acceso al Portal',
            text,
            html,
          })
          emailEnviado = resultado.success
          if (!resultado.success) {
            console.warn('[solicitudes PATCH] Email no enviado:', resultado.error)
          }
        } catch (e) {
          console.error('[solicitudes PATCH] Error enviando email de bienvenida:', e)
        }
      }

      // Subir las 3 fotos como DocumentoGestor asociados al cliente
      // FIX 2026-08-12 (Task 6): Usamos tipos distintos (FOTO_DOCUMENTO vs
      // FOTO_DOCUMENTO_REVERSO) para poder distinguir el frente y el reverso
      // de la cédula en el detalle del cliente. Antes ambos se guardaban con
      // tipo='FOTO_DOCUMENTO' y se diferenciaban solo por el titulo.
      const docsBase: { tipo: string; titulo: string; b64: string; nombre: string }[] = [
        { tipo: 'FOTO_DOCUMENTO', titulo: 'Cédula frente', b64: solicitud.fotoCedulaFrente || '', nombre: solicitud.fotoCedulaFrenteNombre || 'cedula-frente.jpg' },
        { tipo: 'FOTO_DOCUMENTO_REVERSO', titulo: 'Cédula reverso', b64: solicitud.fotoCedulaReverso || '', nombre: solicitud.fotoCedulaReversoNombre || 'cedula-reverso.jpg' },
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
      mensaje = emailEnviado
        ? `Cliente creado: ${cliente.nombre} (CC ${cliente.cedula}). Se envió la clave temporal al correo ${cliente.email}. El cliente debe cambiarla en su primer ingreso.`
        : `Cliente creado: ${cliente.nombre} (CC ${cliente.cedula}). Clave temporal: ${claveTemporalPlana}. Comunícala al cliente (no se pudo enviar por correo).`
      clienteCreado = {
        id: cliente.id,
        cedula: cliente.cedula,
        // Si el email se envió correctamente, NO se devuelve la clave en la respuesta
        // (ya está en el buzón del cliente). Si no, se devuelve para que el gestor la comunique.
        claveTemporal: emailEnviado ? undefined : claveTemporalPlana,
        emailEnviado,
      }

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
