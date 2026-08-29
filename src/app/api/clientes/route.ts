import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { clienteSchema, validateInput } from '@/lib/validators'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { hashPassword } from '@/lib/security'
import { enviarEmail } from '@/lib/email'

// GET - listar todos los clientes (con referidor incluido)
export async function GET(req: NextRequest) {
  try {
    // v4.9 (QA M06 TC-SEC-002): cualquier rol autenticado puede consultar
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const soloActivos = searchParams.get('activos') === '1'

    const clientes = await db.cliente.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        referidoPor: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            departamento: true,
            municipio: true,
            direccion: true,
            bancoCliente: true,
            tipoCuentaCliente: true,
            numeroCuentaCliente: true,
          },
        },
        cuentaRecaudo: true,
        _count: {
          select: { prestamos: true, referidos: true },
        },
      },
    })
    return NextResponse.json({ success: true, data: clientes })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// POST - crear nuevo cliente
// v4.9 (QA M06 TC-SEC-002): RBAC — solo ADMIN/GESTOR pueden crear clientes.
// ANTES: el POST no tenía requireRole, permitiendo que CONSULTOR (o cualquier
// usuario autenticado) creara clientes. Ahora: requireRole(['ADMIN','GESTOR'])
// rechaza CONSULTOR con HTTP 403 FORBIDDEN.
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()

    // Reforzado: validar con Zod antes de procesar
    const validacion = validateInput(clienteSchema, body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: validacion.error, fieldErrors: validacion.fieldErrors },
        { status: 400 }
      )
    }

    const {
      nombre,
      cedula,
      telefono,
      email,
      departamento,
      municipio,
      salario,
      fechaIngreso,
      direccion,
      ciudad,
      barrio,
      notas,
      bancoCliente,
      tipoCuentaCliente,
      numeroCuentaCliente,
      referidoPorId,
      categoriaId,
      tieneTasaPersonalizada,
      tasaPersonalizada,
      // === Cuenta de recaudo asignada (v3.7) ===
      cuentaRecaudoId,
      instruccionCuentaId,
      instruccionCuentaNota,
      instruccionCuentaExpira,
      // === Preferencia de notificación (v4.4) ===
      preferenciaNotificacion,
    } = body

    if (!nombre || !cedula || !telefono) {
      return NextResponse.json(
        { success: false, error: 'Nombre, cédula y teléfono son obligatorios' },
        { status: 400 }
      )
    }

    // Validar preferenciaNotificacion (si viene)
    const PREF_VALIDAS = ['WHATSAPP', 'EMAIL', 'AMBOS', 'NINGUNO']
    const prefFinal = preferenciaNotificacion && PREF_VALIDAS.includes(preferenciaNotificacion)
      ? preferenciaNotificacion
      : 'WHATSAPP' // default seguro

    // Validar que si la preferencia incluye EMAIL, el cliente tenga email
    if ((prefFinal === 'EMAIL' || prefFinal === 'AMBOS') && !email) {
      return NextResponse.json(
        { success: false, error: 'Si la preferencia de notificación es EMAIL o AMBOS, el correo electrónico es obligatorio.' },
        { status: 400 }
      )
    }

    // Validar cédula única
    const existente = await db.cliente.findUnique({ where: { cedula } })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un cliente con esa cédula' },
        { status: 400 }
      )
    }

    // === v4.5 (QA M02-Clientes TC-CLI-014): email único para prevenir suplantación ===
    // El schema.prisma tiene @unique a nivel BD, pero validamos acá antes para
    // devolver un mensaje claro (409) en vez de un error genérico 500.
    if (email && email.trim() !== '') {
      const emailExistente = await db.cliente.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, nombre: true, cedula: true },
      })
      if (emailExistente) {
        return NextResponse.json(
          {
            success: false,
            error: `El correo "${email}" ya está asignado a otro cliente (${emailExistente.nombre}, cédula ${emailExistente.cedula}). No se permiten emails duplicados para prevenir suplantación.`,
            codigo: 'EMAIL_DUPLICADO',
          },
          { status: 409 }
        )
      }
    }

    // Validar referidor si viene
    if (referidoPorId) {
      const ref = await db.cliente.findUnique({
        where: { id: referidoPorId },
      })
      if (!ref) {
        return NextResponse.json(
          { success: false, error: 'El cliente referidor no existe' },
          { status: 400 }
        )
      }
    }

    // === Sincronizar cuenta de recaudo con la categoría asignada ===
    // Si el usuario no seleccionó una cuenta específica, usar la cuenta de la categoría.
    // Esto garantiza la relación 1:1 entre categoría y cuenta de recaudo del cliente.
    let cuentaRecaudoFinal = cuentaRecaudoId || null
    if (!cuentaRecaudoFinal && categoriaId) {
      const cat = await db.categoriaCliente.findUnique({
        where: { id: categoriaId },
        select: { cuentaRecaudoId: true, nombre: true },
      })
      if (cat && cat.cuentaRecaudoId) {
        cuentaRecaudoFinal = cat.cuentaRecaudoId
      } else if (cat) {
        // Categoría existe pero no tiene cuenta — avisar al admin
        return NextResponse.json(
          {
            success: false,
            error: `La categoría "${cat.nombre}" no tiene una cuenta de recaudo asignada. Configure la categoría antes de crear clientes en ella.`,
            codigo: 'CATEGORIA_SIN_CUENTA',
          },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { success: false, error: 'La categoría indicada no existe.' },
          { status: 400 }
        )
      }
    }

    // =====================================================
    // v4.13 — Clave temporal automática para primer ingreso
    // -----------------------------------------------------
    // El sistema genera una clave temporal robusta (10 chars, alfanumérica
    // + símbolos), la hashea con bcrypt y la persiste en `claveHash`.
    // Se marca `debeCambiarClave=true` para forzar el cambio en el primer
    // login. La clave en plano se envía al correo del cliente (si tiene).
    // Si el cliente no tiene email, la clave se devuelve en la respuesta
    // para que el gestor la comunique por otro canal.
    // =====================================================
    const claveTemporalPlana = generarClaveTemporal(10)
    const claveHash = await hashPassword(claveTemporalPlana)
    const ahora = new Date()
    // Token temporal (no autoriza navegación, sólo cambio de clave en el primer login)
    const claveTempToken = crypto.randomBytes(32).toString('hex')
    const claveTempExpira = new Date(ahora.getTime() + 24 * 60 * 60 * 1000) // 24h

    const cliente = await db.cliente.create({
      data: {
        nombre,
        cedula,
        telefono,
        email: email || null,
        departamento: departamento || null,
        municipio: municipio || null,
        salario: salario ? parseFloat(salario) : null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
        direccion: direccion || null,
        ciudad: ciudad || null,
        barrio: barrio || null,
        notas: notas || null,
        bancoCliente: bancoCliente || null,
        tipoCuentaCliente: tipoCuentaCliente || null,
        numeroCuentaCliente: numeroCuentaCliente || null,
        referidoPorId: referidoPorId || null,
        categoriaId: categoriaId || null,
        tieneTasaPersonalizada: tieneTasaPersonalizada === true,
        tasaPersonalizada:
          tieneTasaPersonalizada && tasaPersonalizada
            ? parseFloat(tasaPersonalizada)
            : null,
        // === Cuenta de recaudo asignada (v3.7) ===
        cuentaRecaudoId: cuentaRecaudoFinal,
        instruccionCuentaId: instruccionCuentaId || null,
        instruccionCuentaNota: instruccionCuentaNota || null,
        instruccionCuentaExpira: instruccionCuentaExpira ? new Date(instruccionCuentaExpira) : null,
        // === Preferencia de notificación (v4.4) ===
        preferenciaNotificacion: prefFinal,
        // === v4.13 — Clave temporal + flag de cambio obligatorio ===
        claveHash,
        claveCreatedAt: ahora,
        claveIntentos: 0,
        claveBloqueadoHasta: null,
        debeCambiarClave: true,
        claveTempToken,
        claveTempExpira,
      },
      include: {
        referidoPor: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            departamento: true,
            municipio: true,
            direccion: true,
            bancoCliente: true,
            tipoCuentaCliente: true,
            numeroCuentaCliente: true,
          },
        },
        cuentaRecaudo: true,
      },
    })

    // =====================================================
    // Registrar en audit log (sin guardar la clave en plano)
    // =====================================================
    try {
      await db.auditLog.create({
        data: {
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          accion: 'CLAVE_TEMPORAL_CREADA',
          modulo: 'clientes',
          entidadId: cliente.id,
          entidadNombre: `${cliente.nombre} - ${cliente.cedula}`,
          detalles: JSON.stringify({
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            tieneEmail: !!email,
            claveLongitud: claveTemporalPlana.length,
            claveTempExpira: claveTempExpira.toISOString(),
          }),
          ipOrigen: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
          exito: true,
        },
      })
    } catch (auditErr) {
      console.error('[clientes POST] No se pudo registrar audit log:', auditErr)
    }

    // =====================================================
    // Enviar la clave temporal al correo del cliente (si tiene email)
    // =====================================================
    let emailEnviado = false
    let emailError: string | undefined
    if (email && email.trim() !== '') {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Bienvenido a JSADR</h1>
            <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">Portal del Cliente</p>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 12px; color: #111827; font-size: 15px;">
              Hola <strong>${escapeHtml(nombre)}</strong>,
            </p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
              Tu cuenta ha sido creada exitosamente. Para ingresar al Portal del Cliente
              por primera vez, utiliza las siguientes credenciales temporales:
            </p>
            <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 12px; background: #f3f4f6; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 35%;">Usuario (cédula):</td>
                <td style="padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: bold;">${escapeHtml(cedula)}</td>
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
      const text = `Bienvenido a JSADR\n\nHola ${nombre},\n\nTu cuenta ha sido creada. Ingresa al Portal del Cliente con:\n\nUsuario (cédula): ${cedula}\nClave temporal: ${claveTemporalPlana}\n\nPor seguridad, deberás cambiar esta clave en tu primer inicio de sesión. La clave temporal expira en 24 horas.\n\nSaludos,\nJSADR`

      try {
        const resultado = await enviarEmail({
          to: email.trim(),
          subject: 'Bienvenido a JSADR — Tu clave de acceso al Portal',
          text,
          html,
        })
        emailEnviado = resultado.success
        if (!resultado.success) {
          emailError = resultado.error
          console.warn('[clientes POST] Email no enviado:', emailError)
        }
      } catch (emailErr: any) {
        emailError = emailErr?.message || String(emailErr)
        console.error('[clientes POST] Error enviando email de bienvenida:', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: cliente,
      // Información adicional para el gestor:
      // - Si tiene email y se envió correctamente, no se devuelve la clave en la respuesta
      //   (ya está en el buzón del cliente).
      // - Si no tiene email o el envío falló, se devuelve la clave en plano para que el
      //   gestor la comunique por otro canal (WhatsApp, llamada, etc.).
      claveTemporal: emailEnviado ? undefined : claveTemporalPlana,
      emailEnviado,
      emailError,
      mensaje: emailEnviado
        ? `Cliente creado. Se envió la clave temporal al correo ${email}. El cliente deberá cambiarla en su primer ingreso.`
        : email
          ? `Cliente creado, pero no se pudo enviar el correo (${emailError}). Comunicar la clave temporal al cliente por otro canal.`
          : `Cliente creado. El cliente no tiene email registrado — comunicar la clave temporal por otro canal.`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// v4.13 — Utilitarios para la clave temporal
// =====================================================

/**
 * Genera una clave temporal robusta de la longitud indicada.
 * Usa caracteres alfanuméricos + símbolos seguros (excluye 0/O/1/l
 * para evitar confusiones visuales). Genera bytes con crypto.randomBytes
 * (no Math.random) para garantizar entropía criptográfica.
 */
function generarClaveTemporal(longitud: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*'
  const bytes = crypto.randomBytes(longitud)
  let clave = ''
  for (let i = 0; i < longitud; i++) {
    clave += chars[bytes[i] % chars.length]
  }
  return clave
}

/**
 * Escapa caracteres HTML para prevenir XSS en el cuerpo del email.
 * Necesario porque el nombre/cédula del cliente se insertan en el HTML.
 */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
