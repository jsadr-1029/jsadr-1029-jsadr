// =====================================================
// /api/portal/auth — Autenticación del Portal del Cliente v3.0
// Acciones:
//   - verificar_cedula: comprueba si la cédula existe y tiene PIN
//   - crear_pin: crea PIN inicial (si no existe)
//   - login: valida cédula + PIN
//   - logout: invalida sesión
//   - cambiar_pin: cambia PIN (requiere sesión activa)
//   - verificar_sesion: valida token de sesión
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { errorResponse, logError } from '@/lib/error-handler'
import { registrarAccesoPortal, getPortalClientInfo } from '@/lib/acceso-portal'
import { validateInput } from '@/lib/validators'
import { z } from 'zod'

// Reforzado: schema Zod para verificar_cedula
const verificarCedulaSchema = z.object({
  accion: z.literal('verificar_cedula'),
  cedula: z.string().min(4, 'Cédula requerida').max(15).regex(/^\d+$/, 'Cédula debe ser numérica'),
})

// Reforzado: schema Zod para crear_pin
const crearPinSchema = z.object({
  accion: z.literal('crear_pin'),
  cedula: z.string().min(4).max(15).regex(/^\d+$/),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN debe ser numérico'),
  confirmarPin: z.string().min(4).max(6).regex(/^\d+$/),
})

// Reforzado: schema Zod para login
const loginPortalSchema = z.object({
  accion: z.literal('login'),
  cedula: z.string().min(4).max(15).regex(/^\d+$/),
  pin: z.string().min(4).max(6).regex(/^\d+$/),
})

// === CONFIGURACIÓN ===
const MAX_INTENTOS_PIN = 5
const TIEMPO_BLOQUEO_MIN = 15
const SESSION_EXPIRY_HOURS = 2
const BCRYPT_ROUNDS = 12 // Reforzado: igual que admin (security.ts)
const PIN_EXPIRY_DAYS = 90 // Reforzado: PIN expira a los 90 días

// === POLÍTICA DE PIN — anti-secuencias débiles ===
// PINs prohibidos: secuencias obvias, repeticiones, patrones comunes
const PINES_DEBILES = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '3210',
  '1357', '2468', '9876',
  '00000', '12345', '54321', '11111', '000000', '123456', '654321', '111111',
  '112233', '121212', '010101',
])

/**
 * Valida la fortaleza del PIN más allá del formato.
 * Retorna { valido: boolean, motivo?: string }.
 */
function validarFortalezaPin(pin: string): { valido: boolean; motivo?: string } {
  if (!/^\d{4,6}$/.test(pin)) {
    return { valido: false, motivo: 'El PIN debe tener entre 4 y 6 dígitos numéricos' }
  }
  if (PINES_DEBILES.has(pin)) {
    return { valido: false, motivo: 'El PIN es demasiado débil (secuencia obvia). Usa uno más aleatorio.' }
  }
  // Bloquear secuencias crecientes/decrecientes de 4+ dígitos
  const esSecuencia = (s: string, paso: number) => {
    for (let i = 1; i < s.length; i++) {
      if (parseInt(s[i]) - parseInt(s[i - 1]) !== paso) return false
    }
    return true
  }
  if (pin.length >= 4 && (esSecuencia(pin, 1) || esSecuencia(pin, -1))) {
    return { valido: false, motivo: 'El PIN no puede ser una secuencia consecutiva (1234, 4321...)' }
  }
  // Bloquear todos los dígitos iguales
  if (new Set(pin.split('')).size === 1) {
    return { valido: false, motivo: 'El PIN no puede tener todos los dígitos iguales' }
  }
  // Bloquear pares tipo ABAB
  if (pin.length === 4 && pin[0] === pin[2] && pin[1] === pin[3] && pin[0] !== pin[1]) {
    return { valido: false, motivo: 'El PIN no puede ser un patrón repetido (ABAB)' }
  }
  return { valido: true }
}

interface SesionPortal {
  clienteId: string
  clienteNombre: string
  clienteCedula: string
  token: string
  expira: Date
}

// Sesiones en memoria (en producción usar Redis o DB)
const sesionesPortal = new Map<string, SesionPortal>()

// Limpieza periódica de sesiones expiradas
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = new Date()
    for (const [key, sesion] of sesionesPortal.entries()) {
      if (sesion.expira < now) sesionesPortal.delete(key)
    }
  }, 10 * 60 * 1000)
}

function generarTokenSesion(): string {
  return crypto.randomBytes(32).toString('hex')
}

async function getOrCreateClientePin(cedula: string) {
  // Buscar si ya existe un registro de PIN para esta cédula
  const existente = await db.configuracion.findUnique({
    where: { clave: `PORTAL_PIN_${cedula}` },
  })
  return existente
}

async function getClienteByCedula(cedula: string) {
  return db.cliente.findUnique({
    where: { cedula },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      telefono: true,
      email: true,
      activo: true,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const clientInfo = getPortalClientInfo(req)
    const body = await req.json()
    const { accion } = body

    // Reforzado: validar con Zod según la acción
    if (accion === 'verificar_cedula') {
      const v = validateInput(verificarCedulaSchema, body)
      if (!v.success) return NextResponse.json({ success: false, error: v.error, fieldErrors: v.fieldErrors }, { status: 400 })
    } else if (accion === 'crear_pin') {
      const v = validateInput(crearPinSchema, body)
      if (!v.success) return NextResponse.json({ success: false, error: v.error, fieldErrors: v.fieldErrors }, { status: 400 })
    } else if (accion === 'login') {
      const v = validateInput(loginPortalSchema, body)
      if (!v.success) return NextResponse.json({ success: false, error: v.error, fieldErrors: v.fieldErrors }, { status: 400 })
    }

    switch (accion) {
      case 'verificar_cedula':
        return await verificarCedula(req, body, clientInfo)
      case 'crear_pin':
        return await crearPin(req, body, clientInfo)
      case 'login':
        return await login(req, body, clientInfo)
      case 'logout':
        return await logout(req, body, clientInfo)
      case 'cambiar_pin':
        return await cambiarPin(req, body, clientInfo)
      case 'verificar_sesion':
        return await verificarSesion(req, body, clientInfo)
      default:
        return NextResponse.json(
          { success: false, error: 'Acción no válida', code: 'INVALID_ACTION' },
          { status: 400 }
        )
    }
  } catch (error) {
    logError('/api/portal/auth', error)
    return errorResponse('/api/portal/auth', error)
  }
}

// === VERIFICAR CÉDULA ===
async function verificarCedula(
  req: NextRequest,
  body: any,
  clientInfo: { ip: string; userAgent: string }
) {
  const { cedula } = body
  if (!cedula) {
    return NextResponse.json(
      { success: false, error: 'Cédula requerida', code: 'CEDULA_REQUIRED' },
      { status: 400 }
    )
  }

  const cliente = await getClienteByCedula(cedula)

  // === ANTI-ENUMERACIÓN (Reforzado) ===
  // Respuesta uniforme status 200 — no revela si la cédula existe o no.
  // El detalle del error se devuelve solo si la cédula es válida y el cliente está activo.
  // Para un atacante, todas las cédulas devolverán "requierePin: true" → no puede distinguir.
  if (!cliente) {
    await registrarAccesoPortal({
      clienteCedula: cedula,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'VERIFICAR_CEDULA',
      exito: false,
      detalle: 'Cédula no encontrada (anti-enumeración: respuesta uniforme)',
    })
    // Anti-enumeración: devolver success:true con datos genéricos
    // El siguiente paso (crear_pin o login) validará realmente
    return NextResponse.json({
      success: true,
      data: {
        clienteId: null,
        nombre: '',
        tienePin: false,
        requierePin: true, // simula que el cliente no existe pero requiere PIN
      },
    })
  }

  if (!cliente.activo) {
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'VERIFICAR_CEDULA',
      exito: false,
      detalle: 'Cliente inactivo (anti-enumeración: respuesta uniforme)',
    })
    // Anti-enumeración: misma respuesta que si no existiera
    return NextResponse.json({
      success: true,
      data: {
        clienteId: null,
        nombre: '',
        tienePin: false,
        requierePin: true,
      },
    })
  }

  // Verificar si ya tiene PIN
  const pinConfig = await getOrCreateClientePin(cedula)
  const tienePin = !!pinConfig

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'VERIFICAR_CEDULA',
    exito: true,
    detalle: tienePin ? 'Cliente con PIN existente' : 'Cliente sin PIN',
  })

  return NextResponse.json({
    success: true,
    data: {
      clienteId: cliente.id,
      nombre: cliente.nombre,
      tienePin,
      // Si no tiene PIN, debe crear uno
      requierePin: !tienePin,
    },
  })
}

// === CREAR PIN ===
async function crearPin(
  req: NextRequest,
  body: any,
  clientInfo: { ip: string; userAgent: string }
) {
  const { cedula, pin, confirmarPin } = body

  if (!cedula || !pin || !confirmarPin) {
    return NextResponse.json(
      { success: false, error: 'Cédula, PIN y confirmación son requeridos', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  if (pin !== confirmarPin) {
    return NextResponse.json(
      { success: false, error: 'Los PINs no coinciden', code: 'PIN_MISMATCH' },
      { status: 400 }
    )
  }

  // Validar PIN: 4-6 dígitos numéricos + política de fortaleza
  const fortaleza = validarFortalezaPin(pin)
  if (!fortaleza.valido) {
    return NextResponse.json(
      { success: false, error: fortaleza.motivo, code: 'WEAK_PIN' },
      { status: 400 }
    )
  }

  const cliente = await getClienteByCedula(cedula)
  if (!cliente) {
    return NextResponse.json(
      { success: false, error: 'Cliente no encontrado', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Verificar si ya tiene PIN
  const existente = await getOrCreateClientePin(cedula)
  if (existente) {
    return NextResponse.json(
      { success: false, error: 'Ya tiene un PIN configurado. Use cambiar_pin.', code: 'PIN_EXISTS' },
      { status: 400 }
    )
  }

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS)

  // Reforzado: registrar fecha de creación para expiración a 90 días
  await db.configuracion.create({
    data: {
      clave: `PORTAL_PIN_${cedula}`,
      valor: JSON.stringify({
        pinHash,
        clienteId: cliente.id,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        createdAt: new Date().toISOString(),
        pinUpdatedAt: new Date().toISOString(), // Reforzado: para expiración
      }),
      descripcion: 'PIN del portal del cliente',
    },
  })

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'CREAR_PIN',
    exito: true,
  })

  return NextResponse.json({
    success: true,
    message: 'PIN creado exitosamente. Ahora puede iniciar sesión.',
  })
}

// === LOGIN ===
async function login(
  req: NextRequest,
  body: any,
  clientInfo: { ip: string; userAgent: string }
) {
  const { cedula, pin } = body

  if (!cedula || !pin) {
    return NextResponse.json(
      { success: false, error: 'Cédula y PIN son requeridos', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const cliente = await getClienteByCedula(cedula)
  if (!cliente) {
    await registrarAccesoPortal({
      clienteCedula: cedula,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'INTENTO_FALLIDO',
      exito: false,
      detalle: 'Cédula no encontrada',
    })
    return NextResponse.json(
      { success: false, error: 'Cédula o PIN incorrecto', code: 'INVALID_CREDENTIALS' },
      { status: 401 }
    )
  }

  const pinConfig = await getOrCreateClientePin(cedula)
  if (!pinConfig) {
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'INTENTO_FALLIDO',
      exito: false,
      detalle: 'Cliente sin PIN configurado',
    })
    return NextResponse.json(
      // Anti-enumeración: mismo mensaje que cédula incorrecta
      { success: false, error: 'Cédula o PIN incorrecto', code: 'INVALID_CREDENTIALS' },
      { status: 401 }
    )
  }

  // Parsear datos del PIN
  let pinData: {
    pinHash: string
    clienteId: string
    intentosFallidos: number
    bloqueadoHasta: string | null
    createdAt: string
  }
  try {
    pinData = JSON.parse(pinConfig.valor)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno. Contacte al administrador.', code: 'PIN_DATA_ERROR' },
      { status: 500 }
    )
  }

  // Verificar bloqueo
  if (pinData.bloqueadoHasta && new Date(pinData.bloqueadoHasta) > new Date()) {
    const minsRestantes = Math.ceil(
      (new Date(pinData.bloqueadoHasta).getTime() - Date.now()) / 60000
    )
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'INTENTO_FALLIDO',
      exito: false,
      detalle: `Cuenta bloqueada por ${minsRestantes} min más`,
    })
    return NextResponse.json(
      {
        success: false,
        error: `Cuenta bloqueada. Intente en ${minsRestantes} minuto(s).`,
        code: 'LOCKED',
      },
      { status: 403 }
    )
  }

  // Verificar PIN
  // Reforzado: verificar expiración del PIN (90 días)
  const pinUpdatedAt = (pinData as any).pinUpdatedAt ? new Date((pinData as any).pinUpdatedAt) : new Date((pinData as any).createdAt || Date.now())
  const diasDesdeUpdate = Math.floor((Date.now() - pinUpdatedAt.getTime()) / (24 * 60 * 60 * 1000))
  if (diasDesdeUpdate > PIN_EXPIRY_DAYS) {
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'PIN_EXPIRADO',
      exito: false,
      detalle: `PIN expirado hace ${diasDesdeUpdate - PIN_EXPIRY_DAYS} días`,
    })
    return NextResponse.json(
      {
        success: false,
        error: `Tu PIN ha expirado (última actualización hace ${diasDesdeUpdate} días). Contacta al administrador para renovarlo.`,
        code: 'PIN_EXPIRED',
      },
      { status: 403 }
    )
  }

  const pinValido = await bcrypt.compare(pin, pinData.pinHash)
  if (!pinValido) {
    pinData.intentosFallidos = (pinData.intentosFallidos || 0) + 1

    let bloqueado = false
    if (pinData.intentosFallidos >= MAX_INTENTOS_PIN) {
      const bloqueadoHasta = new Date()
      bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + TIEMPO_BLOQUEO_MIN)
      pinData.bloqueadoHasta = bloqueadoHasta.toISOString()
      bloqueado = true
    }

    await db.configuracion.update({
      where: { clave: `PORTAL_PIN_${cedula}` },
      data: { valor: JSON.stringify(pinData) },
    })

    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'INTENTO_FALLIDO',
      exito: false,
      detalle: `Intento ${pinData.intentosFallidos}/${MAX_INTENTOS_PIN}`,
    })

    if (bloqueado) {
      return NextResponse.json(
        {
          success: false,
          error: `Cuenta bloqueada tras ${MAX_INTENTOS_PIN} intentos fallidos. Espere ${TIEMPO_BLOQUEO_MIN} minutos.`,
          code: 'LOCKED',
        },
        { status: 403 }
      )
    }

    const restantes = MAX_INTENTOS_PIN - pinData.intentosFallidos
    return NextResponse.json(
      {
        success: false,
        error: `PIN incorrecto. Intentos restantes: ${restantes}`,
        code: 'INVALID_PIN',
      },
      { status: 401 }
    )
  }

  // Login exitoso: resetear intentos
  pinData.intentosFallidos = 0
  pinData.bloqueadoHasta = null
  await db.configuracion.update({
    where: { clave: `PORTAL_PIN_${cedula}` },
    data: { valor: JSON.stringify(pinData) },
  })

  // Crear sesión
  const token = generarTokenSesion()
  const expira = new Date()
  expira.setHours(expira.getHours() + SESSION_EXPIRY_HOURS)

  const sesion: SesionPortal = {
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    clienteCedula: cliente.cedula,
    token,
    expira,
  }
  sesionesPortal.set(token, sesion)

  // Persistir token en el cliente para validar solicitudes web desde el portal
  try {
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: token,
        tokenExpira: expira,
      },
    })
  } catch (e) {
    // No bloquear el login si falla la persistencia
    console.error('[PortalAuth] Error persistiendo token en cliente:', e)
  }

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'LOGIN',
    exito: true,
    metadata: { sessionExpira: expira.toISOString() },
  })

  return NextResponse.json({
    success: true,
    data: {
      token,
      expira: expira.toISOString(),
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
      },
    },
  })
}

// === LOGOUT ===
async function logout(
  req: NextRequest,
  body: any,
  clientInfo: { ip: string; userAgent: string }
) {
  const { token } = body
  if (token) {
    const sesion = sesionesPortal.get(token)
    sesionesPortal.delete(token)

    if (sesion) {
      // Limpiar token persistido en el cliente
      try {
        await db.cliente.update({
          where: { id: sesion.clienteId },
          data: {
            tokenSesion: null,
            tokenExpira: null,
          },
        })
      } catch (e) {
        console.error('[PortalAuth] Error limpiando token en cliente:', e)
      }

      await registrarAccesoPortal({
        clienteId: sesion.clienteId,
        clienteCedula: sesion.clienteCedula,
        clienteNombre: sesion.clienteNombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'LOGOUT',
        exito: true,
      })
    }
  }

  return NextResponse.json({ success: true, message: 'Sesión cerrada' })
}

// === CAMBIAR PIN ===
async function cambiarPin(
  req: NextRequest,
  body: any,
  clientInfo: { ip: string; userAgent: string }
) {
  const { cedula, pinActual, pinNuevo, confirmarPin, token } = body

  // Verificar sesión activa
  const sesion = token ? sesionesPortal.get(token) : null
  if (!sesion || sesion.expira < new Date()) {
    return NextResponse.json(
      { success: false, error: 'Sesión expirada. Inicie sesión nuevamente.', code: 'SESSION_EXPIRED' },
      { status: 401 }
    )
  }

  if (sesion.clienteCedula !== cedula) {
    return NextResponse.json(
      { success: false, error: 'No autorizado para cambiar el PIN de otra cédula', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  if (!pinActual || !pinNuevo || !confirmarPin) {
    return NextResponse.json(
      { success: false, error: 'PIN actual, nuevo y confirmación son requeridos', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  if (pinNuevo !== confirmarPin) {
    return NextResponse.json(
      { success: false, error: 'Los PINs nuevos no coinciden', code: 'PIN_MISMATCH' },
      { status: 400 }
    )
  }

  // Reforzado: validar fortaleza del PIN nuevo con política anti-secuencias
  const fortalezaNueva = validarFortalezaPin(pinNuevo)
  if (!fortalezaNueva.valido) {
    return NextResponse.json(
      { success: false, error: fortalezaNueva.motivo, code: 'WEAK_PIN' },
      { status: 400 }
    )
  }
  // No permitir reusar el PIN actual
  if (pinNuevo === pinActual) {
    return NextResponse.json(
      { success: false, error: 'El PIN nuevo no puede ser igual al actual', code: 'SAME_PIN' },
      { status: 400 }
    )
  }

  const pinConfig = await getOrCreateClientePin(cedula)
  if (!pinConfig) {
    return NextResponse.json(
      { success: false, error: 'No tiene PIN configurado', code: 'NO_PIN' },
      { status: 400 }
    )
  }

  let pinData: any
  try {
    pinData = JSON.parse(pinConfig.valor)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno. Contacte al administrador.', code: 'PIN_DATA_ERROR' },
      { status: 500 }
    )
  }

  // Verificar PIN actual
  const pinValido = await bcrypt.compare(pinActual, pinData.pinHash)
  if (!pinValido) {
    await registrarAccesoPortal({
      clienteId: sesion.clienteId,
      clienteCedula: sesion.clienteCedula,
      clienteNombre: sesion.clienteNombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'CAMBIO_PIN',
      exito: false,
      detalle: 'PIN actual incorrecto',
    })
    return NextResponse.json(
      { success: false, error: 'PIN actual incorrecto', code: 'INVALID_PIN' },
      { status: 401 }
    )
  }

  // Actualizar PIN
  pinData.pinHash = await bcrypt.hash(pinNuevo, BCRYPT_ROUNDS)
  pinData.intentosFallidos = 0
  pinData.bloqueadoHasta = null
  pinData.pinUpdatedAt = new Date().toISOString() // Reforzado: resetea expiración
  pinData.updatedAt = new Date().toISOString()

  await db.configuracion.update({
    where: { clave: `PORTAL_PIN_${cedula}` },
    data: { valor: JSON.stringify(pinData) },
  })

  await registrarAccesoPortal({
    clienteId: sesion.clienteId,
    clienteCedula: sesion.clienteCedula,
    clienteNombre: sesion.clienteNombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'CAMBIO_PIN',
    exito: true,
  })

  return NextResponse.json({
    success: true,
    message: 'PIN actualizado correctamente',
  })
}

// === VERIFICAR SESIÓN ===
async function verificarSesion(
  req: NextRequest,
  body: any,
  clientInfo: { ip: string; userAgent: string }
) {
  const { token } = body
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Token requerido', code: 'NO_TOKEN' },
      { status: 400 }
    )
  }

  const sesion = sesionesPortal.get(token)
  if (!sesion || sesion.expira < new Date()) {
    if (sesion) sesionesPortal.delete(token)
    return NextResponse.json(
      { success: false, error: 'Sesión inválida o expirada', code: 'SESSION_EXPIRED' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      clienteId: sesion.clienteId,
      nombre: sesion.clienteNombre,
      cedula: sesion.clienteCedula,
      expira: sesion.expira.toISOString(),
    },
  })
}
