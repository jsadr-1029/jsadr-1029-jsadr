// Test end-to-end del flujo de solicitud de registro
// Crea una solicitud falsa con fotos válidas y luego la lista
const BASE = 'http://localhost:3001'

// Generar un JPEG mínimo válido en base64 (1x1 pixel blanco)
const MINI_JPEG_BASE64 = 'data:image/jpeg;base64,' + Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC0zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
  'base64'
).toString('base64')

async function main() {
  console.log('=== 1. POST crear solicitud ===')
  const cedulaTest = '99999' + Math.floor(Math.random() * 90000)
  const createRes = await fetch(`${BASE}/api/solicitudes-nuevos-clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Usuario', apellido: 'Prueba', tipoDocumento: 'CC', cedula: cedulaTest,
      telefono: '3001234567', email: 'test@example.com',
      ciudad: 'Bogotá', municipio: 'Chapinero', direccion: 'Calle 100 # 50-20',
      ocupacion: 'Empleado', ingresoMensual: 2500000,
      valorSolicitado: 1500000, plazoDeseado: 12, destinoCredito:'Compra de equipo',
      referidoPorNombre: 'María', referidoPorApellido: 'Gómez',
      referidoPorTelefono: '3009876543', referidoPorParentesco: 'Amiga',
      aceptaTyC: true, aceptaTratamientoDatos: true,
      aceptaConsultaCentrales: true, aceptaReportarCentral: true,
      fotoCedulaFrente: MINI_JPEG_BASE64, fotoCedulaReverso: MINI_JPEG_BASE64, fotoSelfie: MINI_JPEG_BASE64,
      fotoCedulaFrenteNombre: 'frente.jpg', fotoCedulaReversoNombre: 'reverso.jpg', fotoSelfieNombre: 'selfie.jpg',
    }),
  })
  const created = await createRes.json()
  console.log('Status:', createRes.status)
  console.log('Response:', JSON.stringify(created, null, 2))

  if (!created.success) {
    console.error('FAIL: no se pudo crear')
    return
  }
  const solicitudId = created.data.id
  console.log('\n=== 2. GET listar solicitudes PENDIENTE ===')
  const listRes = await fetch(`${BASE}/api/solicitudes-nuevos-clientes?estado=PENDIENTE`)
  const listed = await listRes.json()
  console.log('Total pendientes:', listed.resumen.pendientes)
  console.log('Códigos:', listed.data.map((s) => s.codigo))

  console.log('\n=== 3. GET detalle (con fotos) ===')
  const detRes = await fetch(`${BASE}/api/solicitudes-nuevos-clientes/${solicitudId}`)
  const detalle = await detRes.json()
  console.log('Tiene fotoCedulaFrente:', !!detalle.data.fotoCedulaFrente, 'len:', detalle.data.fotoCedulaFrente?.length)
  console.log('Tiene fotoCedulaReverso:', !!detalle.data.fotoCedulaReverso, 'len:', detalle.data.fotoCedulaReverso?.length)
  console.log('Tiene fotoSelfie:', !!detalle.data.fotoSelfie, 'len:', detalle.data.fotoSelfie?.length)
  console.log('IP origen:', detalle.data.ipOrigen)
  console.log('User-Agent:', detalle.data.userAgent?.substring(0, 60))

  console.log('\n=== 4. Limpiar: borrar la solicitud de prueba ===')
  // No hay DELETE en la API, así que la dejamos como prueba. El usuario puede rechazarla desde el panel.
  console.log('Solicitud de prueba creada con ID:', solicitudId, '(elimínala desde el panel de administración)')
}

main().catch(e => { console.error(e); process.exit(1) })
