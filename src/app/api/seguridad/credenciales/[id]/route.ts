import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'
import { generarOTP } from '@/lib/finanzas'
import crypto from 'crypto'

// =====================================================
// GET /api/seguridad/credenciales/[id]
// Obtiene el detalle completo de un cliente + historial de OTPs
// (consolidado: OtpRegistro + OtpChat + FirmaElectronica)
// =====================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`credenciales-detalle:${clientInfo.ip}`, 30)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { id } = await params
    const cliente = await db.cliente.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        email: true,
        activo: true,
        claveHash: true,
        claveCreatedAt: true,
        claveIntentos: true,
        claveBloqueadoHasta: true,
        claveResetToken: true,
        claveResetExpira: true,
        pinHash: true,
        pinCreatedAt: true,
        pinIntentos: true,
        pinBloqueadoHasta: true,
        ultimoAccesoPortal: true,
        tokenSesion: true,
        tokenExpira: true,
        createdAt: true,
      },
    })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Obtener OTPs consolidados
    const [otpsRegistro, otpsChat, firmasOtp] = await Promise.all([
      db.otpRegistro.findMany({
        where: { clienteId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.otpChat.findMany({
        where: { clienteId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.firmaElectronica.findMany({
        where: { clienteId: id, otpEnviado: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          otpCanal: true,
          otpFechaEnvio: true,
          otpFechaValidacion: true,
          otpValidado: true,
          intentosOTP: true,
          estadoFirma: true,
          tipo: true,
          esFirmaCodeudor: true,
          firmanteRol: true,
          firmanteNombre: true,
          createdAt: true,
        },
      }),
    ])

    // Unificar OTPs en una sola lista
    const otpsUnificadas: any[] = []
    otpsRegistro.forEach((o) =>
      otpsUnificadas.push({
        id: o.id,
        fuente: 'OTP_REGISTRO',
        tipo: o.tipo,
        metodo: o.metodo,
        destinatario: o.destinatario,
        descripcion: o.descripcion,
        verificado: o.verificado,
        usado: o.usado,
        bloqueado: o.bloqueado,
        intentos: o.intentos,
        maxIntentos: o.maxIntentos,
        expiraEn: o.expiraEn,
        ipSolicitud: o.ipSolicitud,
        userAgent: o.userAgent,
        fechaVerificacion: o.fechaVerificacion,
        createdAt: o.createdAt,
        codigoPlano: o.codigoPlano, // sólo si existe (desarrollo)
      })
    )
    otpsChat.forEach((o) =>
      otpsUnificadas.push({
        id: o.id,
        fuente: 'OTP_CHAT',
        tipo: 'CHAT',
        metodo: o.metodo,
        destinatario: o.destinatario,
        descripcion: 'OTP para verificación de conversación de chat',
        verificado: o.verificado,
        usado: o.usado,
        bloqueado: o.bloqueado,
        intentos: o.intentos,
        maxIntentos: o.maxIntentos,
        expiraEn: o.expiraEn,
        ipSolicitud: o.ipSolicitud,
        userAgent: o.userAgent,
        fechaVerificacion: o.fechaVerificacion,
        createdAt: o.createdAt,
      })
    )
    firmasOtp.forEach((f) =>
      otpsUnificadas.push({
        id: f.id,
        fuente: 'FIRMA_ELECTRONICA',
        tipo: 'FIRMA_ELECTRONICA',
        metodo: f.otpCanal || 'N/A',
        destinatario: 'N/A',
        descripcion: `Firma ${f.tipo}${f.esFirmaCodeudor ? ' (codeudor)' : ''} - ${f.firmanteNombre || ''} - estado: ${f.estadoFirma}`,
        verificado: f.otpValidado,
        usado: f.otpValidado,
        bloqueado: false,
        intentos: f.intentosOTP,
        maxIntentos: 5,
        expiraEn: null,
        ipSolicitud: null,
        userAgent: null,
        fechaVerificacion: f.otpFechaValidacion,
        createdAt: f.createdAt,
      })
    )
    // Ordenar todas por createdAt desc
    otpsUnificadas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const ahora = new Date()
    return NextResponse.json({
      success: true,
      data: {
        id: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        email: cliente.email,
        activo: cliente.activo,
        tieneClave: !!cliente.claveHash,
        claveCreatedAt: cliente.claveCreatedAt,
        claveIntentos: cliente.claveIntentos,
        claveBloqueada: cliente.claveBloqueadoHasta ? cliente.claveBloqueadoHasta > ahora : false,
        claveBloqueadoHasta: cliente.claveBloqueadoHasta,
        tienePin: !!cliente.pinHash,
        pinCreatedAt: cliente.pinCreatedAt,
        pinIntentos: cliente.pinIntentos,
        pinBloqueado: cliente.pinBloqueadoHasta ? cliente.pinBloqueadoHasta > ahora : false,
        pinBloqueadoHasta: cliente.pinBloqueadoHasta,
        ultimoAccesoPortal: cliente.ultimoAccesoPortal,
        tieneSesionActiva: cliente.tokenExpira ? cliente.tokenExpira > ahora : false,
        tokenExpira: cliente.tokenExpira,
        createdAt: cliente.createdAt,
        otps: otpsUnificadas,
        otpsResumen: {
          total: otpsUnificadas.length,
          verificados: otpsUnificadas.filter((o) => o.verificado).length,
          pendientes: otpsUnificadas.filter((o) => !o.verificado && !o.bloqueado && new Date(o.expiraEn || 0) > ahora).length,
          bloqueados: otpsUnificadas.filter((o) => o.bloqueado).length,
        },
      },
    })
  } catch (error: any) {
    console.error('[credenciales/[id] GET] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// PATCH /api/seguridad/credenciales/[id]
// Acciones sobre un cliente específico:
//   { accion: 'desbloquear' }      → desbloquea la clave (limpia intentos y bloqueo)
//   { accion: 'desbloquear_pin' }  → desbloquea el PIN
//   { accion: 'revocar_sesion' }   → cierra la sesión activa del portal
//   { accion: 'generar_otp', metodo, destinatario, descripcion } → genera un OTP manual
//   { accion: 'eliminar_clave' }   → elimina la clave (cliente debe volver a crearla)
// =====================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`credenciales-patch:${clientInfo.ip}`, 15)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const { accion, metodo, destinatario, descripcion } = body || {}

    if (!accion || typeof accion !== 'string') {
      return NextResponse.json(
        { success: false, error: 'accion es requerida' },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.findUnique({ where: { id } })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    const ahora = new Date()
    let mensajeRespuesta = ''
    let auditAccion = ''
    let auditDetalles: any = { clienteId: id, clienteCedula: cliente.cedula }

    if (accion === 'desbloquear') {
      await db.cliente.update({
        where: { id },
        data: {
          claveIntentos: 0,
          claveBloqueadoHasta: null,
        },
      })
      mensajeRespuesta = `Clave del cliente ${cliente.nombre} desbloqueada. Los intentos se reiniciaron a 0.`
      auditAccion = 'CLAVE_CLIENTE_DESBLOQUEADA'
      auditDetalles.tipo = 'clave'
    } else if (accion === 'desbloquear_pin') {
      await db.cliente.update({
        where: { id },
        data: {
          pinIntentos: 0,
          pinBloqueadoHasta: null,
        },
      })
      mensajeRespuesta = `PIN del cliente ${cliente.nombre} desbloqueado. Los intentos se reiniciaron a 0.`
      auditAccion = 'PIN_CLIENTE_DESBLOQUEADO'
      auditDetalles.tipo = 'pin'
    } else if (accion === 'revocar_sesion') {
      await db.cliente.update({
        where: { id },
        data: {
          tokenSesion: null,
          tokenExpira: null,
        },
      })
      mensajeRespuesta = `Sesión del portal del cliente ${cliente.nombre} revocada. Deberá iniciar sesión de nuevo.`
      auditAccion = 'SESION_CLIENTE_REVOCADA'
    } else if (accion === 'eliminar_clave') {
      await db.cliente.update({
        where: { id },
        data: {
          claveHash: null,
          claveCreatedAt: null,
          claveIntentos: 0,
          claveBloqueadoHasta: null,
        },
      })
      mensajeRespuesta = `Clave del cliente ${cliente.nombre} eliminada. El cliente deberá crear una nueva clave.`
      auditAccion = 'CLAVE_CLIENTE_ELIMINADA'
    } else if (accion === 'generar_otp') {
      // Validar método y destinatario
      if (!['WHATSAPP', 'EMAIL', 'AMBOS', 'SMS'].includes(metodo)) {
        return NextResponse.json(
          { success: false, error: 'metodo debe ser WHATSAPP | EMAIL | AMBOS | SMS' },
          { status: 400 }
        )
      }
      if (!destinatario || typeof destinatario !== 'string') {
        return NextResponse.json(
          { success: false, error: 'destinatario es requerido (número de teléfono o email)' },
          { status: 400 }
        )
      }
      // Generar OTP de 6 dígitos
      const codigoPlano = generarOTP()
      const codigoHash = crypto.createHash('sha256').update(codigoPlano).digest('hex')
      const expiraEn = new Date(ahora.getTime() + 5 * 60 * 1000) // 5 minutos

      const otp = await db.otpRegistro.create({
        data: {
          clienteId: id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          codigoHash,
          codigoPlano, // sólo en desarrollo/auditoría interna
          metodo,
          destinatario,
          tipo: 'OTRO',
          descripcion: descripcion || `OTP generado manualmente por ${user.nombre}`,
          maxIntentos: 3,
          expiraEn,
          ipSolicitud: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        },
      })
      mensajeRespuesta = `OTP generado para ${cliente.nombre}. Código: ${codigoPlano}. Expira en 5 minutos.`
      auditAccion = 'OTP_CLIENTE_GENERADO'
      auditDetalles.metodo = metodo
      auditDetalles.destinatario = destinatario
      auditDetalles.otpId = otp.id
      auditDetalles.expiraEn = expiraEn.toISOString()
      // No guardamos el código en el audit log por seguridad
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Acción no válida: ${accion}. Acciones válidas: desbloquear, desbloquear_pin, revocar_sesion, eliminar_clave, generar_otp`,
        },
        { status: 400 }
      )
    }

    // Registrar audit log
    await db.auditLog.create({
      data: {
        usuarioId: user.id === 'system' ? null : user.id,
        usuarioNombre: user.nombre,
        accion: auditAccion,
        modulo: 'seguridad',
        entidadId: id,
        entidadNombre: `${cliente.nombre} - ${cliente.cedula}`,
        detalles: JSON.stringify(auditDetalles),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      },
    })

    return NextResponse.json({
      success: true,
      mensaje: mensajeRespuesta,
    })
  } catch (error: any) {
    console.error('[credenciales/[id] PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
