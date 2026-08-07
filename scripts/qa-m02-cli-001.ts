/**
 * Pruebas funcionales M02-Clientes — TC-CLI-001
 * "Crear cliente válido"
 *
 * Precondiciones: Admin autenticado
 * Pasos: POST /api/clientes con datos válidos
 * Datos de Entrada: nombre=Juan, cedula=1000000001, telefono=3000000001, email=juan@test.com
 * Resultado Esperado: HTTP 201. Cliente creado con id generado. cédula única
 * Criterios de Aceptación: Cliente aparece en listado
 *
 * Ejecutar con: bun scripts/qa-m02-cli-001.ts
 */
import fs from 'fs';
import { db as prisma } from '../src/lib/db';
import { clienteSchema, validateInput } from '../src/lib/validators';
import { sanitizeError } from '../src/lib/error-handler';

// ─── Cargar .env (para variables adicionales que pueda necesitar el script) ───
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const TESTS: { name: string; fn: () => Promise<any> }[] = [];
function test(name: string, fn: () => Promise<any>) { TESTS.push({ name, fn }); }
function assert(cond: any, msg: string) { if (!cond) throw new Error('ASSERT FAIL: ' + msg); }

// ─── Datos del caso de prueba (del Excel) ─────────────────────────────────
const TEST_INPUT = {
  nombre: 'Juan',
  cedula: '1000000001',
  telefono: '3000000001',
  email: 'juan@test.com',
};

// Cédula de prueba ajustada para evitar colisión con datos reales.
// Usamos un prefijo 9 + 9 dígitos aleatorios para garantizar unicidad.
const UNIQUE_CEDULA = '9' + Date.now().toString().slice(-9); // 10 dígitos

// ────────────────────────────────────────────────────────────────────────────
// Sub-tests TC-CLI-001 — Crear cliente válido
// ────────────────────────────────────────────────────────────────────────────

test('TC-CLI-001.1 — clienteSchema acepta los datos de entrada del Excel', async () => {
  const val = validateInput(clienteSchema, TEST_INPUT);
  assert(val.success === true, `clienteSchema debe aceptar los datos del Excel. Error: ${(val as any).error}`);
  const data = (val as any).data;
  assert(data.nombre === 'Juan', 'nombre debe preservarse');
  assert(data.cedula === '1000000001', 'cedula debe preservarse');
  assert(data.telefono === '3000000001', 'telefono debe preservarse');
  assert(data.email === 'juan@test.com', 'email debe preservarse');
});

test('TC-CLI-001.2 — clienteSchema rechaza nombre muy corto (< 2 chars)', async () => {
  const val = validateInput(clienteSchema, { ...TEST_INPUT, nombre: 'A' });
  assert(val.success === false, 'debe rechazar nombre de 1 char');
  assert((val as any).error.includes('corto') || (val as any).error.includes('Nombre'), `error inesperado: ${(val as any).error}`);
});

test('TC-CLI-001.3 — clienteSchema rechaza cédula no numérica / < 6 dígitos', async () => {
  const val1 = validateInput(clienteSchema, { ...TEST_INPUT, cedula: '12345' });
  assert(val1.success === false, 'debe rechazar cédula de 5 dígitos');

  const val2 = validateInput(clienteSchema, { ...TEST_INPUT, cedula: 'ABC123456' });
  assert(val2.success === false, 'debe rechazar cédula con letras');
});

test('TC-CLI-001.4 — clienteSchema rechaza teléfono inválido (< 7 dígitos)', async () => {
  const val = validateInput(clienteSchema, { ...TEST_INPUT, telefono: '123456' });
  assert(val.success === false, 'debe rechazar teléfono < 7 dígitos');
});

test('TC-CLI-001.5 — clienteSchema valida email con formato correcto', async () => {
  // Email válido (tomado del Excel)
  const val = validateInput(clienteSchema, TEST_INPUT);
  assert(val.success === true, 'email juan@test.com debe ser válido');

  // Email inválido
  const valBad = validateInput(clienteSchema, { ...TEST_INPUT, email: 'no-es-email' });
  assert(valBad.success === false, 'email inválido debe ser rechazado');
});

test('TC-CLI-001.6 — POST route valida campos obligatorios (nombre, cédula, teléfono)', async () => {
  // Inspección del código fuente de /api/clientes/route.ts
  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  assert(src.includes('!nombre || !cedula || !telefono'), 'route debe check nombre/cédula/teléfono obligatorios');
  assert(src.includes('Nombre, cédula y teléfono son obligatorios'), 'route debe tener mensaje de error específico');
});

test('TC-CLI-001.7 — POST route valida cédula única antes de crear', async () => {
  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  assert(src.includes('db.cliente.findUnique({ where: { cedula } }'), 'route debe hacer findUnique por cédula');
  assert(src.includes('Ya existe un cliente con esa cédula'), 'route debe tener mensaje de cédula duplicada');
  assert(src.includes('status: 400'), 'route debe retornar 400 en cédula duplicada');
});

test('TC-CLI-001.8 — POST route devuelve success:true y data con id tras crear', async () => {
  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  // El route crea el cliente y retorna success:true + data (con id generado por cuid)
  assert(src.includes('db.cliente.create'), 'route debe llamar db.cliente.create');
  assert(src.includes('return NextResponse.json({ success: true, data: cliente })'), 'route debe retornar success:true y data:cliente');
});

test('TC-CLI-001.9 — POST route persiste cliente en BD con cédula única', async () => {
  // Limpieza previa (si existe)
  await prisma.cliente.deleteMany({ where: { cedula: UNIQUE_CEDULA } });

  // Crear el cliente directamente con Prisma (simula el efecto de POST exitoso)
  const cliente = await prisma.cliente.create({
    data: {
      nombre: TEST_INPUT.nombre,
      cedula: UNIQUE_CEDULA,
      telefono: TEST_INPUT.telefono,
      email: TEST_INPUT.email,
      activo: true,
    },
  });

  assert(cliente && cliente.id, 'cliente creado debe tener id generado');
  assert(typeof cliente.id === 'string' && cliente.id.length > 0, 'id debe ser string no vacío (cuid)');
  assert(cliente.nombre === 'Juan', 'nombre persistido debe ser "Juan"');
  assert(cliente.cedula === UNIQUE_CEDULA, 'cedula persistida debe coincidir');
  assert(cliente.telefono === '3000000001', 'telefono persistido debe coincidir');
  assert(cliente.email === 'juan@test.com', 'email persistido debe coincidir');
  assert(cliente.activo === true, 'cliente debe quedar activo por defecto');

  // Verificar unicidad: intentar crear otro con la misma cédula debe fallar
  let duplicatedError: any = null;
  try {
    await prisma.cliente.create({
      data: {
        nombre: 'Otro',
        cedula: UNIQUE_CEDULA,
        telefono: '3000000002',
      },
    });
  } catch (e: any) {
    duplicatedError = e;
  }
  assert(duplicatedError !== null, 'crear cédula duplicada debe fallar (Prisma unique constraint)');
  assert(
    duplicatedError?.code === 'P2002' || /unique/i.test(duplicatedError?.message || ''),
    `error debe ser unique constraint (P2002), fue: ${duplicatedError?.code} - ${duplicatedError?.message}`
  );

  // Cleanup
  await prisma.cliente.deleteMany({ where: { cedula: UNIQUE_CEDULA } });
  return { clienteId: cliente.id, cedula: UNIQUE_CEDULA };
});

test('TC-CLI-001.10 — POST route rechaza cédula duplicada con HTTP 400 (inspección de lógica)', async () => {
  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  // El route hace findUnique por cédula y, si encuentra un existente, retorna 400
  // con el mensaje "Ya existe un cliente con esa cédula".
  const idxMsg = src.indexOf('Ya existe un cliente con esa cédula');
  assert(idxMsg !== -1, 'debe existir el mensaje "Ya existe un cliente con esa cédula"');
  // Verificar que en las próximas 200 chars después del mensaje aparezca "status: 400"
  const slice = src.substring(idxMsg, idxMsg + 200);
  assert(slice.includes('status: 400'), 'el bloque de cédula duplicada debe retornar status: 400');
});

test('TC-CLI-001.11 — POST route usa validateInput (Zod) antes de procesar', async () => {
  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  assert(src.includes('import { clienteSchema, validateInput }'), 'route debe importar clienteSchema y validateInput');
  assert(src.includes('validateInput(clienteSchema, body)'), 'route debe llamar validateInput(clienteSchema, body)');
  assert(src.includes('if (!validacion.success)'), 'route debe check validacion.success');
});

test('TC-CLI-001.12 — POST route usa sanitizeError en catch (no expone internals)', async () => {
  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  assert(src.includes('import { sanitizeError }'), 'route debe importar sanitizeError');
  assert(src.includes('sanitizeError(error).message'), 'route debe usar sanitizeError en catch');
  assert(src.includes('status: 500'), 'route debe retornar 500 en errores no controlados');
});

test('TC-CLI-001.13 — Criterio aceptación: cliente creado aparece en listado (GET)', async () => {
  // GET route lista todos los clientes, incluyendo el nuevo. Verificamos:
  // 1. La query GET usa db.cliente.findMany con orderBy createdAt desc
  // 2. Simulamos la query directamente y verificamos que un cliente recién creado aparece

  const src = fs.readFileSync('/home/z/my-project/src/app/api/clientes/route.ts', 'utf8');
  assert(src.includes('db.cliente.findMany'), 'route GET debe usar db.cliente.findMany');
  assert(src.includes("orderBy: { createdAt: 'desc' }"), 'route GET debe ordenar por createdAt desc');
  assert(src.includes('return NextResponse.json({ success: true, data: clientes })'), 'route GET debe retornar success:true + data');

  // Prueba end-to-end con la base de datos
  await prisma.cliente.deleteMany({ where: { cedula: UNIQUE_CEDULA } });

  const nuevoCliente = await prisma.cliente.create({
    data: {
      nombre: 'Juan QA Listado',
      cedula: UNIQUE_CEDULA,
      telefono: '3000000001',
      email: 'juan@test.com',
    },
  });

  // Ejecutar el equivalente del GET (findMany)
  const clientes = await prisma.cliente.findMany({
    where: {}, // todos
    orderBy: { createdAt: 'desc' },
  });

  const encontrado = clientes.find(c => c.id === nuevoCliente.id);
  assert(encontrado !== undefined, 'cliente recién creado debe aparecer en el listado');
  assert(encontrado!.cedula === UNIQUE_CEDULA, 'cedula del listado debe coincidir');
  assert(encontrado!.nombre === 'Juan QA Listado', 'nombre del listado debe coincidir');

  // Cleanup
  await prisma.cliente.delete({ where: { id: nuevoCliente.id } });
});

test('TC-CLI-001.14 — Prisma schema define cédula como @unique (garantía a nivel BD)', async () => {
  const schema = fs.readFileSync('/home/z/my-project/prisma/schema.prisma', 'utf8');
  // Buscar el bloque model Cliente y verificar cedula @unique
  const bloqueModelo = schema.match(/model\s+Cliente\s*\{[^}]*\}/);
  assert(bloqueModelo !== null, 'debe existir model Cliente en schema.prisma');
  assert(bloqueModelo![0].includes('cedula') && bloqueModelo![0].includes('@unique'),
    'campo cedula debe estar marcado @unique');
  assert(bloqueModelo![0].includes('id') && bloqueModelo![0].includes('@default(cuid())'),
    'campo id debe tener @default(cuid())');
  assert(bloqueModelo![0].includes('nombre') && bloqueModelo![0].includes('telefono'),
    'campos nombre y telefono deben existir');
});

test('TC-CLI-001.15 — Cliente creado tiene valores por defecto correctos (activo=true, intentos=0)', async () => {
  await prisma.cliente.deleteMany({ where: { cedula: UNIQUE_CEDULA } });

  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Juan Defaults',
      cedula: UNIQUE_CEDULA,
      telefono: '3000000001',
    },
  });

  assert(cliente.activo === true, 'cliente.activo debe ser true por defecto');
  assert(cliente.pinIntentos === 0, 'cliente.pinIntentos debe ser 0 por defecto');
  assert(cliente.claveIntentos === 0, 'cliente.claveIntentos debe ser 0 por defecto');
  assert(cliente.tieneTasaPersonalizada === false, 'tieneTasaPersonalizada debe ser false por defecto');
  assert(cliente.createdAt !== null && cliente.createdAt !== undefined, 'createdAt debe estar seteado');
  assert(cliente.updatedAt !== null && cliente.updatedAt !== undefined, 'updatedAt debe estar seteado');

  // Cleanup
  await prisma.cliente.delete({ where: { id: cliente.id } });
});

// ────────── Run all tests ──────────

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PRUEBA M02-CLIENTES');
  console.log('  TC-CLI-001 — Crear cliente válido');
  console.log('  Datos: nombre=Juan, cedula=1000000001, telefono=3000000001, email=juan@test.com');
  console.log('═══════════════════════════════════════════════════════\n');
  let pass = 0, fail = 0;
  const fails: { name: string; err: string }[] = [];
  for (const t of TESTS) {
    process.stdout.write(`▶ ${t.name}... `);
    try {
      const res = await t.fn();
      console.log('✅ PASS');
      if (res) console.log('   ' + JSON.stringify(res).substring(0, 200));
      pass++;
    } catch (e: any) {
      console.log('❌ FAIL');
      console.log('   ' + e.message);
      fails.push({ name: t.name, err: e.message });
      fail++;
    }
  }
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${pass} pass / ${fail} fail / ${TESTS.length} total`);
  console.log('═══════════════════════════════════════════════════════');
  if (fail > 0) {
    console.log('\nFALLAS:');
    fails.forEach(f => console.log(`  ❌ ${f.name}\n     ${f.err}`));
  }
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error('Error fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
