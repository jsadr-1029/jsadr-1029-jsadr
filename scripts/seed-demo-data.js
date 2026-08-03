/**
 * Seed de datos demo para Jsadr
 * Crea categorias, clientes y prestamos usando las propias APIs (respetando toda la logica de negocio).
 *
 * Uso:  node /home/z/my-project/scripts/seed-demo-data.js
 */
const BASE = 'http://localhost:3000'
const ADMIN = { username: 'adm-jsadr', password: 'Js951029*' }

// ---------- helpers ----------
async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  })
  const j = await r.json()
  if (!j.success) throw new Error('Login fallo: ' + JSON.stringify(j))
  return j.data.access_token
}

async function api(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json()
  if (!j.success) {
    throw new Error(`API ${method} ${path} fallo: ${JSON.stringify(j).slice(0, 400)}`)
  }
  return j.data
}

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ---------- datos demo ----------
const CATEGORIAS = [
  { codigo: 'PREMIUM', nombre: 'Cliente Premium', montoMinimo: 5000000, montoMaximo: 50000000, tasaInteresAnual: 24, tasaMoraAnual: 36, descripcion: 'Clientes con historial impecable y salarios altos' },
  { codigo: 'ESTANDAR', nombre: 'Cliente Estandar', montoMinimo: 1000000, montoMaximo: 10000000, tasaInteresAnual: 30, tasaMoraAnual: 48, descripcion: 'Clientes regulares con buen historial' },
  { codigo: 'NUEVO', nombre: 'Cliente Nuevo', montoMinimo: 500000, montoMaximo: 3000000, tasaInteresAnual: 36, tasaMoraAnual: 54, descripcion: 'Primer credito del cliente' },
  { codigo: 'PREFERENCIAL', nombre: 'Cliente Preferencial', montoMinimo: 3000000, montoMaximo: 30000000, tasaInteresAnual: 22, tasaMoraAnual: 33, descripcion: 'Empleados publicos y pensionados' },
]

const CLIENTES = [
  { nombre: 'Carlos Andres Gomez Martinez', cedula: '1020509876', telefono: '3001234567', email: 'carlos.gomez@example.com', departamento: 'Cundinamarca', municipio: 'Bogota', salario: 3500000, direccion: 'Cll 80 #45-23', barrio: 'Suba', bancoCliente: 'Bancolombia', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '0123456789' },
  { nombre: 'Maria Fernanda Lopez Restrepo', cedula: '1037654321', telefono: '3109876543', email: 'maria.lopez@example.com', departamento: 'Antioquia', municipio: 'Medellin', salario: 4200000, direccion: 'Cra 70 #34-56', barrio: 'Laureles', bancoCliente: 'Davivienda', tipoCuentaCliente: 'Corriente', numeroCuentaCliente: '9876543210' },
  { nombre: 'Javier Esteban Ruiz Ospina', cedula: '1098765432', telefono: '3152345678', email: 'javier.ruiz@example.com', departamento: 'Valle del Cauca', municipio: 'Cali', salario: 2800000, direccion: 'Cll 5 #12-34', barrio: 'Granada', bancoCliente: 'Banco de Bogota', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '4567890123' },
  { nombre: 'Diana Carolina Torres Vargas', cedula: '1122334455', telefono: '3203456789', email: 'diana.torres@example.com', departamento: 'Atlantico', municipio: 'Barranquilla', salario: 3800000, direccion: 'Cra 51 #78-90', barrio: 'Boston', bancoCliente: 'Bancolombia', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '7890123456' },
  { nombre: 'Andres Felipe Castro Naranjo', cedula: '1155667788', telefono: '3144567890', email: 'andres.castro@example.com', departamento: 'Caldas', municipio: 'Manizales', salario: 2500000, direccion: 'Cll 23 #45-67', barrio: 'Chipre', bancoCliente: 'BBVA', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '2345678901' },
  { nombre: 'Laura Sofia Mendoza Perez', cedula: '1199887766', telefono: '3215678901', email: 'laura.mendoza@example.com', departamento: 'Risaralda', municipio: 'Pereira', salario: 4500000, direccion: 'Av 30 de Agosto #65-12', barrio: 'Boston', bancoCliente: 'Davivienda', tipoCuentaCliente: 'Corriente', numeroCuentaCliente: '6789012345' },
  { nombre: 'Sergio Alberto Mendez Londoño', cedula: '1012345678', telefono: '3006789012', email: 'sergio.mendez@example.com', departamento: 'Antioquia', municipio: 'Envigado', salario: 3200000, direccion: 'Cll 40 Sur #30-15', barrio: 'Loma del Escobero', bancoCliente: 'Bancolombia', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '3456789012' },
  { nombre: 'Paola Andrea Cardona Saldarriaga', cedula: '1098765432', telefono: '3117890123', email: 'paola.cardona@example.com', departamento: 'Quindio', municipio: 'Armenia', salario: 2700000, direccion: 'Cra 14 #20-30', barrio: 'Centro', bancoCliente: 'Banco Agrario', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '4567890123' },
  { nombre: 'Juan David Velasquez Betancur', cedula: '1015263849', telefono: '3128901234', email: 'juan.velasquez@example.com', departamento: 'Tolima', municipio: 'Ibague', salario: 3900000, direccion: 'Cll 44 #23-45', barrio: 'Interpolar', bancoCliente: 'Bancolombia', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '5678901234' },
  { nombre: 'Claudia Patricia Henao Restrepo', cedula: '1058493012', telefono: '3139012345', email: 'claudia.henao@example.com', departamento: 'Caldas', municipio: 'Manizales', salario: 5500000, direccion: 'Av Santander #12-34', barrio: 'Fatima', bancoCliente: 'BBVA', tipoCuentaCliente: 'Corriente', numeroCuentaCliente: '6789012345' },
  { nombre: 'Mateo Ramirez Quintero', cedula: '1145263890', telefono: '3140123456', email: 'mateo.ramirez@example.com', departamento: 'Bolivar', municipio: 'Cartagena', salario: 3000000, direccion: 'Cll 30 #14-23', barrio: 'Manga', bancoCliente: 'Bancolombia', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '7890123456' },
  { nombre: 'Valentina Gutierrez Marin', cedula: '1183940261', telefono: '3151234567', email: 'valentina.gutierrez@example.com', departamento: 'Norte de Santander', municipio: 'Cucuta', salario: 3400000, direccion: 'Av 0 #5-23', barrio: 'La Libertad', bancoCliente: 'Davivienda', tipoCuentaCliente: 'Ahorros', numeroCuentaCliente: '8901234567' },
]

// ---------- main ----------
async function main() {
  console.log('=== Seed de datos demo para Jsadr ===\n')
  const token = await login()
  console.log('[OK] Login como adm-jsadr\n')

  // 1) Categorias
  console.log('>> Creando categorias...')
  const categoriasCreadas = []
  for (const c of CATEGORIAS) {
    // Verificar si ya existe por codigo
    const r = await fetch(`${BASE}/api/categorias`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = await r.json()
    const existente = (j.data || []).find(x => x.codigo === c.codigo)
    if (existente) {
      categoriasCreadas.push(existente)
      console.log(`  - ${c.codigo} ya existe`)
      continue
    }
    try {
      const creada = await api('POST', '/api/categorias', token, { ...c, activa: true })
      categoriasCreadas.push(creada)
      console.log(`  + ${c.codigo}: ${c.nombre}`)
    } catch (e) {
      console.log(`  ! ${c.codigo}: ${e.message.slice(0, 120)}`)
    }
  }
  console.log(`  Total: ${categoriasCreadas.length} categorias\n`)

  // 2) Clientes
  console.log('>> Creando clientes...')
  const clientesCreados = []
  for (const c of CLIENTES) {
    try {
      const cliente = await api('POST', '/api/clientes', token, c)
      clientesCreados.push(cliente)
      console.log(`  + ${cliente.nombre} (cc ${cliente.cedula})`)
    } catch (e) {
      // Probablemente ya existe; buscar por cedula
      const msg = e.message
      if (msg.includes('Ya existe')) {
        const all = await api('GET', '/api/clientes', token)
        const found = all.find(x => x.cedula === c.cedula)
        if (found) {
          clientesCreados.push(found)
          console.log(`  - ${found.nombre} ya existia`)
          continue
        }
      }
      console.log(`  ! ${c.nombre}: ${msg.slice(0, 120)}`)
    }
  }
  console.log(`  Total: ${clientesCreados.length} clientes\n`)

  // 3) Prestamos - usar distintas modalidades y estados
  console.log('>> Creando prestamos...')
  const FRECUENCIAS = ['MENSUAL', 'QUINCENAL', 'SEMANAL']
  let prestamosCreados = 0
  for (let i = 0; i < clientesCreados.length; i++) {
    const cliente = clientesCreados[i]
    const cat = categoriasCreadas[i % categoriasCreadas.length]
    const nPrestamos = randInt(1, 2) // 1 o 2 prestamos por cliente
    for (let k = 0; k < nPrestamos; k++) {
      const montoPrincipal = randItem([500000, 1000000, 1500000, 2000000, 3000000, 5000000])
      const tasaInteresAnual = cat.tasaInteresAnual
      const plazoMeses = randItem([6, 12, 18, 24])
      const frecuencia = randItem(FRECUENCIAS)
      try {
        const p = await api('POST', '/api/prestamos', token, {
          clienteId: cliente.id,
          montoPrincipal: montoPrincipal.toString(),
          tasaInteresAnual: tasaInteresAnual.toString(),
          tasaMoraAnual: cat.tasaMoraAnual.toString(),
          plazoMeses: plazoMeses.toString(),
          frecuencia,
          requiereDocumentos: true,
          generarPagare: true,
          generarCarta: false,
          notas: 'Prestamo demo creado por seed',
          categoriaId: cat.id,
          // No aprobarTyc -> estado SOLICITUD
        })
        prestamosCreados++
        console.log(`  + ${p.codigo} - ${cliente.nombre.split(' ').slice(0,2).join(' ')} - $${montoPrincipal.toLocaleString()} ${frecuencia} ${plazoMeses}m`)
      } catch (e) {
        console.log(`  ! prestamo ${cliente.nombre}: ${e.message.slice(0, 120)}`)
      }
    }
  }
  console.log(`  Total: ${prestamosCreados} prestamos creados\n`)

  // 4) Verificacion final
  console.log('=== Verificacion ===')
  const cats = await api('GET', '/api/categorias', token)
  const cls = await api('GET', '/api/clientes', token)
  const ps = await api('GET', '/api/prestamos', token)
  console.log(`  Categorias: ${cats.length}`)
  console.log(`  Clientes:   ${cls.length}`)
  console.log(`  Prestamos:  ${ps.length}`)
  console.log('\n=== Seed completado ===')
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
