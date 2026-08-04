/**
 * Restauración COMPLETA desde Neon (producción) → SQLite (local)
 *
 * Tablas a restaurar (basado en diagnóstico de pérdida):
 *   - DocumentoGestor      (3 registros en Neon)  → Préstamos > Documentos
 *   - SolicitudWeb         (1 registro)           → Buzón Web
 *   - SolicitudNuevoCliente (0 en Neon, intentar igual)
 *   - ConversacionChat     (6 registros)          → Comunicaciones
 *   - MensajeChat          (20 registros)
 *   - BitacoraPrestamo     (42 registros)
 *   - CodigoConfirmacion   (8 registros)
 *   - FirmaElectronica     (24 registros)
 *   - SnapshotProyecto     (14 registros)
 *   - AuditoriaConfiguracion (13 vs 2 locales)
 *   - Integracion          (0 en Neon, intentar igual)
 *   - CasoJuridico         (1 registro)
 *
 * Estrategia: upsert por id, preservando el id original de Neon.
 * Fecha: 2026-08-04
 */

const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

function toDate(v) {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

function toInt(v) {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

function toBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1' || v === 't';
}

function safeJson(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return null; }
}

(async () => {
  console.log('=== RESTAURACIÓN COMPLETA Neon → SQLite ===\n');
  await neonClient.connect();
  console.log('✓ Conectado a Neon\n');

  // ====================================================================
  // 1. DocumentoGestor (Préstamos → Documentos)
  // ====================================================================
  console.log('▶ 1/12) DocumentoGestor');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "DocumentoGestor" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      await prisma.documentoGestor.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          prestamoId: r.prestamoId,
          clienteId: r.clienteId,
          tipo: r.tipo,
          titulo: r.titulo,
          descripcion: r.descripcion,
          archivoBase64: r.archivoBase64,
          archivoNombre: r.archivoNombre,
          archivoTipo: r.archivoTipo,
          archivoTamano: toInt(r.archivoTamano),
          subidoPor: r.subidoPor,
          fechaSubida: toDate(r.fechaSubida),
          createdAt: toDate(r.createdAt),
        },
        update: {
          prestamoId: r.prestamoId,
          clienteId: r.clienteId,
          tipo: r.tipo,
          titulo: r.titulo,
          descripcion: r.descripcion,
          archivoBase64: r.archivoBase64,
          archivoNombre: r.archivoNombre,
          archivoTipo: r.archivoTipo,
          archivoTamano: toInt(r.archivoTamano),
          subidoPor: r.subidoPor,
          fechaSubida: toDate(r.fechaSubida),
        },
      });
      count++;
      console.log(`  + ${r.id} | tipo=${r.tipo} | ${r.archivoNombre} (${r.archivoTamano} bytes)`);
    }
    console.log(`  Total: ${count} documentos restaurados\n`);
  }

  // ====================================================================
  // 2. SolicitudWeb (Buzón Web)
  // ====================================================================
  console.log('▶ 2/12) SolicitudWeb');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "SolicitudWeb" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      await prisma.solicitudWeb.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          codigo: r.codigo,
          clienteId: r.clienteId,
          clienteNombre: r.clienteNombre,
          clienteCedula: r.clienteCedula,
          clienteTelefono: r.clienteTelefono,
          clienteEmail: r.clienteEmail,
          valorSolicitado: r.valorSolicitado,
          numeroCuotas: toInt(r.numeroCuotas),
          frecuencia: r.frecuencia,
          tasaUtilizada: r.tasaUtilizada,
          tasaOrigen: r.tasaOrigen,
          cuotaEstimada: r.cuotaEstimada,
          totalIntereses: r.totalIntereses,
          totalPagar: r.totalPagar,
          primerPagoFecha: toDate(r.primerPagoFecha),
          tablaAmortizacion: r.tablaAmortizacion,
          fechaCreacion: toDate(r.fechaCreacion),
          ipOrigen: r.ipOrigen,
          dispositivo: r.dispositivo,
          navegador: r.navegador,
          canalOrigen: r.canalOrigen,
          estado: r.estado,
          observaciones: r.observaciones,
          revisadoPor: r.revisadoPor,
          fechaRevision: toDate(r.fechaRevision),
          prestamoCreadoId: r.prestamoCreadoId,
          fechaConversion: toDate(r.fechaConversion),
          historialEstados: r.historialEstados,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
        update: {
          clienteId: r.clienteId,
          clienteNombre: r.clienteNombre,
          clienteCedula: r.clienteCedula,
          clienteTelefono: r.clienteTelefono,
          clienteEmail: r.clienteEmail,
          valorSolicitado: r.valorSolicitado,
          numeroCuotas: toInt(r.numeroCuotas),
          frecuencia: r.frecuencia,
          tasaUtilizada: r.tasaUtilizada,
          tasaOrigen: r.tasaOrigen,
          cuotaEstimada: r.cuotaEstimada,
          totalIntereses: r.totalIntereses,
          totalPagar: r.totalPagar,
          primerPagoFecha: toDate(r.primerPagoFecha),
          tablaAmortizacion: r.tablaAmortizacion,
          fechaCreacion: toDate(r.fechaCreacion),
          ipOrigen: r.ipOrigen,
          dispositivo: r.dispositivo,
          navegador: r.navegador,
          canalOrigen: r.canalOrigen,
          estado: r.estado,
          observaciones: r.observaciones,
          revisadoPor: r.revisadoPor,
          fechaRevision: toDate(r.fechaRevision),
          prestamoCreadoId: r.prestamoCreadoId,
          fechaConversion: toDate(r.fechaConversion),
          historialEstados: r.historialEstados,
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
      console.log(`  + ${r.codigo} | ${r.clienteNombre} | ${r.clienteCedula} | $${r.valorSolicitado} | estado=${r.estado}`);
    }
    console.log(`  Total: ${count} solicitudes web restauradas\n`);
  }

  // ====================================================================
  // 3. SolicitudNuevoCliente
  // ====================================================================
  console.log('▶ 3/12) SolicitudNuevoCliente');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "SolicitudNuevoCliente" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.solicitudNuevoCliente.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
            apellido: r.apellido,
            tipoDocumento: r.tipoDocumento,
            cedula: r.cedula,
            fechaNacimiento: toDate(r.fechaNacimiento),
            telefono: r.telefono,
            email: r.email,
            ciudad: r.ciudad,
            municipio: r.municipio,
            direccion: r.direccion,
            ocupacion: r.ocupacion,
            ingresoMensual: r.ingresoMensual,
            valorSolicitado: r.valorSolicitado,
            plazoDeseado: toInt(r.plazoDeseado),
            destinoCredito: r.destinoCredito,
            referidoPorNombre: r.referidoPorNombre,
            referidoPorApellido: r.referidoPorApellido,
            referidoPorTelefono: r.referidoPorTelefono,
            referidoPorParentesco: r.referidoPorParentesco,
            aceptaTyC: toBool(r.aceptaTyC),
            aceptaTratamientoDatos: toBool(r.aceptaTratamientoDatos),
            fechaAceptacion: toDate(r.fechaAceptacion),
            estado: r.estado,
            observaciones: r.observaciones,
            ipOrigen: r.ipOrigen,
            userAgent: r.userAgent,
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
          },
          update: {
            nombre: r.nombre, apellido: r.apellido, tipoDocumento: r.tipoDocumento,
            cedula: r.cedula, fechaNacimiento: toDate(r.fechaNacimiento),
            telefono: r.telefono, email: r.email, ciudad: r.ciudad, municipio: r.municipio,
            direccion: r.direccion, ocupacion: r.ocupacion,
            ingresoMensual: r.ingresoMensual, valorSolicitado: r.valorSolicitado,
            plazoDeseado: toInt(r.plazoDeseado), destinoCredito: r.destinoCredito,
            referidoPorNombre: r.referidoPorNombre, referidoPorApellido: r.referidoPorApellido,
            referidoPorTelefono: r.referidoPorTelefono, referidoPorParentesco: r.referidoPorParentesco,
            aceptaTyC: toBool(r.aceptaTyC), aceptaTratamientoDatos: toBool(r.aceptaTratamientoDatos),
            fechaAceptacion: toDate(r.fechaAceptacion), estado: r.estado,
            observaciones: r.observaciones, ipOrigen: r.ipOrigen, userAgent: r.userAgent,
            updatedAt: toDate(r.updatedAt),
          },
        });
        count++;
        console.log(`  + ${r.codigo} | ${r.nombre} ${r.apellido} | ${r.cedula}`);
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} solicitudes de nuevo cliente restauradas\n`);
  }

  // ====================================================================
  // 4. ConversacionChat (Comunicaciones)
  // ====================================================================
  console.log('▶ 4/12) ConversacionChat');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "ConversacionChat" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      await prisma.conversacionChat.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          codigo: r.codigo,
          clienteId: r.clienteId,
          asesorId: r.asesorId,
          asunto: r.asunto,
          moduloReferencia: r.moduloReferencia,
          entidadRefId: r.entidadRefId,
          estado: r.estado,
          otpVerificado: toBool(r.otpVerificado),
          otpMetodo: r.otpMetodo,
          otpFechaVerificacion: toDate(r.otpFechaVerificacion),
          otpSessionId: r.otpSessionId,
          otpIpVerificacion: r.otpIpVerificacion,
          otpUserAgent: r.otpUserAgent,
          ultimaActividad: toDate(r.ultimaActividad),
          fechaCierre: toDate(r.fechaCierre),
          motivoCierre: r.motivoCierre,
          pdfHistorialUrl: r.pdfHistorialUrl,
          resumenIA: r.resumenIA,
          permiteArchivos: toBool(r.permiteArchivos),
          permiteNotasInternas: toBool(r.permiteNotasInternas),
          metadata: r.metadata,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
        update: {
          clienteId: r.clienteId, asesorId: r.asesorId, asunto: r.asunto,
          moduloReferencia: r.moduloReferencia, entidadRefId: r.entidadRefId,
          estado: r.estado, otpVerificado: toBool(r.otpVerificado),
          otpMetodo: r.otpMetodo, otpFechaVerificacion: toDate(r.otpFechaVerificacion),
          otpSessionId: r.otpSessionId, otpIpVerificacion: r.otpIpVerificacion,
          otpUserAgent: r.otpUserAgent, ultimaActividad: toDate(r.ultimaActividad),
          fechaCierre: toDate(r.fechaCierre), motivoCierre: r.motivoCierre,
          pdfHistorialUrl: r.pdfHistorialUrl, resumenIA: r.resumenIA,
          permiteArchivos: toBool(r.permiteArchivos),
          permiteNotasInternas: toBool(r.permiteNotasInternas),
          metadata: r.metadata, updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
      console.log(`  + ${r.codigo} | cliente=${r.clienteId} | asunto="${r.asunto}" | estado=${r.estado}`);
    }
    console.log(`  Total: ${count} conversaciones restauradas\n`);
  }

  // ====================================================================
  // 5. MensajeChat
  // ====================================================================
  console.log('▶ 5/12) MensajeChat');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "MensajeChat" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.mensajeChat.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            conversacionId: r.conversacionId,
            remitenteTipo: r.remitenteTipo,
            remitenteId: r.remitenteId,
            remitenteNombre: r.remitenteNombre,
            contenido: r.contenido,
            tipoMensaje: r.tipoMensaje,
            archivoUrl: r.archivoUrl,
            archivoNombre: r.archivoNombre,
            archivoTamano: r.archivoTamano !== null ? toInt(r.archivoTamano) : null,
            archivoMimeType: r.archivoMimeType,
            fechaEnvio: toDate(r.fechaEnvio),
            fechaEntregado: toDate(r.fechaEntregado),
            fechaLeido: toDate(r.fechaLeido),
            estado: r.estado,
            metadata: r.metadata,
            createdAt: toDate(r.createdAt),
          },
          update: {
            conversacionId: r.conversacionId,
            remitenteTipo: r.remitenteTipo, remitenteId: r.remitenteId,
            remitenteNombre: r.remitenteNombre, contenido: r.contenido,
            tipoMensaje: r.tipoMensaje, archivoUrl: r.archivoUrl,
            archivoNombre: r.archivoNombre,
            archivoTamano: r.archivoTamano !== null ? toInt(r.archivoTamano) : null,
            archivoMimeType: r.archivoMimeType,
            fechaEnvio: toDate(r.fechaEnvio),
            fechaEntregado: toDate(r.fechaEntregado), fechaLeido: toDate(r.fechaLeido),
            estado: r.estado, metadata: r.metadata,
          },
        });
        count++;
        const preview = (r.contenido || '').slice(0, 50).replace(/\n/g, ' ');
        console.log(`  + ${r.id} | conv=${r.conversacionId} | ${r.remitenteNombre}: "${preview}..."`);
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} mensajes restaurados\n`);
  }

  // ====================================================================
  // 6. BitacoraPrestamo
  // ====================================================================
  console.log('▶ 6/12) BitacoraPrestamo');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "BitacoraPrestamo" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.bitacoraPrestamo.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            prestamoId: r.prestamoId,
            prestamoCodigo: r.prestamoCodigo,
            usuarioId: r.usuarioId,
            usuarioNombre: r.usuarioNombre,
            tipo: r.tipo,
            titulo: r.titulo,
            descripcion: r.descripcion,
            resultado: r.resultado,
            fechaEvento: toDate(r.fechaEvento),
            createdAt: toDate(r.createdAt),
          },
          update: {
            prestamoId: r.prestamoId, prestamoCodigo: r.prestamoCodigo,
            usuarioId: r.usuarioId, usuarioNombre: r.usuarioNombre,
            tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion,
            resultado: r.resultado, fechaEvento: toDate(r.fechaEvento),
          },
        });
        count++;
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} bitácoras de préstamo restauradas\n`);
  }

  // ====================================================================
  // 7. CodigoConfirmacion
  // ====================================================================
  console.log('▶ 7/12) CodigoConfirmacion');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "CodigoConfirmacion" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.codigoConfirmacion.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            prestamoId: r.prestamoId,
            rol: r.rol,
            codigo: r.codigo,
            emailCliente: r.emailCliente,
            usado: toBool(r.usado),
            verificado: toBool(r.verificado),
            fechaGeneracion: toDate(r.fechaGeneracion),
            fechaExpiracion: toDate(r.fechaExpiracion),
            fechaVerificacion: toDate(r.fechaVerificacion),
            intentos: toInt(r.intentos),
            createdAt: toDate(r.createdAt),
          },
          update: {
            prestamoId: r.prestamoId, rol: r.rol, codigo: r.codigo,
            emailCliente: r.emailCliente, usado: toBool(r.usado),
            verificado: toBool(r.verificado),
            fechaGeneracion: toDate(r.fechaGeneracion),
            fechaExpiracion: toDate(r.fechaExpiracion),
            fechaVerificacion: toDate(r.fechaVerificacion),
            intentos: toInt(r.intentos),
          },
        });
        count++;
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} códigos de confirmación restaurados\n`);
  }

  // ====================================================================
  // 8. FirmaElectronica
  // ====================================================================
  console.log('▶ 8/12) FirmaElectronica');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "FirmaElectronica" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.firmaElectronica.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            prestamoId: r.prestamoId,
            clienteId: r.clienteId,
            tipo: r.tipo,
            imagenFirma: r.imagenFirma,
            otpEnviado: toBool(r.otpEnviado),
            otpValidado: toBool(r.otpValidado),
            otpCodigo: r.otpCodigo,
            otpCanal: r.otpCanal,
            otpFechaEnvio: toDate(r.otpFechaEnvio),
            otpFechaValidacion: toDate(r.otpFechaValidacion),
            documentoFirmado: r.documentoFirmado,
            fotoDocumento: r.fotoDocumento,
            fotoSelfie: r.fotoSelfie,
            fotoDocumentoHash: r.fotoDocumentoHash,
            fotoSelfieHash: r.fotoSelfieHash,
            ipFirma: r.ipFirma,
            userAgent: r.userAgent,
            geoUbicacion: r.geoUbicacion,
            fechaSubidaFotos: toDate(r.fechaSubidaFotos),
            fechaFirmaCompleta: toDate(r.fechaFirmaCompleta),
            estadoFirma: r.estadoFirma,
            intentosOTP: toInt(r.intentosOTP),
            maxIntentos: toInt(r.maxIntentos),
            esFirmaCodeudor: toBool(r.esFirmaCodeudor),
            firmanteRol: r.firmanteRol,
            firmanteNombre: r.firmanteNombre,
            firmanteCedula: r.firmanteCedula,
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
          },
          update: {
            prestamoId: r.prestamoId, clienteId: r.clienteId, tipo: r.tipo,
            imagenFirma: r.imagenFirma, otpEnviado: toBool(r.otpEnviado),
            otpValidado: toBool(r.otpValidado), otpCodigo: r.otpCodigo, otpCanal: r.otpCanal,
            otpFechaEnvio: toDate(r.otpFechaEnvio),
            otpFechaValidacion: toDate(r.otpFechaValidacion),
            documentoFirmado: r.documentoFirmado, fotoDocumento: r.fotoDocumento,
            fotoSelfie: r.fotoSelfie, fotoDocumentoHash: r.fotoDocumentoHash,
            fotoSelfieHash: r.fotoSelfieHash, ipFirma: r.ipFirma,
            userAgent: r.userAgent, geoUbicacion: r.geoUbicacion,
            fechaSubidaFotos: toDate(r.fechaSubidaFotos),
            fechaFirmaCompleta: toDate(r.fechaFirmaCompleta),
            estadoFirma: r.estadoFirma, intentosOTP: toInt(r.intentosOTP),
            maxIntentos: toInt(r.maxIntentos),
            esFirmaCodeudor: toBool(r.esFirmaCodeudor),
            firmanteRol: r.firmanteRol, firmanteNombre: r.firmanteNombre,
            firmanteCedula: r.firmanteCedula, updatedAt: toDate(r.updatedAt),
          },
        });
        count++;
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} firmas electrónicas restauradas\n`);
  }

  // ====================================================================
  // 9. SnapshotProyecto
  // ====================================================================
  console.log('▶ 9/12) SnapshotProyecto');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "SnapshotProyecto" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.snapshotProyecto.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            uuid: r.uuid,
            version: r.version,
            nombre: r.nombre,
            descripcion: r.descripcion,
            estado: r.estado,
            tamano: toInt(r.tamano),
            rutaArchivo: r.rutaArchivo,
            checksum: r.checksum,
            archivosTotal: toInt(r.archivosTotal),
            modulosAfectados: r.modulosAfectados,
            tipo: r.tipo,
            usuarioId: r.usuarioId,
            usuarioNombre: r.usuarioNombre,
            motivo: r.motivo,
            metadata: r.metadata,
            createdAt: toDate(r.createdAt),
          },
          update: {
            uuid: r.uuid, version: r.version, nombre: r.nombre,
            descripcion: r.descripcion, estado: r.estado, tamano: toInt(r.tamano),
            rutaArchivo: r.rutaArchivo, checksum: r.checksum,
            archivosTotal: toInt(r.archivosTotal),
            modulosAfectados: r.modulosAfectados, tipo: r.tipo,
            usuarioId: r.usuarioId, usuarioNombre: r.usuarioNombre,
            motivo: r.motivo, metadata: r.metadata,
          },
        });
        count++;
        console.log(`  + ${r.uuid} | ${r.nombre} | ${r.estado} | ${r.archivosTotal} archivos`);
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} snapshots restaurados\n`);
  }

  // ====================================================================
  // 10. AuditoriaConfiguracion (fusionar — mantener locales + añadir de Neon)
  // ====================================================================
  console.log('▶ 10/12) AuditoriaConfiguracion (merge)');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "AuditoriaConfiguracion" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.auditoriaConfiguracion.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            seccion: r.seccion,
            campo: r.campo,
            valorAnterior: r.valorAnterior,
            valorNuevo: r.valorNuevo,
            usuarioId: r.usuarioId,
            usuarioNombre: r.usuarioNombre,
            ipOrigen: r.ipOrigen,
            userAgent: r.userAgent,
            motivo: r.motivo,
            createdAt: toDate(r.createdAt),
          },
          update: {
            seccion: r.seccion, campo: r.campo,
            valorAnterior: r.valorAnterior, valorNuevo: r.valorNuevo,
            usuarioId: r.usuarioId, usuarioNombre: r.usuarioNombre,
            ipOrigen: r.ipOrigen, userAgent: r.userAgent, motivo: r.motivo,
          },
        });
        count++;
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} entradas de auditoría fusionadas\n`);
  }

  // ====================================================================
  // 11. Integracion (Brevo API key, etc.)
  // ====================================================================
  console.log('▶ 11/12) Integracion');
  {
    let rows = [];
    try {
      const res = await neonClient.query(`SELECT * FROM "Integracion" ORDER BY "createdAt"`);
      rows = res.rows;
    } catch (e) {
      console.log(`  (tabla no existe o vacía en Neon: ${e.message.split('\n')[0]})`);
    }
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.integracion.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            nombre: r.nombre,
            proveedor: r.proveedor,
            endpoint: r.endpoint,
            apiKey: r.apiKey,
            activo: r.activo !== false,
            configuracion: r.configuracion,
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
          },
          update: {
            nombre: r.nombre, proveedor: r.proveedor, endpoint: r.endpoint,
            apiKey: r.apiKey, activo: r.activo !== false,
            configuracion: r.configuracion,
            updatedAt: toDate(r.updatedAt),
          },
        });
        count++;
        console.log(`  + ${r.nombre} | ${r.proveedor}`);
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} integraciones restauradas\n`);
  }

  // ====================================================================
  // 12. CasoJuridico
  // ====================================================================
  console.log('▶ 12/12) CasoJuridico');
  {
    const { rows } = await neonClient.query(`SELECT * FROM "CasoJuridico" ORDER BY "createdAt"`);
    let count = 0;
    for (const r of rows) {
      try {
        await prisma.casoJuridico.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            prestamoId: r.prestamoId,
            clienteId: r.clienteId,
            codigo: r.codigo,
            tipoProceso: r.tipoProceso,
            estado: r.estado,
            descripcion: r.descripcion,
            fechaApertura: toDate(r.fechaApertura),
            fechaCierre: toDate(r.fechaCierre),
            resultadoFinal: r.resultadoFinal,
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
          },
          update: {
            prestamoId: r.prestamoId, clienteId: r.clienteId, codigo: r.codigo,
            tipoProceso: r.tipoProceso, estado: r.estado, descripcion: r.descripcion,
            fechaApertura: toDate(r.fechaApertura), fechaCierre: toDate(r.fechaCierre),
            resultadoFinal: r.resultadoFinal, updatedAt: toDate(r.updatedAt),
          },
        });
        count++;
      } catch (e) {
        console.log(`  ! ${r.id} saltado: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`  Total: ${count} casos jurídicos restaurados\n`);
  }

  // ====================================================================
  // Verificación final — conteos locales
  // ====================================================================
  console.log('=== VERIFICACIÓN LOCAL POST-RESTAURACIÓN ===\n');
  const tablas = [
    ['DocumentoGestor', prisma.documentoGestor],
    ['SolicitudWeb', prisma.solicitudWeb],
    ['SolicitudNuevoCliente', prisma.solicitudNuevoCliente],
    ['ConversacionChat', prisma.conversacionChat],
    ['MensajeChat', prisma.mensajeChat],
    ['BitacoraPrestamo', prisma.bitacoraPrestamo],
    ['CodigoConfirmacion', prisma.codigoConfirmacion],
    ['FirmaElectronica', prisma.firmaElectronica],
    ['SnapshotProyecto', prisma.snapshotProyecto],
    ['AuditoriaConfiguracion', prisma.auditoriaConfiguracion],
    ['Integracion', prisma.integracion],
    ['CasoJuridico', prisma.casoJuridico],
  ];
  for (const [name, model] of tablas) {
    const n = await model.count();
    const flag = n > 0 ? '✅' : '⚠️ ';
    console.log(`${flag} ${name.padEnd(28)} = ${n}`);
  }

  await neonClient.end();
  await prisma.$disconnect();
  console.log('\n=== RESTAURACIÓN COMPLETA ===');
})().catch(e => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
