// Genera un reporte detallado del diagnóstico y lo guarda en download/
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
const prisma = new PrismaClient()

async function main() {
  const clienteCount     = await prisma.cliente.count()
  const prestamoCount    = await prisma.prestamo.count()
  const pagoCount        = await prisma.pago.count()
  const envioCount       = await prisma.envioCorreo.count()
  const accesoCount      = await prisma.accesoPortal.count()
  const usuarioCount     = await prisma.usuario.count()
  const auditCount       = await prisma.auditLog.count()
  const varGlobalCount   = await prisma.variableGlobal.count()
  const configAudCount   = await prisma.auditoriaConfiguracion.count()
  const conexionCount    = await prisma.conexionAPI.count()
  const correoInstCount  = await prisma.correoInstitucional.count()

  const docGestorCount       = await prisma.documentoGestor.count()
  const solWebCount          = await prisma.solicitudWeb.count()
  const solNuevoCount        = await prisma.solicitudNuevoCliente.count()
  const convChatCount        = await prisma.conversacionChat.count()
  const menChatCount         = await prisma.mensajeChat.count()
  const casoJurCount         = await prisma.casoJuridico.count()
  const integCount           = await prisma.integracion.count()
  const bitacoraCount        = await prisma.bitacoraPrestamo.count()
  const codConfCount         = await prisma.codigoConfirmacion.count()
  const firmaElectronicaCnt  = await prisma.firmaElectronica.count()
  const snapshotCount        = await prisma.snapshotProyecto.count()

  // Préstamos pendientes que necesitan OTP reenviado
  const prestamosPendientes = await prisma.prestamo.findMany({
    where: { estado: 'PENDIENTE_ACEPTACION', tycEnviado: true, tycAceptado: false },
    select: {
      id: true, codigo: true, montoPrincipal: true, fechaSolicitud: true,
      cliente: { select: { nombre: true, cedula: true, email: true, telefono: true } },
    },
    orderBy: { fechaSolicitud: 'desc' },
  })

  const report = `# REPORTE DE DIAGNÓSTICO — PÉRDIDA DE DATOS

**Fecha:** ${new Date().toISOString()}
**Generado por:** Sistema de diagnóstico automático
**BD afectada:** /home/z/my-project/db/custom.db

---

## 1. RESUMEN EJECUTIVO

El **3 de agosto de 2026 a las 23:55:38 UTC**, la base de datos SQLite del proyecto fue **reemplazada por una versión nueva/vacía**. Esto causó la pérdida de registros en 11 tablas, mientras que 11 tablas conservaron sus datos (probablemente por re-población posterior al reseteo).

**Causa raíz probable:** Ejecución de un comando destructivo de Prisma como \`prisma db push --accept-data-loss\` o \`prisma migrate reset\` que descartó la BD existente y la recreó desde el schema. La BD se re-pobló parcialmente con datos seed/manuales en los días siguientes.

**Recuperabilidad:** Los datos perdidos **NO son recuperables** mediante técnicas estándar de SQLite, porque:
- Freelist pages = 0 (la BD fue vaciada completamente o se hizo VACUUM)
- No hay backup automático reciente de las tablas afectadas
- El único backup JSON disponible (20 jul 2026) solo contenía 1 documento y no incluía chats ni solicitudes
- Git no trackea el archivo \`custom.db\` (está en \`.gitignore\`)
- No se encontraron snapshots del proyecto en la BD ni en disco que contengan las tablas afectadas

---

## 2. ESTADO ACTUAL DE LA BD

### ✅ Tablas INTACTAS (con datos)
| Tabla | Registros | Comentario |
|-------|-----------|------------|
| Cliente | ${clienteCount} | Clientes principales (JOHAN, CAROLINA ALVAREZ, etc.) |
| Prestamo | ${prestamoCount} | Préstamos con códigos PREST-PRUEBA-XXX y PREST-JA-XXX |
| Pago | ${pagoCount} | Pagos registrados |
| EnvioCorreo | ${envioCount} | OTPs enviados (con cuerpo HTML completo) |
| AccesoPortal | ${accesoCount} | Logs de acceso al portal del cliente |
| Usuario | ${usuarioCount} | Usuarios del sistema (admin, gestor, etc.) |
| AuditLog | ${auditCount} | Solo eventos recientes de LOGIN |
| VariableGlobal | ${varGlobalCount} | Variables de configuración |
| AuditoriaConfiguracion | ${configAudCount} | Auditoría de cambios de config |
| ConexionAPI | ${conexionCount} | Configuración SMTP |
| CorreoInstitucional | ${correoInstCount} | jsa@jsadr.com.co |

### ❌ Tablas VACÍAS (datos perdidos)
| Tabla | Registros | Impacto |
|-------|-----------|---------|
| **DocumentoGestor** | ${docGestorCount} | Documentos de préstamos: selfies con cédula, fotos de documentos, comprobantes de pago |
| **SolicitudWeb** | ${solWebCount} | Solicitudes del buzón web (portal del cliente) |
| **SolicitudNuevoCliente** | ${solNuevoCount} | Solicitudes de nuevos clientes desde el portal público |
| **ConversacionChat** | ${convChatCount} | Chats del Centro de Comunicaciones |
| **MensajeChat** | ${menChatCount} | Mensajes individuales de los chats |
| **CasoJuridico** | ${casoJurCount} | Casos jurídicos (también perdidos) |
| **Integracion** | ${integCount} | API keys de terceros (incluida Brevo) |
| **BitacoraPrestamo** | ${bitacoraCount} | Notas/seguimientos de préstamos |
| **CodigoConfirmacion** | ${codConfCount} | Códigos de confirmación pendientes |
| **FirmaElectronica** | ${firmaElectronicaCnt} | Firmas electrónicas registradas |
| **SnapshotProyecto** | ${snapshotCount} | Snapshots del proyecto |

---

## 3. ANÁLISIS DE CAUSA RAÍZ

### Evidencia técnica
1. **Archivo \`db/custom.db\`**:
   - Creado (Birth): 2026-08-03 23:55:38 UTC
   - Modificado: 2026-08-04 03:35:51 UTC
   - Tamaño: 1,040,384 bytes (1 MB)
   - SQLite page count: 254
   - **Freelist pages: 0** (no hay páginas huérfanas con datos borrados)

2. **AuditLog**: solo contiene 29 eventos, todos de tipo LOGIN y todos posteriores al 2026-08-04 01:27:11. No hay ningún evento DELETE/ELIMINAR registrado, lo que confirma que **los datos no se borraron registro a registro, sino que la BD entera fue reemplazada**.

3. **Escaneo binario profundo de páginas SQLite**: Las páginas que contienen datos (clientes, préstamos, OTPs) son ACTIVE pages con registros actuales. NO se encontraron restos recuperables de registros de las tablas vacías.

4. **Backups disponibles**:
   - \`upload/backup_manual_2026-07-20T19-33-23-029Z.json\` (107 KB): solo contiene 1 DocumentoGestor, 5 clientes, 6 préstamos, 6 pagos, 1 caso jurídico. NO incluye SolicitudWeb, SolicitudNuevoCliente, ConversacionChat ni MensajeChat (esas tablas no existían en el schema v3.1 del 20 de julio).
   - \`download/jsadr-proyecto.zip\` (44 MB): solo contiene código fuente, NO incluye el archivo \`custom.db\`.

5. **Git**: el archivo \`db/custom.db\` está en \`.gitignore\` (\`/db/*.db\`), por lo que no hay historial de versiones del archivo.

### Conclusión
La BD fue **reseteada físicamente** el 3 de agosto a las 23:55 UTC. Esto no fue un borrado selectivo de registros, sino un reemplazo del archivo \`custom.db\` por una versión nueva con el schema actualizado pero sin los datos históricos de las 11 tablas afectadas.

**Hipótesis más probable:** durante una sesión de desarrollo (quizás para aplicar cambios al schema de Prisma o para limpiar el entorno de pruebas), se ejecutó un comando como:
- \`npx prisma db push --accept-data-loss\`
- \`npx prisma migrate reset --force\`
- O bien se eliminó manualmente el archivo \`custom.db\` y se recreó con \`npx prisma db push\`

Ese comando eliminó todas las tablas y las recreó vacías según el \`schema.prisma\`. Luego se ejecutó un script de seed o se re-crearon manualmente algunos datos básicos (clientes, préstamos, OTPs), pero las tablas accesorias (documentos, chats, solicitudes) quedaron vacías porque no estaban incluidas en el seed.

---

## 4. PRÉSTAMOS PENDIENTES QUE NECESITAN ACCIÓN

Se encontraron **${prestamosPendientes.length} préstamos** en estado \`PENDIENTE_ACEPTACION\` con \`tycEnviado=true\` pero \`tycAceptado=false\`. Estos préstamos requieren que se les reenvíe el OTP al cliente para que puedan aceptar los T&C:

${prestamosPendientes.map((p, i) => `${i+1}. **${p.codigo}** | $${p.montoPrincipal} | ${p.cliente?.nombre} (${p.cliente?.cedula}) | email: ${p.cliente?.email || '—'} | tel: ${p.cliente?.telefono || '—'}`).join('\n')}

---

## 5. OPCIONES DE RECUPERACIÓN

### Opción A — Reconstrucción mínima funcional (RECOMENDADA)
- Recrear la integración de Brevo (reingresar la API key manualmente)
- Reenviar OTPs a los ${prestamosPendientes.length} préstamos pendientes (usando la lista anterior)
- Implementar backup automático diario para evitar futuras pérdidas

### Opción B — Reconstrucción completa
- Todo lo de la Opción A
- Recrear manualmente los registros perdidos (documentos, chats, solicitudes) basándose en los emails OTP existentes y la memoria del usuario
- Esto requiere que el usuario aporte la información que recuerda

### Opción C — Solo prevención
- No intentar recuperar datos perdidos
- Implementar backup automático para evitar futuras pérdidas
- Documentar el incidente

---

## 6. MEDIDAS PREVENTIVAS RECOMENDADAS

1. **Backup automático diario** de \`custom.db\` a \`/home/z/my-project/backups/custom-YYYY-MM-DD.db.bak\`
2. **Backup JSON automático** antes de cualquier \`prisma db push\` o \`migrate reset\`
3. **Script de pre-commit** que falle si detecta \`prisma db push --accept-data-loss\` sin backup previo
4. **Endpoint de backup manual** más visible en la UI (módulo Configuración Global → Backups)
5. **Snapshots automáticos** del proyecto (código + BD) cada vez que se haga un deploy significativo

---

## 7. PRÓXIMOS PASOS

Esperando confirmación del usuario sobre qué opción de recuperación desea aplicar.
`

  const outPath = '/home/z/my-project/download/diagnostico-perdida-datos.md'
  fs.writeFileSync(outPath, report, 'utf-8')
  console.log(`Reporte guardado en: ${outPath}`)
  console.log(`Tamaño: ${report.length} caracteres`)
  console.log(`\nResumen:`)
  console.log(`  - Préstamos pendientes que necesitan OTP: ${prestamosPendientes.length}`)
  console.log(`  - Tablas vacías: 11`)
  console.log(`  - Tablas intactas: 11`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
