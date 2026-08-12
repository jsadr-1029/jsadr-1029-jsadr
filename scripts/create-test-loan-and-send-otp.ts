/**
 * Crea un préstamo de prueba y envía OTP por WhatsApp Cloud API.
 *
 * Estrategia:
 *   1. Crear/actualizar cliente Johan Alvarez con teléfono +57 310 3674546
 *      (que ya está agregado como destinatario de prueba en Meta).
 *   2. Crear un préstamo de prueba en estado PENDIENTE_ACEPTACION con código único.
 *   3. Disparar enviarOTPSmart() directamente (sin pasar por la API HTTP para
 *      evitar el requirement de auth).
 *   4. Mostrar el wamid y el código OTP enviado.
 *
 * Uso:
 *   npx tsx scripts/create-test-loan-and-send-otp.ts
 */

// Cargar variables de entorno ANTES de importar Prisma
import * as dotenv from 'dotenv'

// Cargar .env primero (tiene WHATSAPP_*)
dotenv.config()

// Si DATABASE_URL es SQLite, sobreescribirla con la URL real de Neon
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
  console.log('Usando DATABASE_URL de Neon (producción)')
}

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Teléfono de destino: +57 310 3674546 (agregado como destinatario de prueba en Meta)
const TELEFONO_PRUEBA = '3103674546'

async function main() {
  console.log('=== CREAR PRÉSTAMO DE PRUEBA Y ENVIAR OTP ===\n')

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
      telefono: TELEFONO_PRUEBA, // Asegurar el teléfono de prueba
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

  // Calcular valores del préstamo (préstamo pequeño de prueba)
  const montoPrincipal = 500000 // $500.000 COP
  const tasaInteresAnual = 24 // 24% anual
  const tasaInteresMensual = tasaInteresAnual / 12 // 2% mensual
  const plazoMeses = 3
  const numeroCuotas = 3 // mensual
  const frecuencia = 'MENSUAL'
  const totalInteres = montoPrincipal * (tasaInteresMensual / 100) * plazoMeses
  const totalPagar = montoPrincipal + totalInteres
  const montoCuota = totalPagar / numeroCuotas
  const tasaMoraDiaria = 0.005 // 0.5% diario

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
  console.log('      Monto: $', montoPrincipal.toLocaleString('es-CO'))
  console.log('      Estado:', prestamo.estado)

  // === 3. Generar OTP y enviar ===
  console.log('\n3. Generando OTP...')
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  console.log('   OTP generado:', otp)

  // Crear registro FirmaElectronica
  console.log('   Creando registro FirmaElectronica...')
  const firma = await db.firmaElectronica.create({
    data: {
      prestamoId: prestamo.id,
      clienteId: cliente.id,
      tipo: 'TYC',
      imagenFirma: '',
      otpEnviado: true,
      otpCodigo: '$2a$10$dummyhash', // se actualiza abajo con hashOtp real
      otpCanal: 'WHATSAPP',
      otpFechaEnvio: new Date(),
      estadoFirma: 'OTP_ENVIADO',
      firmanteRol: 'DEUDOR',
      firmanteNombre: cliente.nombre,
      firmanteCedula: cliente.cedula,
    },
  })

  // Importar hashOtp para guardar el hash correcto
  const { hashOtp, registrarOtp } = await import('../src/lib/otp')
  await db.firmaElectronica.update({
    where: { id: firma.id },
    data: { otpCodigo: hashOtp(otp) },
  })
  console.log('   ✅ Firma creada:', firma.id, '| Estado:', firma.estadoFirma)

  // Registrar en OtpRegistro (trazabilidad)
  try {
    await registrarOtp({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      codigoPlano: otp,
      metodo: 'WHATSAPP',
      destinatario: cliente.telefono,
      tipo: 'FIRMA_ELECTRONICA',
      entidadRefId: firma.id,
      descripcion: `OTP aceptación TyC préstamo ${prestamo.codigo}`,
      maxIntentos: 3,
      expiraEnMinutos: 5,
      guardarCodigoPlano: false,
    })
    console.log('   ✅ OTP registrado en OtpRegistro')
  } catch (e: any) {
    console.warn('   ⚠️  No se pudo registrar en OtpRegistro:', e?.message)
  }

  // === 4. Enviar OTP por WhatsApp Cloud API ===
  console.log('\n4. Enviando OTP por WhatsApp Cloud API a +' + '57' + cliente.telefono + '...')

  const { enviarOTPSmart } = await import('../src/lib/whatsapp-cloud')
  const mensaje = `🔐 *CÓDIGO DE VERIFICACIÓN - ACEPTACIÓN DE PRÉSTAMO*\n\nHola *${cliente.nombre}*,\n\nPara confirmar la aceptación de los Términos y Condiciones de tu préstamo *${prestamo.codigo}*, ingresa el siguiente código:\n\n  >>  ${otp}  <<\n\n⏰ El código expira en 5 minutos.\n⚠️ No compartas este código con nadie.`

  const result = await enviarOTPSmart(cliente.telefono, otp, mensaje)

  console.log('\n=== RESULTADO ===')
  if (result.exito) {
    console.log('✅ OTP ENVIADO EXITOSAMENTE')
    console.log('   wamid:', result.wamid)
    console.log('   modo:', result.modo, '(TEXTO=libre, PLANTILLA_OTP=plantilla)')
    console.log('   origen credenciales:', result.origenCredenciales)
    console.log('\n📱 Revisa tu WhatsApp en +' + '57' + cliente.telefono)
    console.log('   Código OTP:', otp)
  } else {
    console.log('❌ Error enviando OTP:')
    console.log('   error:', result.error)
    console.log('   respuesta:', JSON.stringify(result.respuesta, null, 2))
  }

  // === 5. Guardar notificación ===
  try {
    const { guardarNotificacion } = await import('../src/lib/whatsapp')
    await guardarNotificacion({
      db,
      prestamoId: prestamo.id,
      telefono: cliente.telefono,
      tipo: 'OTP',
      mensaje,
      envio: result.exito
        ? { exito: true, wamid: result.wamid, canal: 'WHATSAPP', modo: result.modo }
        : { exito: false, error: result.error },
    })
    console.log('\n   ✅ Notificación guardada en BD')
  } catch (e: any) {
    console.warn('   ⚠️  No se pudo guardar notificación:', e?.message)
  }

  // === Resumen final ===
  console.log('\n=== RESUMEN ===')
  console.log('Cliente:', cliente.nombre, '| C.C.', cliente.cedula, '| Tel:', cliente.telefono)
  console.log('Préstamo:', prestamo.codigo, '| Monto: $' + montoPrincipal.toLocaleString('es-CO'), '| Estado:', prestamo.estado)
  console.log('Firma ID:', firma.id)
  console.log('OTP enviado:', otp)
  console.log('Canal: WHATSAPP')
  console.log('wamid:', result.wamid || '(fallo)')

  // Devolver info para próximos pasos
  console.log('\n=== PRÓXIMOS PASOS ===')
  console.log('Para validar el OTP desde la API (cuando el usuario lo ingrese):')
  console.log(`  curl -X POST https://jsadr-1029-jsadr.vercel.app/api/prestamos/${prestamo.id}/aceptar-tyc-otp \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -d '{"accion":"validar_otp","otp":"${otp}"}'`)
  console.log('')
  console.log('Para limpiar este préstamo de prueba después:')
  console.log(`  npx prisma db delete --model Prestamo --id "${prestamo.id}"`)
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
