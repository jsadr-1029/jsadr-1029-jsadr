// =====================================================
// Importa datos desde el backup JSON al esquema Prisma
// =====================================================
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const db = new PrismaClient()

type Backup = {
  data: Record<string, any[]>
}

function parseDate(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  return new Date(v)
}

function parseFloat2(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

async function main() {
  console.log('📁 Leyendo backup...')
  const raw = readFileSync('/home/z/my-project/upload/backup_manual_2026-07-20T19-33-23-029Z.json', 'utf8')
  const backup: Backup = JSON.parse(raw)
  const data = backup.data

  console.log('🧹 Limpiando base de datos existente...')
  await db.auditLog.deleteMany()
  await db.accesoPortal.deleteMany()
  await db.codigoConfirmacion.deleteMany()
  await db.tokenFirma.deleteMany()
  await db.firma.deleteMany()
  await db.bitacora.deleteMany()
  await db.movimientoCaja.deleteMany()
  await db.cronologiaJuridica.deleteMany()
  await db.casoJuridico.deleteMany()
  await db.notificacion.deleteMany()
  await db.pago.deleteMany()
  await db.prestamo.deleteMany()
  await db.documentoGestor.deleteMany()
  await db.cliente.deleteMany()
  await db.categoria.deleteMany()
  await db.cuenta.deleteMany()
  await db.caja.deleteMany()
  await db.configuracion.deleteMany()
  await db.seguridadModulo.deleteMany()
  await db.version.deleteMany()
  await db.prestamoBancario.deleteMany()
  await db.auditoriaHallazgo.deleteMany()
  await db.usuario.deleteMany()
  console.log('   Base limpia.')

  // Usuarios
  console.log(`👤 Importando ${data.usuarios?.length || 0} usuarios...`)
  for (const u of data.usuarios || []) {
    await db.usuario.create({
      data: {
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        username: u.username,
        rol: u.rol || 'ADMIN',
        activo: u.activo ?? true,
        permisos: u.permisos || '[]',
        password: u.password || null,
        createdAt: parseDate(u.createdAt) || new Date(),
        updatedAt: parseDate(u.updatedAt) || new Date(),
      },
    })
  }

  // Configuración
  console.log(`⚙️  Importando ${data.configuracion?.length || 0} configuraciones...`)
  for (const c of data.configuracion || []) {
    await db.configuracion.create({
      data: {
        id: c.id,
        clave: c.clave,
        valor: c.valor,
        descripcion: c.descripcion,
        updatedAt: parseDate(c.updatedAt) || new Date(),
      },
    })
  }

  // Cuentas
  console.log(`🏦 Importando ${data.cuentas?.length || 0} cuentas...`)
  for (const c of data.cuentas || []) {
    await db.cuenta.create({
      data: {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        banco: c.banco,
        tipoCuenta: c.tipoCuenta,
        numeroCuenta: c.numeroCuenta,
        titular: c.titular,
        activa: c.activa ?? true,
        createdAt: parseDate(c.createdAt) || new Date(),
        updatedAt: parseDate(c.updatedAt) || new Date(),
      },
    })
  }

  // Categorías
  console.log(`🏷️  Importando ${data.categorias?.length || 0} categorías...`)
  for (const c of data.categorias || []) {
    await db.categoria.create({
      data: {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        montoMinimo: parseFloat2(c.montoMinimo) || 0,
        montoMaximo: parseFloat2(c.montoMaximo) || 0,
        tasaInteresAnual: parseFloat2(c.tasaInteresAnual) || 0,
        tasaMoraAnual: parseFloat2(c.tasaMoraAnual) || 0,
        descripcion: c.descripcion,
        activa: c.activa ?? true,
        cuentaRecaudoId: c.cuentaRecaudoId,
        createdAt: parseDate(c.createdAt) || new Date(),
        updatedAt: parseDate(c.updatedAt) || new Date(),
      },
    })
  }

  // Cajas
  console.log(`💰 Importando ${data.cajas?.length || 0} cajas...`)
  for (const c of data.cajas || []) {
    await db.caja.create({
      data: {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        descripcion: c.descripcion,
        saldoActual: parseFloat2(c.saldoActual) || 0,
        totalIngresos: parseFloat2(c.totalIngresos) || 0,
        totalEgresos: parseFloat2(c.totalEgresos) || 0,
        activa: c.activa ?? true,
        createdAt: parseDate(c.createdAt) || new Date(),
        updatedAt: parseDate(c.updatedAt) || new Date(),
      },
    })
  }

  // Clientes
  console.log(`👥 Importando ${data.clientes?.length || 0} clientes...`)
  for (const c of data.clientes || []) {
    await db.cliente.create({
      data: {
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        telefono: c.telefono,
        email: c.email,
        departamento: c.departamento,
        municipio: c.municipio,
        salario: parseFloat2(c.salario),
        fechaIngreso: parseDate(c.fechaIngreso),
        direccion: c.direccion,
        ciudad: c.ciudad,
        barrio: c.barrio,
        notas: c.notas,
        bancoCliente: c.bancoCliente,
        tipoCuentaCliente: c.tipoCuentaCliente,
        numeroCuentaCliente: c.numeroCuentaCliente,
        activo: c.activo ?? true,
        referidoPorId: c.referidoPorId,
        categoriaId: c.categoriaId,
        pinHash: c.pinHash,
        pinCreatedAt: parseDate(c.pinCreatedAt),
        pinIntentos: c.pinIntentos || 0,
        pinBloqueadoHasta: parseDate(c.pinBloqueadoHasta),
        ultimoAccesoPortal: parseDate(c.ultimoAccesoPortal),
        tokenSesion: c.tokenSesion,
        tokenExpira: parseDate(c.tokenExpira),
        tieneTasaPersonalizada: c.tieneTasaPersonalizada ?? false,
        tasaPersonalizada: parseFloat2(c.tasaPersonalizada),
        tasaMoraPersonalizada: parseFloat2(c.tasaMoraPersonalizada),
        createdAt: parseDate(c.createdAt) || new Date(),
        updatedAt: parseDate(c.updatedAt) || new Date(),
      },
    })
  }

  // Préstamos
  console.log(`📑 Importando ${data.prestamos?.length || 0} préstamos...`)
  for (const p of data.prestamos || []) {
    await db.prestamo.create({
      data: {
        id: p.id,
        codigo: p.codigo,
        clienteId: p.clienteId,
        categoriaId: p.categoriaId,
        montoPrincipal: parseFloat2(p.montoPrincipal) || 0,
        tasaInteresAnual: parseFloat2(p.tasaInteresAnual) || 0,
        tasaInteresMensual: parseFloat2(p.tasaInteresMensual) || 0,
        tasaMoraDiaria: parseFloat2(p.tasaMoraDiaria) || 0,
        plazoMeses: p.plazoMeses || 0,
        frecuencia: p.frecuencia || 'MENSUAL',
        numeroCuotas: p.numeroCuotas || 0,
        montoCuota: parseFloat2(p.montoCuota) || 0,
        totalInteres: parseFloat2(p.totalInteres) || 0,
        totalPagar: parseFloat2(p.totalPagar) || 0,
        tasaAplicada: parseFloat2(p.tasaAplicada),
        tasaMoraPersonalizada: parseFloat2(p.tasaMoraPersonalizada),
        moraCompuestaDiaria: p.moraCompuestaDiaria ?? true,
        montoMoraAcumulado: parseFloat2(p.montoMoraAcumulado) || 0,
        fechaSolicitud: parseDate(p.fechaSolicitud) || new Date(),
        fechaAprobacion: parseDate(p.fechaAprobacion),
        fechaDesembolso: parseDate(p.fechaDesembolso),
        fechaVencimiento: parseDate(p.fechaVencimiento),
        estado: p.estado || 'SOLICITADO',
        tycEnviado: p.tycEnviado ?? false,
        tycAceptado: p.tycAceptado ?? false,
        tycFechaAceptacion: parseDate(p.tycFechaAceptacion),
        tycToken: p.tycToken,
        metodoConfirmacion: p.metodoConfirmacion,
        requiereDocumentos: p.requiereDocumentos ?? true,
        generarPagare: p.generarPagare ?? true,
        generarCarta: p.generarCarta ?? true,
        docsDatosAdicionales: p.docsDatosAdicionales,
        firmaId: p.firmaId,
        saldoCapital: parseFloat2(p.saldoCapital) || 0,
        saldoInteres: parseFloat2(p.saldoInteres) || 0,
        saldoTotal: parseFloat2(p.saldoTotal) || 0,
        cuotasPagadas: p.cuotasPagadas || 0,
        montoPagado: parseFloat2(p.montoPagado) || 0,
        montoMora: parseFloat2(p.montoMora) || 0,
        diasMora: p.diasMora || 0,
        fondoGarantiaCargado: p.fondoGarantiaCargado ?? false,
        fondoGarantiaMonto: parseFloat2(p.fondoGarantiaMonto) || 0,
        notas: p.notas,
        createdAt: parseDate(p.createdAt) || new Date(),
        updatedAt: parseDate(p.updatedAt) || new Date(),
      },
    })
  }

  // Pagos
  console.log(`💳 Importando ${data.pagos?.length || 0} pagos...`)
  for (const p of data.pagos || []) {
    await db.pago.create({
      data: {
        id: p.id,
        codigo: p.codigo,
        prestamoId: p.prestamoId,
        numeroCuota: p.numeroCuota || 1,
        montoCapital: parseFloat2(p.montoCapital) || 0,
        montoInteres: parseFloat2(p.montoInteres) || 0,
        montoMora: parseFloat2(p.montoMora) || 0,
        montoTotal: parseFloat2(p.montoTotal) || 0,
        fechaPago: parseDate(p.fechaPago) || new Date(),
        fechaVencimiento: parseDate(p.fechaVencimiento),
        metodoPago: p.metodoPago || 'EFECTIVO',
        referencia: p.referencia,
        cuentaRecaudoId: p.cuentaRecaudoId,
        estado: p.estado || 'CONFIRMADO',
        linkPago: p.linkPago,
        linkExpira: parseDate(p.linkExpira),
        notas: p.notas,
        reversadoPorId: p.reversadoPorId,
        fechaReversion: parseDate(p.fechaReversion),
        motivoReversion: p.motivoReversion,
        createdAt: parseDate(p.createdAt) || new Date(),
      },
    })
  }

  // Notificaciones
  console.log(`🔔 Importando ${data.notificaciones?.length || 0} notificaciones...`)
  for (const n of data.notificaciones || []) {
    await db.notificacion.create({
      data: {
        id: n.id,
        prestamoId: n.prestamoId,
        clienteTelefono: n.clienteTelefono,
        tipo: n.tipo || 'OTRO',
        mensaje: n.mensaje || '',
        estado: n.estado || 'PENDIENTE_MANUAL',
        error: n.error,
        linkWaMe: n.linkWaMe,
        fechaEnvio: parseDate(n.fechaEnvio),
        createdAt: parseDate(n.createdAt) || new Date(),
      },
    })
  }

  // Firmas
  console.log(`✍️  Importando ${data.firmas?.length || 0} firmas...`)
  for (const f of data.firmas || []) {
    await db.firma.create({
      data: {
        id: f.id,
        prestamoId: f.prestamoId,
        clienteId: f.clienteId,
        tipo: f.tipo || 'TYC',
        imagenFirma: f.imagenFirma || '',
        otpEnviado: f.otpEnviado ?? false,
        otpValidado: f.otpValidado ?? false,
        otpCodigo: f.otpCodigo,
        otpCanal: f.otpCanal,
        otpFechaEnvio: parseDate(f.otpFechaEnvio),
        otpFechaValidacion: parseDate(f.otpFechaValidacion),
        documentoFirmado: f.documentoFirmado,
        fotoDocumento: f.fotoDocumento,
        fotoSelfie: f.fotoSelfie,
        fotoDocumentoHash: f.fotoDocumentoHash,
        fotoSelfieHash: f.fotoSelfieHash,
        ipFirma: f.ipFirma,
        userAgent: f.userAgent,
        geoUbicacion: f.geoUbicacion,
        fechaSubidaFotos: parseDate(f.fechaSubidaFotos),
        fechaFirmaCompleta: parseDate(f.fechaFirmaCompleta),
        estadoFirma: f.estadoFirma || 'PENDIENTE',
        intentosOTP: f.intentosOTP || 0,
        maxIntentos: f.maxIntentos || 5,
        createdAt: parseDate(f.createdAt) || new Date(),
        updatedAt: parseDate(f.updatedAt) || new Date(),
      },
    })
  }

  // Tokens de firma
  console.log(`🔑 Importando ${data.tokensFirma?.length || 0} tokens de firma...`)
  for (const t of data.tokensFirma || []) {
    await db.tokenFirma.create({
      data: {
        id: t.id,
        token: t.token,
        firmaId: t.firmaId,
        prestamoId: t.prestamoId,
        clienteId: t.clienteId,
        usado: t.usado ?? false,
        fechaExpiracion: parseDate(t.fechaExpiracion) || new Date(),
        fechaUsado: parseDate(t.fechaUsado),
        createdAt: parseDate(t.createdAt) || new Date(),
      },
    })
  }

  // Códigos de confirmación
  console.log(`✔️  Importando ${data.codigosConfirmacion?.length || 0} códigos de confirmación...`)
  for (const c of data.codigosConfirmacion || []) {
    await db.codigoConfirmacion.create({
      data: {
        id: c.id,
        prestamoId: c.prestamoId,
        codigo: c.codigo,
        emailCliente: c.emailCliente,
        telefonoCliente: c.telefonoCliente,
        usado: c.usado ?? false,
        verificado: c.verificado ?? false,
        fechaGeneracion: parseDate(c.fechaGeneracion) || new Date(),
        fechaExpiracion: parseDate(c.fechaExpiracion) || new Date(),
        fechaVerificacion: parseDate(c.fechaVerificacion),
        intentos: c.intentos || 0,
        createdAt: parseDate(c.createdAt) || new Date(),
      },
    })
  }

  // Casos jurídicos
  console.log(`⚖️  Importando ${data.casosJuridicos?.length || 0} casos jurídicos...`)
  for (const c of data.casosJuridicos || []) {
    await db.casoJuridico.create({
      data: {
        id: c.id,
        prestamoId: c.prestamoId,
        estado: c.estado || 'RADICADO',
        abogadoNombre: c.abogadoNombre,
        abogadoTelefono: c.abogadoTelefono,
        abogadoEmail: c.abogadoEmail,
        abogadoAsignado: c.abogadoAsignado ?? false,
        honorarios: parseFloat2(c.honorarios) || 0,
        honorariosPagados: parseFloat2(c.honorariosPagados) || 0,
        juzgado: c.juzgado,
        radicado: c.radicado,
        tipoProceso: c.tipoProceso,
        valorReclamado: parseFloat2(c.valorReclamado),
        fechaPresentacionDemanda: parseDate(c.fechaPresentacionDemanda),
        fechaAdmision: parseDate(c.fechaAdmision),
        fechaEmbargo: parseDate(c.fechaEmbargo),
        fechaAudiencia: parseDate(c.fechaAudiencia),
        descripcion: c.descripcion,
        fechaApertura: parseDate(c.fechaApertura) || new Date(),
        fechaCierre: parseDate(c.fechaCierre),
        resultadoFinal: c.resultadoFinal,
        createdAt: parseDate(c.createdAt) || new Date(),
        updatedAt: parseDate(c.updatedAt) || new Date(),
      },
    })
  }

  // Cronología jurídica
  console.log(`📅 Importando ${data.cronologia?.length || 0} cronologías...`)
  for (const c of data.cronologia || []) {
    await db.cronologiaJuridica.create({
      data: {
        id: c.id,
        casoId: c.casoId,
        fecha: parseDate(c.fecha) || new Date(),
        tipoEvento: c.tipoEvento || 'OTRO',
        titulo: c.titulo,
        descripcion: c.descripcion,
        resultado: c.resultado,
        actor: c.actor,
        documentoAnexo: c.documentoAnexo,
        monto: parseFloat2(c.monto),
        createdAt: parseDate(c.createdAt) || new Date(),
      },
    })
  }

  // Bitácoras
  console.log(`📔 Importando ${data.bitacoras?.length || 0} bitácoras...`)
  for (const b of data.bitacoras || []) {
    await db.bitacora.create({
      data: {
        id: b.id,
        prestamoId: b.prestamoId,
        prestamoCodigo: b.prestamoCodigo,
        usuarioId: b.usuarioId,
        usuarioNombre: b.usuarioNombre,
        tipo: b.tipo || 'OTRO',
        titulo: b.titulo,
        descripcion: b.descripcion,
        resultado: b.resultado,
        fechaEvento: parseDate(b.fechaEvento) || new Date(),
        createdAt: parseDate(b.createdAt) || new Date(),
      },
    })
  }

  // Audit logs (con manejo de FK inválida)
  console.log(`🔍 Importando ${data.auditLogs?.length || 0} audit logs...`)
  let auditImported = 0
  for (const a of data.auditLogs || []) {
    try {
      await db.auditLog.create({
        data: {
          id: a.id,
          usuarioId: a.usuarioId,
          usuarioNombre: a.usuarioNombre,
          accion: a.accion,
          modulo: a.modulo,
          entidadId: a.entidadId,
          entidadNombre: a.entidadNombre,
          detalles: a.detalles,
          ipOrigen: a.ipOrigen,
          userAgent: a.userAgent,
          exito: a.exito ?? true,
          errorMessage: a.errorMessage,
          fecha: parseDate(a.fecha) || new Date(),
        },
      })
      auditImported++
    } catch (e) {
      // FK falla si entidadId no es un Préstamo; lo guardamos sin FK
      try {
        await db.auditLog.create({
          data: {
            id: a.id + '_nf',
            usuarioId: a.usuarioId,
            usuarioNombre: a.usuarioNombre,
            accion: a.accion,
            modulo: a.modulo,
            entidadId: null,
            entidadNombre: a.entidadNombre,
            detalles: a.detalles,
            ipOrigen: a.ipOrigen,
            userAgent: a.userAgent,
            exito: a.exito ?? true,
            errorMessage: a.errorMessage,
            fecha: parseDate(a.fecha) || new Date(),
          },
        })
        auditImported++
      } catch (e2) {
        console.warn(`   ⚠️  No se pudo importar audit log ${a.id}:`, (e2 as Error).message)
      }
    }
  }
  console.log(`   ${auditImported} audit logs importados.`)

  // Movimientos de caja
  console.log(`💸 Importando ${data.movimientosCaja?.length || 0} movimientos de caja...`)
  for (const m of data.movimientosCaja || []) {
    await db.movimientoCaja.create({
      data: {
        id: m.id,
        cajaId: m.cajaId,
        tipo: m.tipo || 'INGRESO',
        monto: parseFloat2(m.monto) || 0,
        concepto: m.concepto,
        referencia: m.referencia,
        prestamoId: m.prestamoId,
        fechaMovimiento: parseDate(m.fechaMovimiento) || new Date(),
        creadoPor: m.creadoPor,
        usuarioId: m.usuarioId,
        createdAt: parseDate(m.createdAt) || new Date(),
      },
    })
  }

  // Accesos al portal
  console.log(`🚪 Importando ${data.accesosPortal?.length || 0} accesos al portal...`)
  for (const a of data.accesosPortal || []) {
    try {
      await db.accesoPortal.create({
        data: {
          id: a.id,
          clienteId: a.clienteId,
          clienteCedula: a.clienteCedula,
          clienteNombre: a.clienteNombre,
          ipOrigen: a.ipOrigen,
          userAgent: a.userAgent,
          accion: a.accion,
          exito: a.exito ?? true,
          detalle: a.detalle,
          metadata: a.metadata,
          prestamoId: a.prestamoId,
          createdAt: parseDate(a.createdAt) || new Date(),
        },
      })
    } catch (e) {
      // Si prestamoId no existe, lo reintentamos sin prestamoId
      try {
        await db.accesoPortal.create({
          data: {
            id: a.id + '_nf',
            clienteId: a.clienteId,
            clienteCedula: a.clienteCedula,
            clienteNombre: a.clienteNombre,
            ipOrigen: a.ipOrigen,
            userAgent: a.userAgent,
            accion: a.accion,
            exito: a.exito ?? true,
            detalle: a.detalle,
            metadata: a.metadata,
            prestamoId: null,
            createdAt: parseDate(a.createdAt) || new Date(),
          },
        })
      } catch (e2) {
        console.warn(`   ⚠️  No se pudo importar acceso portal ${a.id}`)
      }
    }
  }

  // Documentos del gestor
  console.log(`📎 Importando ${data.documentosGestor?.length || 0} documentos...`)
  for (const d of data.documentosGestor || []) {
    await db.documentoGestor.create({
      data: {
        id: d.id,
        prestamoId: d.prestamoId,
        clienteId: d.clienteId,
        tipo: d.tipo || 'OTRO',
        titulo: d.titulo,
        descripcion: d.descripcion,
        archivoBase64: d.archivoBase64,
        archivoNombre: d.archivoNombre,
        archivoTipo: d.archivoTipo,
        archivoTamano: d.archivoTamano || 0,
        subidoPor: d.subidoPor,
        fechaSubida: parseDate(d.fechaSubida) || new Date(),
        createdAt: parseDate(d.createdAt) || new Date(),
      },
    })
  }

  // Seguridad módulos
  console.log(`🔒 Importando ${data.seguridadModulos?.length || 0} módulos de seguridad...`)
  for (const s of data.seguridadModulos || []) {
    await db.seguridadModulo.create({
      data: {
        id: s.id,
        moduloKey: s.moduloKey,
        moduloNombre: s.moduloNombre,
        protegido: s.protegido ?? false,
        claveHash: s.claveHash,
        createdAt: parseDate(s.createdAt) || new Date(),
        updatedAt: parseDate(s.updatedAt) || new Date(),
      },
    })
  }

  // Versiones
  console.log(`🏷️  Importando ${data.versiones?.length || 0} versiones...`)
  for (const v of data.versiones || []) {
    await db.version.create({
      data: {
        id: v.id,
        numero: v.numero,
        nombre: v.nombre,
        descripcion: v.descripcion,
        cambios: v.cambios,
        tipo: v.tipo || 'MENOR',
        activa: v.activa ?? false,
        creadorId: v.creadorId,
        fechaActivacion: parseDate(v.fechaActivacion),
        backupId: v.backupId,
        createdAt: parseDate(v.createdAt) || new Date(),
        updatedAt: parseDate(v.updatedAt) || new Date(),
      },
    })
  }

  console.log('\n✅ Importación completada!')
  console.log('\n📊 Conteos finales:')
  console.log(`   Clientes: ${await db.cliente.count()}`)
  console.log(`   Préstamos: ${await db.prestamo.count()}`)
  console.log(`   Pagos: ${await db.pago.count()}`)
  console.log(`   Notificaciones: ${await db.notificacion.count()}`)
  console.log(`   Firmas: ${await db.firma.count()}`)
  console.log(`   Casos jurídicos: ${await db.casoJuridico.count()}`)
  console.log(`   Cajas: ${await db.caja.count()}`)
  console.log(`   Movimientos de caja: ${await db.movimientoCaja.count()}`)
  console.log(`   Categorías: ${await db.categoria.count()}`)
  console.log(`   Cuentas: ${await db.cuenta.count()}`)
  console.log(`   Configuraciones: ${await db.configuracion.count()}`)
  console.log(`   Audit logs: ${await db.auditLog.count()}`)
  console.log(`   Accesos portal: ${await db.accesoPortal.count()}`)
  console.log(`   Documentos: ${await db.documentoGestor.count()}`)
  console.log(`   Módulos seguridad: ${await db.seguridadModulo.count()}`)
  console.log(`   Versiones: ${await db.version.count()}`)
  console.log(`   Usuarios: ${await db.usuario.count()}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
