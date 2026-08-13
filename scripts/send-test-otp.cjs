// =====================================================
// CREAR PRÉSTAMO DE PRUEBA + ENVIAR OTP POR WHATSAPP
// =====================================================
// Versión JavaScript (sin tsx) del script original.
// Replica la lógica de src/lib/whatsapp-cloud.ts + src/lib/otp.ts
//
// Pasos:
//   1. Crear/actualizar cliente Johan Alvarez (3103674546)
//   2. Crear préstamo de prueba PENDIENTE_ACEPTACION
//   3. Crear FirmaElectronica con OTP
//   4. Registrar en OtpRegistro
//   5. Enviar OTP por WhatsApp Cloud API
// =====================================================

const fs = require('fs')
const crypto = require('crypto')

// --- Cargar .env ---
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
process.env.DATABASE_URL = NEON_URL

const db = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

const TELEFONO_PRUEBA = '3103674546'

// --- Helpers OTP (replicados de src/lib/otp.ts) ---
function hashOtp(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

// --- Helpers WhatsApp (replicados de src/lib/whatsapp-cloud.ts) ---
function limpiarTelefono(telefono) {
  let limpio = telefono.replace(/[^\d]/g, '')
  if (limpio.length === 10) limpio = '57' + limpio
  if (limpio.length < 7 || limpio.length > 15) {
    throw new Error('Teléfono inválido: longitud fuera de rango (7-15)')
  }
  return limpio
}

async function llamarCloudAPI(phoneNumberId, token, graphVersion, bodyObj) {
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyObj),
    })
    const data = await resp.json()
    if (!resp.ok) {
      const errorMsg = data?.error?.message || `HTTP ${resp.status}`
      const errorCode = data?.error?.code
      const errorSubcode = data?.error?.error_subcode
      console.error('[WhatsAppCloud] Error API Meta:', { errorMsg, errorCode, errorSubcode })
      return {
        exito: false,
        error: `Meta API: ${errorMsg}${errorCode ? ` (code ${errorCode}${errorSubcode ? '/' + errorSubcode : ''})` : ''}`,
        respuesta: data,
      }
    }
    const wamid = data?.messages?.[0]?.id
    if (!wamid) {
      return { exito: false, error: 'Meta API no devolvió wamid', respuesta: data }
    }
    return { exito: true, wamid, respuesta: data }
  } catch (error) {
    console.error('[WhatsAppCloud] Exception:', error?.message || error)
    return { exito: false, error: error?.message || 'Error desconocido en WhatsApp Cloud API' }
  }
}

async function enviarOTPPorPlantilla(telefonoDestino, codigoOtp) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'
  const plantillaNombre = process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE
  const plantillaIdioma = process.env.WHATSAPP_PLANTILLA_OTP_IDIOMA || 'es'

  if (!token || !phoneNumberId) {
    return { exito: false, error: 'WhatsApp Cloud API no configurado en .env' }
  }
  if (!plantillaNombre) {
    return { exito: false, error: 'Plantilla OTP no configurada' }
  }

  const telefonoLimpio = limpiarTelefono(telefonoDestino)
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefonoLimpio,
    type: 'template',
    template: {
      name: plantillaNombre,
      language: { code: plantillaIdioma },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: codigoOtp }],
        },
      ],
    },
  }
  const result = await llamarCloudAPI(phoneNumberId, token, graphVersion, body)
  return result.exito ? { ...result, modo: 'PLANTILLA_OTP', origenCredenciales: 'ENV' } : result
}

async function enviarWhatsAppCloudAPI(telefonoDestino, mensaje) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

  if (!token || !phoneNumberId) {
    return { exito: false, error: 'WhatsApp Cloud API no configurado en .env' }
  }

  const telefonoLimpio = limpiarTelefono(telefonoDestino)
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefonoLimpio,
    type: 'text',
    text: { body: mensaje, preview_url: false },
  }
  const result = await llamarCloudAPI(phoneNumberId, token, graphVersion, body)
  return result.exito ? { ...result, modo: 'TEXTO', origenCredenciales: 'ENV' } : result
}

async function enviarOTPSmart(telefonoDestino, codigoOtp, mensajeTextoLibre) {
  // 1. Intentar plantilla OTP primero (si está configurada)
  if (process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE) {
    const r = await enviarOTPPorPlantilla(telefonoDestino, codigoOtp)
    if (r.exito) return r
    const errLower = (r.error || '').toLowerCase()
    const esErrorPlantilla =
      errLower.includes('template') ||
      errLower.includes('plantilla') ||
      errLower.includes('1320')
    if (!esErrorPlantilla) {
      return r
    }
    console.warn('[WhatsAppCloud] Plantilla OTP falló, fallback a texto libre:', r.error)
  }
  // 2. Fallback: texto libre
  const r2 = await enviarWhatsAppCloudAPI(telefonoDestino, mensajeTextoLibre)
  return r2.exito ? { ...r2, modo: 'TEXTO', origenCredenciales: 'ENV' } : r2
}

async function main() {
  console.log('=== CREAR PRÉSTAMO DE PRUEBA Y ENVIAR OTP ===\n')
  console.log(`Teléfono destino: +57 ${TELEFONO_PRUEBA}`)
  console.log(`Plantilla OTP: ${process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE || '(no configurada)'}`)
  console.log(`Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}\n`)

  // === 1. Cliente Johan Alvarez ===
  console.log('1. Creando/actualizando cliente Johan Alvarez...')
  const cliente = await db.cliente.upsert({
    where: { cedula: '1214731649' },
    create: {
      nombre: 'JOHAN SEBASTIAN ALVAREZ DEL RIO',
      cedula: '1214731649',
      telefono: TELEFONO_PRUEBA,
      email: 'jsa@jsadr.com.co',
      direccion: 'CALLE 92 44A 34',
      barrio: 'ARANJUEZ',
      municipio: 'MEDELLÍN',
      ciudad: 'MEDELLÍN',
      departamento: 'ANTIOQUIA',
      activo: true,
    },
    update: {
      telefono: TELEFONO_PRUEBA,
      nombre: 'JOHAN SEBASTIAN ALVAREZ DEL RIO',
      email: 'jsa@jsadr.com.co',
      direccion: 'CALLE 92 44A 34',
      barrio: 'ARANJUEZ',
      municipio: 'MEDELLÍN',
      ciudad: 'MEDELLÍN',
      departamento: 'ANTIOQUIA',
      activo: true,
    },
  })
  console.log('   ✅ Cliente:', cliente.nombre, '| C.C.', cliente.cedula, '| Tel:', cliente.telefono)

  // === 2. Crear préstamo de prueba ===
  const codigoPrestamo = `PREST-TEST-OTP-${Date.now().toString().slice(-6)}`
  console.log('\n2. Creando préstamo de prueba con código:', codigoPrestamo)

  const montoPrincipal = 500000
  const tasaInteresAnual = 24
  const tasaInteresMensual = tasaInteresAnual / 12
  const plazoMeses = 3
  const numeroCuotas = 3
  const frecuencia = 'MENSUAL'
  const totalInteres = montoPrincipal * (tasaInteresMensual / 100) * plazoMeses
  const totalPagar = montoPrincipal + totalInteres
  const montoCuota = totalPagar / numeroCuotas
  const tasaMoraDiaria = 0.005

  const prestamo = await db.prestamo.create({
    data: {
      codigo: codigoPrestamo,
      clienteId: cliente.id,
      montoPrincipal,
      tasaInteresAnual,
      tasaInteresMensual,
      tasaMoraDiaria,
      plazoMeses,
      frecuencia,
      numeroCuotas,
      montoCuota,
      totalInteres,
      totalPagar,
      tasaAplicada: tasaInteresMensual,
      modalidadAmortizacion: 'FRANCES',
      moraCompuestaDiaria: true,
      estado: 'PENDIENTE_ACEPTACION',
      tycEnviado: true,
      tycAceptado: false,
      generarPagare: true,
      generarCarta: true,
      requiereDocumentos: true,
      tieneCodeudor: false,
      saldoCapital: montoPrincipal,
      saldoInteres: 0,
      saldoTotal: montoPrincipal,
      fechaSolicitud: new Date(),
    },
  })
  console.log('   ✅ Préstamo creado:')
  console.log('      ID:', prestamo.id)
  console.log('      Código:', prestamo.codigo)
  console.log('      Monto: $' + montoPrincipal.toLocaleString('es-CO'))
  console.log('      Estado:', prestamo.estado)

  // === 3. Generar OTP y crear FirmaElectronica ===
  console.log('\n3. Generando OTP...')
  // OTP numérico de 6 dígitos
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  console.log('   OTP generado:', otp)

  const firma = await db.firmaElectronica.create({
    data: {
      prestamoId: prestamo.id,
      clienteId: cliente.id,
      tipo: 'TYC',
      imagenFirma: '',
      otpEnviado: true,
      otpCodigo: hashOtp(otp),
      otpCanal: 'WHATSAPP',
      otpFechaEnvio: new Date(),
      estadoFirma: 'OTP_ENVIADO',
      firmanteRol: 'DEUDOR',
      firmanteNombre: cliente.nombre,
      firmanteCedula: cliente.cedula,
    },
  })
  console.log('   ✅ FirmaElectronica creada:', firma.id, '| Estado:', firma.estadoFirma)

  // === 4. Registrar en OtpRegistro ===
  try {
    const expiraEn = new Date(Date.now() + 5 * 60 * 1000)
    await db.otpRegistro.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        codigoHash: hashOtp(otp),
        codigoPlano: null,
        metodo: 'WHATSAPP',
        destinatario: cliente.telefono,
        tipo: 'FIRMA_ELECTRONICA',
        entidadRefId: firma.id,
        descripcion: `OTP aceptación TyC préstamo ${prestamo.codigo}`,
        intentos: 0,
        maxIntentos: 3,
        usado: false,
        bloqueado: false,
        expiraEn,
        verificado: false,
      },
    })
    console.log('   ✅ OtpRegistro creado (expira en 5 min)')
  } catch (e) {
    console.warn('   ⚠️  No se pudo registrar en OtpRegistro:', e?.message)
  }

  // === 5. Enviar OTP por WhatsApp ===
  console.log('\n4. Enviando OTP por WhatsApp Cloud API a +57' + cliente.telefono + '...')
  const mensaje = `🔐 *CÓDIGO DE VERIFICACIÓN - ACEPTACIÓN DE PRÉSTAMO*\n\nHola *${cliente.nombre}*,\n\nPara confirmar la aceptación de los Términos y Condiciones de tu préstamo *${prestamo.codigo}*, ingresa el siguiente código:\n\n  >>  ${otp}  <<\n\n⏰ El código expira en 5 minutos.\n⚠️ No compartas este código con nadie.`

  const result = await enviarOTPSmart(cliente.telefono, otp, mensaje)

  console.log('\n=== RESULTADO ===')
  if (result.exito) {
    console.log('✅ OTP ENVIADO EXITOSAMENTE')
    console.log('   wamid:', result.wamid)
    console.log('   modo:', result.modo, '(TEXTO=libre, PLANTILLA_OTP=plantilla)')
    console.log('   origen credenciales:', result.origenCredenciales)
    console.log('\n📱 Revisa tu WhatsApp en +57' + cliente.telefono)
    console.log('   Código OTP:', otp)
  } else {
    console.log('❌ Error enviando OTP:')
    console.log('   error:', result.error)
    console.log('   respuesta:', JSON.stringify(result.respuesta, null, 2))
  }

  // === Guardar NotificacionLog ===
  try {
    await db.notificacionLog.create({
      data: {
        clienteId: cliente.id,
        prestamoId: prestamo.id,
        tipo: 'OTP',
        canal: 'WHATSAPP',
        destinatario: cliente.telefono,
        mensaje: mensaje,
        enviado: result.exito,
        wamid: result.wamid || null,
        error: result.exito ? null : result.error,
        fechaEnvio: new Date(),
      },
    })
    console.log('\n   ✅ NotificacionLog guardada en BD')
  } catch (e) {
    console.warn('   ⚠️  No se pudo guardar NotificacionLog:', e?.message)
  }

  console.log('\n=== RESUMEN ===')
  console.log('Cliente:', cliente.nombre, '| C.C.', cliente.cedula, '| Tel:', cliente.telefono)
  console.log('Préstamo:', prestamo.codigo, '| Monto: $' + montoPrincipal.toLocaleString('es-CO'), '| Estado:', prestamo.estado)
  console.log('Firma ID:', firma.id)
  console.log('OTP enviado:', otp)
  console.log('Canal: WHATSAPP')
  console.log('wamid:', result.wamid || '(fallo)')

  console.log('\n=== PRÓXIMOS PASOS ===')
  console.log('Para validar el OTP desde la API:')
  console.log(`  curl -X POST https://jsadr-1029-jsadr.vercel.app/api/prestamos/${prestamo.id}/aceptar-tyc-otp \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -d '{"accion":"validar_otp","otp":"${otp}"}'`)

  await db.$disconnect()
}

main().catch(e => {
  console.error('❌ Error fatal:', e)
  process.exit(1)
})
