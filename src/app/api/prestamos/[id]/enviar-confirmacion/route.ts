import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, generarTokenTyC, formatearMoneda, formatearFecha, getTasaMoraAnual } from '@/lib/finanzas'
import { enviarWhatsApp, guardarNotificacion, mensajeAprobacionTyC } from '@/lib/whatsapp'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { enviarEmail } from '@/lib/email'
import { generarYEnviarCodigosConfirmacion } from '@/lib/prestamo-codigo'
import crypto from 'crypto'

// POST - enviar confirmación por el método elegido
// metodo: 'LINK' | 'CORREO' | 'WHATSAPP_API'
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { metodo } = body // LINK | CORREO | WHATSAPP_API

    if (!metodo || !['LINK', 'CORREO', 'WHATSAPP_API'].includes(metodo)) {
      return NextResponse.json(
        { success: false, error: 'Método inválido. Debe ser: LINK, CORREO o WHATSAPP_API' },
        { status: 400 }
      )
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id },
      include: { cliente: true },
    })

    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
    }

    if (prestamo.estado !== 'SOLICITUD' && prestamo.estado !== 'PENDIENTE_ACEPTACION') {
      return NextResponse.json(
        { success: false, error: `El préstamo está en estado ${prestamo.estado}. Solo se puede enviar confirmación a préstamos en SOLICITUD o PENDIENTE_ACEPTACION.` },
        { status: 400 }
      )
    }

    // Guardar el método elegido
    await db.prestamo.update({
      where: { id },
      data: {
        metodoConfirmacion: metodo,
        estado: 'PENDIENTE_ACEPTACION',
        fechaAprobacion: new Date(),
        tycEnviado: true,
      },
    })

    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: new Date(),
    })

    // ============================================================
    // MÉTODO 1: LINK (Portal del Cliente - aceptación con 1 clic)
    // ============================================================
    if (metodo === 'LINK') {
      const tycToken = generarTokenTyC()
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const linkAceptacion = `${baseUrl}/?tyc=${tycToken}`

      await db.prestamo.update({
        where: { id },
        data: { tycToken },
      })

      const mensaje = mensajeAprobacionTyC({
        nombreCliente: prestamo.cliente.nombre,
        codigoPrestamo: prestamo.codigo,
        monto: prestamo.montoPrincipal,
        cuota: calculo.montoCuota,
        numeroCuotas: calculo.numeroCuotas,
        tasaAnual: prestamo.tasaInteresAnual,
        totalPagar: calculo.totalPagar,
        linkAceptacion,
      })

      const envioWhatsApp = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
      await guardarNotificacion({
        db, prestamoId: id, telefono: prestamo.cliente.telefono,
        tipo: 'TYC', mensaje, envio: envioWhatsApp,
      })

      await registrarAuditLog({
        usuarioNombre: 'Gestor', accion: 'CONFIRMACION_LINK_ENVIADA',
        modulo: 'prestamos', entidadId: id, entidadNombre: prestamo.codigo,
        detalles: JSON.stringify({ metodo: 'LINK', link: linkAceptacion }),
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        data: {
          metodo: 'LINK',
          linkAceptacion,
          linkWaMe: envioWhatsApp.linkWaMe,
        },
        whatsapp: envioWhatsApp,
        mensaje: 'Link de aceptación enviado por WhatsApp. El cliente debe abrirlo y hacer clic en "Acepto Términos y Condiciones".',
      })
    }

    // ============================================================
    // MÉTODO 2: CORREO (Código de confirmación de 6 caracteres)
    //
    // Delega en el helper compartido `generarYEnviarCodigosConfirmacion`
    // para garantizar que se aplique la REGLA DE NEGOCIO de doble OTP
    // cuando el préstamo tenga codeudor. Antes este método generaba
    // un solo código para el deudor, lo que permitía activar préstamos
    // con codeudor sin que este confirmara.
    // ============================================================
    if (metodo === 'CORREO') {
      const result = await generarYEnviarCodigosConfirmacion({ prestamoId: id, req })
      return NextResponse.json(result.body, { status: result.status })
    }

    // ============================================================
    // MÉTODO 3: WHATSAPP_API (Botón interactivo en WhatsApp)
    // ============================================================
    if (metodo === 'WHATSAPP_API') {
      // Verificar si hay una conexión de WhatsApp Business activa
      const conexion = await db.conexionAPI.findFirst({
        where: { tipo: 'WHATSAPP_BUSINESS', activa: true },
      })

      if (!conexion) {
        return NextResponse.json({
          success: false,
          error: 'No hay una conexión de WhatsApp Business API activa. Configúrala en Conexiones API, o usa el método LINK o CORREO.',
        }, { status: 400 })
      }

      const tycToken = generarTokenTyC()
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const linkAceptacion = `${baseUrl}/?tyc=${tycToken}`

      await db.prestamo.update({
        where: { id },
        data: { tycToken },
      })

      // Intentar enviar mensaje interactivo con botón via WhatsApp Business API
      let apiResult = null
      let mensajeEnviado = false

      if (conexion.url && conexion.apiKey) {
        try {
          const res = await fetch(`${conexion.url}/v17.0/${conexion.accountId || 'me'}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${conexion.apiKey}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: prestamo.cliente.telefono,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: {
                  text: `✅ *PRÉSTAMO APROBADO*\n\nHola *${prestamo.cliente.nombre}*, tu préstamo ${prestamo.codigo} fue aprobado.\n\n📋 *Detalles:*\n• Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}\n• Cuota: $${calculo.montoCuota.toLocaleString('es-CO')}\n• N° cuotas: ${calculo.numeroCuotas}\n• Total: $${calculo.totalPagar.toLocaleString('es-CO')}\n\nPara activar tu préstamo, acepta los términos y condiciones:`,
                },
                action: {
                  buttons: [
                    {
                      type: 'reply',
                      reply: {
                        id: `aceptar_tyc_${tycToken}`,
                        title: '✅ Acepto T&C',
                      },
                    },
                    {
                      type: 'reply',
                      reply: {
                        id: `rechazar_tyc_${tycToken}`,
                        title: '❌ Rechazar',
                      },
                    },
                  ],
                },
              },
            }),
            signal: AbortSignal.timeout(15000),
          })

          if (res.ok) {
            apiResult = await res.json()
            mensajeEnviado = true
          } else {
            const errData = await res.text()
            // Si la API falla, caer al método de link normal
          }
        } catch (e) {
          // Si la API falla, caer al método de link normal
        }
      }

      // Si la API real no está disponible, usar link wa.me como fallback
      const mensajeFallback = mensajeAprobacionTyC({
        nombreCliente: prestamo.cliente.nombre,
        codigoPrestamo: prestamo.codigo,
        monto: prestamo.montoPrincipal,
        cuota: calculo.montoCuota,
        numeroCuotas: calculo.numeroCuotas,
        tasaAnual: prestamo.tasaInteresAnual,
        totalPagar: calculo.totalPagar,
        linkAceptacion,
      })

      const envioWhatsApp = await enviarWhatsApp(prestamo.cliente.telefono, mensajeFallback)
      await guardarNotificacion({
        db, prestamoId: id, telefono: prestamo.cliente.telefono,
        tipo: 'TYC', mensaje: mensajeFallback, envio: envioWhatsApp,
      })

      await registrarAuditLog({
        usuarioNombre: 'Gestor', accion: 'CONFIRMACION_WHATSAPP_API_ENVIADA',
        modulo: 'prestamos', entidadId: id, entidadNombre: prestamo.codigo,
        detalles: JSON.stringify({
          metodo: 'WHATSAPP_API',
          apiReal: mensajeEnviado,
          linkAceptacion,
        }),
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        data: {
          metodo: 'WHATSAPP_API',
          apiReal: mensajeEnviado,
          apiResult,
          linkAceptacion,
          linkWaMe: envioWhatsApp.linkWaMe,
          conexionUsada: conexion.nombre,
        },
        whatsapp: envioWhatsApp,
        mensaje: mensajeEnviado
          ? 'Mensaje interactivo con botones enviado vía WhatsApp Business API. El cliente verá botones "✅ Acepto T&C" y "❌ Rechazar".'
          : 'La API de WhatsApp Business no respondió. Se envió link de respaldo por WhatsApp. Configura correctamente la conexión en Conexiones API para usar botones interactivos.',
      })
    }

    return NextResponse.json({ success: false, error: 'Método no implementado' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
