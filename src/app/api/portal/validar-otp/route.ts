import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verificarOtp, incrementarIntentoOtp, obtenerIp, obtenerUserAgent } from '@/lib/otp'

// POST /api/portal/validar-otp
// Valida el OTP ingresado por el cliente y marca la firma como completada.
//
// Fixes aplicados:
//  - db.firma → db.firmaElectronica
//  - db.bitacora → db.bitacoraPrestamo (con campos correctos)
//  - estadoFirma 'FIRMADO' (inválido) → 'COMPLETADA' (válido del enum)
//  - Comparación con verificarOtp (constant-time + SHA-256)
//  - El OTP en BD está hasheado, así que se compara hash vs hash
//  - Si el cliente tiene firmaElectronica con otpRegistroId, también actualiza OtpRegistro
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firmaId, otp } = body

    if (!firmaId || !otp) {
      return NextResponse.json({ error: 'firmaId y otp son requeridos' }, { status: 400 })
    }

    const firma = await db.firmaElectronica.findUnique({
      where: { id: firmaId },
      include: { prestamo: { include: { cliente: true } } },
    })
    if (!firma) {
      return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    }
    if (firma.otpValidado) {
      return NextResponse.json({ error: 'OTP ya validado' }, { status: 400 })
    }
    if (!firma.otpCodigo) {
      return NextResponse.json({ error: 'No hay OTP pendiente. Solicita uno nuevo.' }, { status: 400 })
    }

    // === v4.6 (QA M03 TC-PRE-011): verificar expiración del OTP ===
    // El OTP expira a los 5 minutos (definido en solicitar-otp).
    // Si otpFechaEnvio + 5 min < ahora → rechazar con 400 (no 401, no 500).
    // Previene que un OTP interceptado se use indefinidamente.
    const OTP_TTL_MIN = 5
    if (firma.otpFechaEnvio) {
      const expiraEn = new Date(firma.otpFechaEnvio.getTime() + OTP_TTL_MIN * 60 * 1000)
      if (new Date() > expiraEn) {
        // Marcar la firma como EXPIRADA y limpiar el OTP
        await db.firmaElectronica.update({
          where: { id: firmaId },
          data: {
            estadoFirma: 'EXPIRADA',
            otpCodigo: null,
          },
        })
        return NextResponse.json(
          {
            error: 'OTP expirado. Solicita un nuevo código para continuar.',
            codigo: 'OTP_EXPIRADO',
          },
          { status: 400 }
        )
      }
    }

    const ip = obtenerIp(req)
    const ua = obtenerUserAgent(req)
    const cliente = firma.prestamo?.cliente

    // Comparación constant-time contra el hash almacenado
    const otpValido = verificarOtp(String(otp), firma.otpCodigo)

    if (!otpValido) {
      const nuevosIntentos = firma.intentosOTP + 1
      const bloqueado = nuevosIntentos >= firma.maxIntentos
      await db.firmaElectronica.update({
        where: { id: firmaId },
        data: {
          intentosOTP: nuevosIntentos,
          estadoFirma: bloqueado ? 'RECHAZADA' : 'OTP_ENVIADO',
        },
      })

      if (cliente) {
        await db.accesoPortal.create({
          data: {
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            ipOrigen: ip,
            userAgent: ua,
            accion: 'OTP_VALIDADO',
            exito: false,
            detalle: `OTP incorrecto. Intento ${nuevosIntentos}/${firma.maxIntentos}`,
          },
        })
      }

      // v4.6 (QA M03 TC-PRE-012): si se exceden los intentos, retornar 429 (Too Many Requests)
      // en lugar de 401, como espera el estándar y el plan de pruebas.
      if (bloqueado) {
        return NextResponse.json(
          {
            error: 'Máximo de intentos alcanzado. Firma bloqueada por seguridad.',
            codigo: 'OTP_BLOQUEADO',
            bloqueado: true,
          },
          { status: 429 }
        )
      }

      return NextResponse.json({
        error: `OTP incorrecto. Intentos restantes: ${Math.max(0, firma.maxIntentos - nuevosIntentos)}`,
        bloqueado,
      }, { status: 401 })
    }

    // OTP válido — completar firma
    await db.firmaElectronica.update({
      where: { id: firmaId },
      data: {
        otpValidado: true,
        otpFechaValidacion: new Date(),
        estadoFirma: 'COMPLETADA',
        fechaFirmaCompleta: new Date(),
        ipFirma: ip,
        userAgent: ua,
        // Limpiar el OTP hasheado (ya no se necesita)
        otpCodigo: null,
      },
    })

    // Marcar TyC como aceptado en el préstamo
    if (firma.prestamoId) {
      await db.prestamo.update({
        where: { id: firma.prestamoId },
        data: {
          tycAceptado: true,
          tycFechaAceptacion: new Date(),
        },
      })

      // Bitácora del préstamo (modelo correcto: BitacoraPrestamo)
      await db.bitacoraPrestamo.create({
        data: {
          prestamoId: firma.prestamoId,
          prestamoCodigo: firma.prestamo?.codigo || '',
          usuarioNombre: `Cliente (Portal): ${cliente?.nombre || 'N/A'}`,
          tipo: 'OTRO',
          titulo: 'TyC firmados por OTP',
          descripcion: `Cliente ${cliente?.nombre || 'N/A'} firmó TyC con OTP por canal ${firma.otpCanal || 'desconocido'}. Firma ID: ${firma.id}.`,
          resultado: 'Firma válida',
          fechaEvento: new Date(),
        },
      })
    }

    if (cliente) {
      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: ip,
          userAgent: ua,
          accion: 'FIRMA_COMPLETADA',
          exito: true,
          detalle: `OTP validado, firma completada para préstamo ${firma.prestamo?.codigo || 'N/A'}`,
          metadata: firma.prestamoId ? JSON.stringify({ prestamoId: firma.prestamoId }) : null,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      mensaje: 'OTP validado correctamente. TyC firmados.',
      firma: {
        id: firma.id,
        estadoFirma: 'COMPLETADA',
        fechaFirmaCompleta: new Date(),
      },
    })
  } catch (e) {
    console.error('[portal/validar-otp] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
