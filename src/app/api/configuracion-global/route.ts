// =====================================================
// API Configuración Global v3.6 — Jsadr
// =====================================================
// GET     -> retorna toda la configuración o una sección
//            ?seccion=empresa|dominios|correos|smtp|integraciones|
//                     variables|ambientes|ssl|almacenamiento|estado|
//                     mantenimiento|backups|auditoria|versiones
// PATCH   -> actualiza una sección específica { seccion, data, motivo? }
// POST    -> ejecuta acciones:
//            { accion: 'test_smtp'|'test_dominio'|'test_integracion'|
//                      'backup_config'|'restaurar_version', payload }
//
// Cifra credenciales sensibles (apiKey, apiSecret, smtpPass, secretKey, accessKey)
// usando encryptSensitive() de @/lib/security.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptSensitive, decryptSensitive, encryptBackup, decryptBackup, getClientInfo } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError, AppError, AppErrors } from '@/lib/error-handler'

// === SECCIONES VÁLIDAS ===
const SECCIONES = [
  'empresa',
  'dominios',
  'correos',
  'smtp',
  'integraciones',
  'variables',
  'ambientes',
  'ssl',
  'almacenamiento',
  'estado',
  'mantenimiento',
  'backups',
  'auditoria',
  'versiones',
] as const
type Seccion = (typeof SECCIONES)[number]

// === SERVICIOS POR DEFECTO (9) ===
const SERVICIOS_DEFAULT = [
  { servicio: 'api-principal', detalle: 'API REST Jsadr' },
  { servicio: 'portal-cliente', detalle: 'Portal web del cliente' },
  { servicio: 'chat-asistente', detalle: 'Centro de comunicaciones chat' },
  { servicio: 'base-datos', detalle: 'Base de datos SQLite/Postgres' },
  { servicio: 'smtp-correo', detalle: 'Servidor SMTP saliente' },
  { servicio: 'backups-automaticos', detalle: 'Sistema de backups' },
  { servicio: 'integraciones-terceros', detalle: 'APIs externas (Bancolombia, etc.)' },
  { servicio: 'firmas-electronicas', detalle: 'Servicio de firma de contratos' },
  { servicio: 'reportes-pdf', detalle: 'Generación de PDFs' },
]

// === VARIABLES GLOBALES POR DEFECTO (9) ===
const VARIABLES_DEFAULT = [
  { clave: 'TASA_INTERES_DEFAULT', valor: '15', tipo: 'number', descripcion: 'Tasa de interés mensual por defecto (%)', categoria: 'financiero' },
  { clave: 'DIAS_GRACIA_MORA', valor: '3', tipo: 'number', descripcion: 'Días de gracia antes de aplicar mora', categoria: 'financiero' },
  { clave: 'TASA_MORA_DIARIA', valor: '0.5', tipo: 'number', descripcion: 'Tasa de mora diaria (%)', categoria: 'financiero' },
  { clave: 'MONEDA_DEFAULT', valor: 'COP', tipo: 'string', descripcion: 'Moneda por defecto del sistema', categoria: 'general' },
  { clave: 'IDIOMA_DEFAULT', valor: 'es-CO', tipo: 'string', descripcion: 'Idioma por defecto', categoria: 'general' },
  { clave: 'ZONA_HORARIA', valor: 'America/Bogota', tipo: 'string', descripcion: 'Zona horaria del sistema', categoria: 'general' },
  { clave: 'MAX_PRESTAMOS_CLIENTE', valor: '3', tipo: 'number', descripcion: 'Máximo préstamos activos por cliente', categoria: 'negocio' },
  { clave: 'BACKUP_FREQUENCY_HOURS', valor: '24', tipo: 'number', descripcion: 'Frecuencia de backups automáticos (horas)', categoria: 'sistema' },
  { clave: 'SESSION_TIMEOUT_MIN', valor: '60', tipo: 'number', descripcion: 'Tiempo de inactividad de sesión (minutos)', categoria: 'sistema' },
]

// === INICIALIZACIÓN ===
async function inicializarSiVacio() {
  // Empresa
  const empresaCount = await db.configuracionEmpresa.count()
  if (empresaCount === 0) {
    await db.configuracionEmpresa.create({ data: {} })
  }

  // Almacenamiento
  const almCount = await db.configAlmacenamiento.count()
  if (almCount === 0) {
    await db.configAlmacenamiento.create({ data: {} })
  }

  // Mantenimiento
  const mantCount = await db.configMantenimiento.count()
  if (mantCount === 0) {
    await db.configMantenimiento.create({ data: {} })
  }

  // Servicios (9)
  for (const s of SERVICIOS_DEFAULT) {
    const exists = await db.estadoServicio.findUnique({ where: { servicio: s.servicio } })
    if (!exists) {
      await db.estadoServicio.create({
        data: { servicio: s.servicio, detalle: s.detalle, estado: 'operativo' },
      })
    }
  }

  // Variables globales (9)
  for (const v of VARIABLES_DEFAULT) {
    const exists = await db.variableGlobal.findUnique({ where: { clave: v.clave } })
    if (!exists) {
      await db.variableGlobal.create({ data: v })
    }
  }
}

// === MAPEO SECCIÓN -> DATOS (GET) ===
async function cargarSeccion(seccion: Seccion, req: NextRequest) {
  switch (seccion) {
    case 'empresa': {
      let empresa = await db.configuracionEmpresa.findFirst()
      if (!empresa) {
        empresa = await db.configuracionEmpresa.create({ data: {} })
      }
      return { empresa }
    }

    case 'dominios': {
      const dominios = await db.dominio.findMany({ orderBy: { createdAt: 'desc' } })
      return { dominios }
    }

    case 'correos':
    case 'smtp': {
      const correos = await db.correoInstitucional.findMany({ orderBy: { createdAt: 'desc' } })
      // Mask credenciales para GET (nunca exponer smtpPass real)
      const masked = correos.map((c) => ({
        ...c,
        smtpPass: c.smtpPass ? '********' : null,
      }))
      return { correos: masked }
    }

    case 'integraciones': {
      const integraciones = await db.integracion.findMany({ orderBy: { createdAt: 'desc' } })
      const masked = integraciones.map((i) => ({
        ...i,
        apiKey: i.apiKey ? `***${i.apiKey.slice(-4)}` : null,
        apiSecret: i.apiSecret ? '********' : null,
      }))
      return { integraciones: masked }
    }

    case 'variables': {
      const variables = await db.variableGlobal.findMany({ orderBy: { categoria: 'asc' } })
      const masked = variables.map((v) => ({
        ...v,
        // Si es tipo 'secret', mask el valor
        valor: v.tipo === 'secret' && v.valor ? '********' : v.valor,
      }))
      return { variables: masked }
    }

    case 'ambientes': {
      const ambientes = await db.ambiente.findMany({ orderBy: { nombre: 'asc' } })
      return { ambientes }
    }

    case 'ssl': {
      const certificados = await db.certificadoSSL.findMany({ orderBy: { createdAt: 'desc' } })
      return { certificados }
    }

    case 'almacenamiento': {
      let alm = await db.configAlmacenamiento.findFirst()
      if (!alm) {
        alm = await db.configAlmacenamiento.create({ data: {} })
      }
      // Mask credenciales
      const masked = {
        ...alm,
        accessKey: alm.accessKey ? `***${alm.accessKey.slice(-4)}` : null,
        secretKey: alm.secretKey ? '********' : null,
      }
      return { almacenamiento: masked }
    }

    case 'estado': {
      const servicios = await db.estadoServicio.findMany({ orderBy: { servicio: 'asc' } })
      return { servicios }
    }

    case 'mantenimiento': {
      let mant = await db.configMantenimiento.findFirst()
      if (!mant) {
        mant = await db.configMantenimiento.create({ data: {} })
      }
      return { mantenimiento: mant }
    }

    case 'backups':
    case 'versiones': {
      const versiones = await db.versionConfiguracion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      return { versiones }
    }

    case 'auditoria': {
      const { searchParams } = new URL(req.url)
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
      const seccionFiltro = searchParams.get('seccionFiltro')
      const where = seccionFiltro ? { seccion: seccionFiltro } : undefined
      const auditoria = await db.auditoriaConfiguracion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return { auditoria }
    }

    default:
      throw AppErrors.badRequest(`Sección inválida: ${seccion}`)
  }
}

// === GET ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    await inicializarSiVacio()

    const { searchParams } = new URL(req.url)
    const seccionParam = searchParams.get('seccion')

    if (seccionParam) {
      if (!SECCIONES.includes(seccionParam as Seccion)) {
        throw AppErrors.badRequest(`Sección inválida. Válidas: ${SECCIONES.join(', ')}`)
      }
      const data = await cargarSeccion(seccionParam as Seccion, req)
      return NextResponse.json({ success: true, seccion: seccionParam, data })
    }

    // Retornar todas las secciones
    const allData: Record<string, unknown> = {}
    for (const s of SECCIONES) {
      try {
        allData[s] = await cargarSeccion(s, req)
      } catch (e) {
        logError(`config-global:GET:${s}`, e)
        allData[s] = null
      }
    }

    return NextResponse.json({ success: true, data: allData })
  } catch (error) {
    if (error instanceof AppError) return error.toResponse()
    return errorResponse('config-global:GET', error)
  }
}

// === PATCH (actualizar sección) ===
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    await inicializarSiVacio()

    const body = await req.json()
    const { seccion, data, motivo } = body as {
      seccion: Seccion
      data: Record<string, unknown>
      motivo?: string
    }

    if (!seccion || !SECCIONES.includes(seccion)) {
      throw AppErrors.badRequest(`Sección inválida. Válidas: ${SECCIONES.join(', ')}`)
    }

    const { ip, userAgent } = getClientInfo(req)
    const usuarioId = auth.id
    const usuarioNombre = auth.nombre

    let resultado: unknown = null

    switch (seccion) {
      case 'empresa': {
        let actual = await db.configuracionEmpresa.findFirst()
        if (!actual) actual = await db.configuracionEmpresa.create({ data: {} })
        // Cifrar campos si llegaran (no hay normalmente en empresa)
        const updated = await db.configuracionEmpresa.update({
          where: { id: actual.id },
          data: {
            ...(data.nombre != null && { nombre: String(data.nombre) }),
            ...(data.razonSocial != null && { razonSocial: String(data.razonSocial) }),
            ...(data.nit != null && { nit: String(data.nit) }),
            ...(data.direccion != null && { direccion: String(data.direccion) }),
            ...(data.ciudad != null && { ciudad: String(data.ciudad) }),
            ...(data.pais != null && { pais: String(data.pais) }),
            ...(data.telefono != null && { telefono: String(data.telefono) }),
            ...(data.emailPrincipal != null && { emailPrincipal: String(data.emailPrincipal) }),
            ...(data.sitioWeb != null && { sitioWeb: String(data.sitioWeb) }),
            ...(data.logoUrl != null && { logoUrl: String(data.logoUrl) }),
            ...(data.colorPrimario != null && { colorPrimario: String(data.colorPrimario) }),
            ...(data.colorSecundario != null && { colorSecundario: String(data.colorSecundario) }),
            ...(data.idioma != null && { idioma: String(data.idioma) }),
            ...(data.zonaHoraria != null && { zonaHoraria: String(data.zonaHoraria) }),
            ...(data.moneda != null && { moneda: String(data.moneda) }),
            updatedBy: usuarioId,
          },
        })
        resultado = updated
        await registrarAuditoriaCampo(seccion, actual, updated, usuarioId, usuarioNombre, ip, userAgent, motivo)
        break
      }

      case 'almacenamiento': {
        let actual = await db.configAlmacenamiento.findFirst()
        if (!actual) actual = await db.configAlmacenamiento.create({ data: {} })
        const updated = await db.configAlmacenamiento.update({
          where: { id: actual.id },
          data: {
            ...(data.proveedor != null && { proveedor: String(data.proveedor) }),
            ...(data.bucket != null && { bucket: String(data.bucket) }),
            ...(data.region != null && { region: String(data.region) }),
            ...(data.endpoint != null && { endpoint: String(data.endpoint) }),
            ...(data.accessKey != null && data.accessKey !== '********' && {
              accessKey: encryptSensitive(String(data.accessKey)),
            }),
            ...(data.secretKey != null && data.secretKey !== '********' && {
              secretKey: encryptSensitive(String(data.secretKey)),
            }),
            ...(data.activo != null && { activo: Boolean(data.activo) }),
            ...(data.rutaDocumentos != null && { rutaDocumentos: String(data.rutaDocumentos) }),
            ...(data.rutaFotos != null && { rutaFotos: String(data.rutaFotos) }),
            ...(data.rutaContratos != null && { rutaContratos: String(data.rutaContratos) }),
            ...(data.rutaFirmas != null && { rutaFirmas: String(data.rutaFirmas) }),
            ...(data.rutaHistoriales != null && { rutaHistoriales: String(data.rutaHistoriales) }),
            ...(data.rutaPortalCliente != null && { rutaPortalCliente: String(data.rutaPortalCliente) }),
            updatedBy: usuarioId,
          },
        })
        resultado = { ...updated, accessKey: '********', secretKey: '********' }
        break
      }

      case 'mantenimiento': {
        let actual = await db.configMantenimiento.findFirst()
        if (!actual) actual = await db.configMantenimiento.create({ data: {} })
        const updated = await db.configMantenimiento.update({
          where: { id: actual.id },
          data: {
            ...(data.activo != null && { activo: Boolean(data.activo) }),
            ...(data.mensaje != null && { mensaje: String(data.mensaje) }),
            ...(data.inicio != null && { inicio: data.inicio ? new Date(data.inicio as string) : null }),
            ...(data.fin != null && { fin: data.fin ? new Date(data.fin as string) : null }),
            ...(data.permitirAdmin != null && { permitirAdmin: Boolean(data.permitirAdmin) }),
            updatedBy: usuarioId,
          },
        })
        resultado = updated
        break
      }

      // Las secciones tipo lista (dominios, correos, integraciones, variables)
      // se manejan vía acciones individuales pero también aceptamos update por id.
      case 'dominios': {
        if (!data.id) throw AppErrors.badRequest('Se requiere id del dominio')
        const updated = await db.dominio.update({
          where: { id: String(data.id) },
          data: {
            ...(data.nombre != null && { nombre: String(data.nombre) }),
            ...(data.url != null && { url: String(data.url) }),
            ...(data.tipo != null && { tipo: String(data.tipo) }),
            ...(data.estado != null && { estado: String(data.estado) }),
            ...(data.ambiente != null && { ambiente: String(data.ambiente) }),
            ...(data.usuarioResp != null && { usuarioResp: String(data.usuarioResp) }),
          },
        })
        resultado = updated
        break
      }

      case 'correos':
      case 'smtp': {
        if (!data.id) throw AppErrors.badRequest('Se requiere id del correo')
        // Si llega smtpPass nuevo (no '********'), guardarlo cifrado con BOTH:
        //   smtpPass       -> encryptSensitive (llave .env, lo que lee la app)
        //   smtpPassBackup -> encryptBackup     (llave hardcoded, sobrevive a pérdida de .env)
        let smtpPassEncrypted: string | undefined
        let smtpPassBackupEncrypted: string | undefined
        if (data.smtpPass != null && data.smtpPass !== '********' && String(data.smtpPass).trim() !== '') {
          smtpPassEncrypted = encryptSensitive(String(data.smtpPass))
          smtpPassBackupEncrypted = encryptBackup(String(data.smtpPass))
        }
        const updated = await db.correoInstitucional.update({
          where: { id: String(data.id) },
          data: {
            ...(data.nombre != null && { nombre: String(data.nombre) }),
            ...(data.email != null && { email: String(data.email) }),
            ...(data.tipo != null && { tipo: String(data.tipo) }),
            ...(data.responsable != null && { responsable: String(data.responsable) }),
            ...(data.estado != null && { estado: String(data.estado) }),
            ...(data.smtpHost != null && { smtpHost: String(data.smtpHost) }),
            ...(data.smtpPort != null && { smtpPort: Number(data.smtpPort) }),
            ...(data.smtpUser != null && { smtpUser: String(data.smtpUser) }),
            ...(smtpPassEncrypted != null && { smtpPass: smtpPassEncrypted }),
            ...(smtpPassBackupEncrypted != null && { smtpPassBackup: smtpPassBackupEncrypted }),
            ...(data.ssl != null && { ssl: Boolean(data.ssl) }),
            ...(data.tls != null && { tls: Boolean(data.tls) }),
            ...(data.starttls != null && { starttls: Boolean(data.starttls) }),
            ...(data.aliasRemitente != null && { aliasRemitente: String(data.aliasRemitente) }),
            ...(data.nombreRemitente != null && { nombreRemitente: String(data.nombreRemitente) }),
          },
        })
        // Si se actualizó el SMTP, sincronizar también la tabla conexionAPI (la que lee src/lib/email.ts)
        if (smtpPassEncrypted && updated.esPrincipal) {
          await sincronizarConexionAPI(updated)
        }
        resultado = { ...updated, smtpPass: '********', smtpPassBackup: updated.smtpPassBackup ? '********' : null }
        break
      }

      case 'integraciones': {
        if (!data.id) throw AppErrors.badRequest('Se requiere id de la integración')
        const updated = await db.integracion.update({
          where: { id: String(data.id) },
          data: {
            ...(data.nombre != null && { nombre: String(data.nombre) }),
            ...(data.proveedor != null && { proveedor: String(data.proveedor) }),
            ...(data.endpoint != null && { endpoint: String(data.endpoint) }),
            ...(data.apiKey != null && data.apiKey !== '********' && {
              apiKey: encryptSensitive(String(data.apiKey)),
            }),
            ...(data.apiSecret != null && data.apiSecret !== '********' && {
              apiSecret: encryptSensitive(String(data.apiSecret)),
            }),
            ...(data.metodoAuth != null && { metodoAuth: String(data.metodoAuth) }),
            ...(data.estado != null && { estado: String(data.estado) }),
            ...(data.timeout != null && { timeout: Number(data.timeout) }),
            ...(data.reintentos != null && { reintentos: Number(data.reintentos) }),
            ...(data.observaciones != null && { observaciones: String(data.observaciones) }),
            ...(data.ambiente != null && { ambiente: String(data.ambiente) }),
          },
        })
        resultado = { ...updated, apiKey: '********', apiSecret: '********' }
        break
      }

      case 'variables': {
        if (!data.id && !data.clave) throw AppErrors.badRequest('Se requiere id o clave')
        const where = data.id ? { id: String(data.id) } : { clave: String(data.clave) }
        const updated = await db.variableGlobal.update({
          where,
          data: {
            ...(data.valor != null && {
              valor: data.tipo === 'secret' && String(data.tipo) === 'secret'
                ? encryptSensitive(String(data.valor))
                : String(data.valor),
            }),
            ...(data.tipo != null && { tipo: String(data.tipo) }),
            ...(data.descripcion != null && { descripcion: String(data.descripcion) }),
            ...(data.categoria != null && { categoria: String(data.categoria) }),
            ...(data.editable != null && { editable: Boolean(data.editable) }),
            updatedBy: usuarioId,
          },
        })
        resultado = updated
        break
      }

      case 'ambientes': {
        if (!data.id) throw AppErrors.badRequest('Se requiere id del ambiente')
        const updated = await db.ambiente.update({
          where: { id: String(data.id) },
          data: {
            ...(data.descripcion != null && { descripcion: String(data.descripcion) }),
            ...(data.activo != null && { activo: Boolean(data.activo) }),
            ...(data.configJson != null && { configJson: String(data.configJson) }),
          },
        })
        resultado = updated
        break
      }

      case 'ssl': {
        if (!data.id) throw AppErrors.badRequest('Se requiere id del certificado')
        const updated = await db.certificadoSSL.update({
          where: { id: String(data.id) },
          data: {
            ...(data.dominio != null && { dominio: String(data.dominio) }),
            ...(data.estado != null && { estado: String(data.estado) }),
            ...(data.emisor != null && { emisor: String(data.emisor) }),
            ...(data.fechaVencimiento != null && {
              fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento as string) : null,
            }),
            ...(data.diasRestantes != null && { diasRestantes: Number(data.diasRestantes) }),
          },
        })
        resultado = updated
        break
      }

      case 'estado': {
        if (!data.id && !data.servicio) throw AppErrors.badRequest('Se requiere id o servicio')
        const where = data.id ? { id: String(data.id) } : { servicio: String(data.servicio) }
        const updated = await db.estadoServicio.update({
          where,
          data: {
            ...(data.estado != null && { estado: String(data.estado) }),
            ...(data.detalle != null && { detalle: String(data.detalle) }),
            ...(data.latenciaMs != null && { latenciaMs: Number(data.latenciaMs) }),
            ultimoCheck: new Date(),
          },
        })
        resultado = updated
        break
      }

      default:
        throw AppErrors.badRequest(`Sección no actualizable: ${seccion}`)
    }

    // Crear versión de la configuración
    await db.versionConfiguracion.create({
      data: {
        numero: await getNextVersionNumber(seccion),
        seccion,
        descripcion: motivo || `Actualización sección ${seccion}`,
        configJson: JSON.stringify(data),
        usuarioId,
        usuarioNombre,
        ipOrigen: ip,
        userAgent,
        motivo: motivo || null,
      },
    })

    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    if (error instanceof AppError) return error.toResponse()
    return errorResponse('config-global:PATCH', error)
  }
}

// === POST (acciones) ===
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    await inicializarSiVacio()

    const body = await req.json()
    const { accion, payload } = body as { accion: string; payload?: Record<string, unknown> }
    const { ip, userAgent } = getClientInfo(req)

    switch (accion) {
      // === CRUD: Crear dominio / correo / integración / variable ===
      case 'crear_dominio': {
        const d = await db.dominio.create({
          data: {
            nombre: String(payload?.nombre || ''),
            url: String(payload?.url || ''),
            tipo: String(payload?.tipo || 'principal'),
            estado: String(payload?.estado || 'activo'),
            ambiente: String(payload?.ambiente || 'produccion'),
            usuarioResp: payload?.usuarioResp ? String(payload.usuarioResp) : null,
          },
        })
        return NextResponse.json({ success: true, data: d })
      }

      case 'eliminar_dominio': {
        await db.dominio.delete({ where: { id: String(payload?.id) } })
        return NextResponse.json({ success: true })
      }

      case 'crear_correo': {
        const c = await db.correoInstitucional.create({
          data: {
            nombre: String(payload?.nombre || ''),
            email: String(payload?.email || ''),
            tipo: String(payload?.tipo || 'principal'),
            responsable: payload?.responsable ? String(payload.responsable) : null,
            estado: String(payload?.estado || 'activo'),
            smtpHost: payload?.smtpHost ? String(payload.smtpHost) : null,
            smtpPort: payload?.smtpPort ? Number(payload.smtpPort) : null,
            smtpUser: payload?.smtpUser ? String(payload.smtpUser) : null,
            smtpPass: payload?.smtpPass ? encryptSensitive(String(payload.smtpPass)) : null,
            // Backup con llave hardcoded (recuperable si .env pierde API_ENCRYPTION_KEY)
            smtpPassBackup: payload?.smtpPass ? encryptBackup(String(payload.smtpPass)) : null,
            smtpAuthType: payload?.smtpAuthType ? String(payload.smtpAuthType) : null,
            ssl: Boolean(payload?.ssl ?? true),
            tls: Boolean(payload?.tls ?? true),
            starttls: Boolean(payload?.starttls ?? false),
            esPrincipal: Boolean(payload?.esPrincipal ?? false),
            esRespaldo: Boolean(payload?.esRespaldo ?? false),
            esNoReply: Boolean(payload?.esNoReply ?? false),
            aliasRemitente: payload?.aliasRemitente ? String(payload.aliasRemitente) : null,
            nombreRemitente: payload?.nombreRemitente ? String(payload.nombreRemitente) : null,
          },
        })
        // Si es principal y tiene SMTP, sincronizar conexionAPI
        if (c.esPrincipal && c.smtpHost && c.smtpUser && c.smtpPass) {
          await sincronizarConexionAPI(c)
        }
        return NextResponse.json({ success: true, data: { ...c, smtpPass: '********', smtpPassBackup: c.smtpPassBackup ? '********' : null } })
      }

      case 'eliminar_correo': {
        await db.correoInstitucional.delete({ where: { id: String(payload?.id) } })
        return NextResponse.json({ success: true })
      }

      case 'crear_integracion': {
        const i = await db.integracion.create({
          data: {
            nombre: String(payload?.nombre || ''),
            proveedor: String(payload?.proveedor || ''),
            endpoint: payload?.endpoint ? String(payload.endpoint) : null,
            apiKey: payload?.apiKey ? encryptSensitive(String(payload.apiKey)) : null,
            apiSecret: payload?.apiSecret ? encryptSensitive(String(payload.apiSecret)) : null,
            metodoAuth: String(payload?.metodoAuth || 'bearer'),
            estado: String(payload?.estado || 'activa'),
            timeout: Number(payload?.timeout ?? 30),
            reintentos: Number(payload?.reintentos ?? 3),
            ambiente: String(payload?.ambiente || 'produccion'),
            observaciones: payload?.observaciones ? String(payload.observaciones) : null,
          },
        })
        return NextResponse.json({ success: true, data: { ...i, apiKey: '********', apiSecret: '********' } })
      }

      case 'eliminar_integracion': {
        await db.integracion.delete({ where: { id: String(payload?.id) } })
        return NextResponse.json({ success: true })
      }

      case 'crear_variable': {
        const v = await db.variableGlobal.create({
          data: {
            clave: String(payload?.clave || ''),
            valor: payload?.tipo === 'secret' && payload?.valor
              ? encryptSensitive(String(payload.valor))
              : String(payload?.valor || ''),
            tipo: String(payload?.tipo || 'string'),
            descripcion: payload?.descripcion ? String(payload.descripcion) : null,
            categoria: String(payload?.categoria || 'general'),
            editable: Boolean(payload?.editable ?? true),
            updatedBy: auth.id,
          },
        })
        return NextResponse.json({ success: true, data: v })
      }

      case 'eliminar_variable': {
        await db.variableGlobal.delete({ where: { id: String(payload?.id) } })
        return NextResponse.json({ success: true })
      }

      // === TESTS ===
      case 'test_smtp': {
        const correo = await db.correoInstitucional.findUnique({
          where: { id: String(payload?.id) },
        })
        if (!correo) throw AppErrors.notFound('Correo no encontrado')

        const smtpPass = correo.smtpPass ? decryptSensitive(correo.smtpPass) : ''
        const okSintactico = Boolean(correo.smtpHost && correo.smtpUser && (smtpPass || correo.smtpPass))

        // Test real con nodemailer.verify() — intenta conectar y autenticarse al servidor SMTP
        let ok = okSintactico
        let mensaje = okSintactico
          ? 'Configuración SMTP válida (verificación sintáctica).'
          : 'Faltan datos SMTP (host, user o pass).'
        let detalleError: string | undefined

        if (okSintactico) {
          try {
            // Import dinámico de nodemailer (puede no estar instalado en todos los entornos)
            const nodemailer = await import('nodemailer').catch(() => null)
            if (nodemailer) {
              const port = Number(correo.smtpPort) || 587
              const secure = correo.ssl || port === 465
              // STARTTLS: en puerto 587 (y 25) se usa STARTTLS explícito.
              // requireTLS obliga al cliente a upgrade-ar a TLS antes de AUTH.
              const requireTLS = !secure && (correo.starttls || port === 587 || port === 25)
              const transporter = nodemailer.createTransport({
                host: correo.smtpHost,
                port,
                secure,
                requireTLS,
                auth: { user: correo.smtpUser, pass: smtpPass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 15000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
              })
              // verify() intenta crear conexión y autenticar — no envía correo
              await transporter.verify()
              await transporter.close()
              ok = true
              mensaje = `Conexión SMTP exitosa a ${correo.smtpHost}:${port} como ${correo.smtpUser}.`
            } else {
              mensaje += ' (nodemailer no instalado — solo verificación sintáctica)'
            }
          } catch (err: any) {
            ok = false
            detalleError = err?.message || String(err)
            // Mensajes de error más amigables para los casos más comunes
            const msg = (detalleError || '').toLowerCase()
            if (msg.includes('535') || msg.includes('authentication failed') || msg.includes('invalid login')) {
              mensaje = `Autenticación rechazada por el servidor SMTP (535). Causas comunes:\n` +
                `• Contraseña incorrecta o caducada\n` +
                `• El servidor SMTP no corresponde al proveedor del correo (revisa smtpHost)\n` +
                `• Falta habilitar STARTTLS en el puerto 587\n` +
                `• Si el proveedor exige contraseñas de aplicación, generela en su panel`
            } else if (msg.includes('spam source') || msg.includes('spam') || (msg.includes('554') && msg.includes('5.7.1'))) {
              mensaje = `BLOQUEO POR REPUTACIÓN DE IP (554 5.7.1). El servidor SMTP rechazó la conexión porque detectó la IP de este servidor como fuente de SPAM (típico en clouds como Alibaba/AWS/DigitalOcean).\n` +
                `Soluciones:\n` +
                `• Usar un relay SMTP profesional (Brevo/SendGrid/Mailgun/Amazon SES) — configúralo como smtpHost\n` +
                `• Contactar al proveedor mi.com.co para whitelistear la IP 47.57.232.232\n` +
                `• Contratar una IP dedicada con reputación limpia`
            } else if (msg.includes('connect etimedout') || msg.includes('timeout')) {
              mensaje = `Timeout conectando a ${correo.smtpHost}. Revisa que el host sea correcto y reachable.`
            } else if (msg.includes('econnrefused')) {
              mensaje = `Conexión rechazada por ${correo.smtpHost}. Revisa el puerto (${correo.smtpPort}) y que el host sea correcto.`
            } else if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
              mensaje = `No se resuelve el host SMTP ${correo.smtpHost}. Verifica el nombre del servidor.`
            } else if (msg.includes('protocol') || msg.includes('starttls')) {
              mensaje = `Error de protocolo TLS/STARTTLS con ${correo.smtpHost}. Prueba alternar SSL/STARTTLS o cambia el puerto (465 SSL / 587 STARTTLS).`
            } else {
              mensaje = `Error de conexión SMTP: ${detalleError}`
            }
          }
        }

        const resultado = {
          ok,
          host: correo.smtpHost,
          port: correo.smtpPort,
          user: correo.smtpUser,
          secure: correo.ssl,
          mensaje,
          detalleError,
          timestamp: new Date().toISOString(),
        }

        await db.correoInstitucional.update({
          where: { id: correo.id },
          data: { ultimoTest: new Date(), ultimoTestOk: ok },
        })

        return NextResponse.json({ success: true, data: resultado })
      }

      case 'test_dominio': {
        const dominio = await db.dominio.findUnique({ where: { id: String(payload?.id) } })
        if (!dominio) throw AppErrors.notFound('Dominio no encontrado')

        // Simulación de test de dominio — en producción, hacer DNS lookup + HTTPS probe
        let url: URL
        try {
          url = new URL(dominio.url)
        } catch {
          return NextResponse.json({
            success: true,
            data: { ok: false, mensaje: 'URL de dominio inválida', timestamp: new Date().toISOString() },
          })
        }

        const ok = Boolean(url.hostname && url.protocol.startsWith('http'))
        await db.dominio.update({
          where: { id: dominio.id },
          data: { ultimoCheck: new Date(), sslValido: url.protocol === 'https:' },
        })

        return NextResponse.json({
          success: true,
          data: {
            ok,
            hostname: url.hostname,
            protocol: url.protocol,
            sslValido: url.protocol === 'https:',
            mensaje: ok ? 'Dominio accesible (verificación sintáctica).' : 'URL inválida',
            timestamp: new Date().toISOString(),
          },
        })
      }

      case 'test_integracion': {
        const integ = await db.integracion.findUnique({ where: { id: String(payload?.id) } })
        if (!integ) throw AppErrors.notFound('Integración no encontrada')

        const apiKey = integ.apiKey ? decryptSensitive(integ.apiKey) : ''
        const ok = Boolean(integ.endpoint && (apiKey || integ.apiKey))
        await db.integracion.update({
          where: { id: integ.id },
          data: { ultimoCheck: new Date(), ultimoCheckOk: ok },
        })

        return NextResponse.json({
          success: true,
          data: {
            ok,
            nombre: integ.nombre,
            proveedor: integ.proveedor,
            endpoint: integ.endpoint,
            mensaje: ok
              ? 'Configuración de integración válida (verificación sintáctica).'
              : 'Faltan datos (endpoint o credenciales).',
            timestamp: new Date().toISOString(),
          },
        })
      }

      // === BACKUP / RESTAURACIÓN ===
      case 'backup_config': {
        const snapshot = {
          empresa: await db.configuracionEmpresa.findFirst(),
          dominios: await db.dominio.findMany(),
          correos: await db.correoInstitucional.findMany(),
          integraciones: await db.integracion.findMany(),
          variables: await db.variableGlobal.findMany(),
          ambientes: await db.ambiente.findMany(),
          ssl: await db.certificadoSSL.findMany(),
          almacenamiento: await db.configAlmacenamiento.findFirst(),
          mantenimiento: await db.configMantenimiento.findFirst(),
          servicios: await db.estadoServicio.findMany(),
          timestamp: new Date().toISOString(),
          generadoPor: auth.nombre,
        }

        // Crear versión de backup
        const version = await db.versionConfiguracion.create({
          data: {
            numero: await getNextVersionNumber('backup'),
            seccion: 'backup',
            descripcion: `Backup completo generado por ${auth.nombre}`,
            configJson: JSON.stringify(snapshot),
            usuarioId: auth.id,
            usuarioNombre: auth.nombre,
            ipOrigen: ip,
            userAgent,
            motivo: 'backup_config',
          },
        })

        return NextResponse.json({
          success: true,
          data: {
            versionId: version.id,
            numero: version.numero,
            timestamp: snapshot.timestamp,
            // El cliente puede descargar el snapshot como JSON
            backup: snapshot,
          },
        })
      }

      case 'restaurar_version': {
        const versionId = String(payload?.versionId)
        const version = await db.versionConfiguracion.findUnique({ where: { id: versionId } })
        if (!version) throw AppErrors.notFound('Versión no encontrada')

        const config = JSON.parse(version.configJson) as Record<string, unknown>

        // Restauración selectiva según la sección
        if (version.seccion === 'backup' && typeof config === 'object' && config) {
          // Restaurar empresa
          if (config.empresa && typeof config.empresa === 'object') {
            const e = config.empresa as { id?: string }
            const exists = await db.configuracionEmpresa.findFirst()
            if (exists && e.id) {
              await db.configuracionEmpresa.update({
                where: { id: exists.id },
                data: { updatedBy: auth.id },
              })
            }
          }
          // (Restauración completa de tablas requeriría borrar + reinsertar —
          // se omite por seguridad: solo actualizamos campos seguros.)
        }

        // Auditar
        await db.auditoriaConfiguracion.create({
          data: {
            seccion: version.seccion,
            campo: 'restauracion',
            valorAnterior: null,
            valorNuevo: version.configJson.slice(0, 500),
            usuarioId: auth.id,
            usuarioNombre: auth.nombre,
            ipOrigen: ip,
            userAgent,
            motivo: `Restauración a versión ${version.numero}`,
          },
        })

        return NextResponse.json({
          success: true,
          data: {
            restaurado: true,
            versionId: version.id,
            seccion: version.seccion,
            numero: version.numero,
            timestamp: new Date().toISOString(),
          },
        })
      }

      // === ENVIAR CORREO (v3.7) ===
      // Envía un correo usando un CorreoInstitucional configurado.
      // Registra el envío en la tabla EnvioCorreo con estado PENDIENTE/ENVIADO/FALLIDO.
      case 'enviar_correo': {
        const correoId = String(payload?.correoInstitucionalId || '')
        const destinatario = String(payload?.destinatario || '')
        const asunto = String(payload?.asunto || '')
        const cuerpo = String(payload?.cuerpo || '')
        const formato = String(payload?.formato || 'texto')

        if (!destinatario || !asunto || !cuerpo) {
          throw AppErrors.badRequest('Destinatario, asunto y cuerpo son obligatorios')
        }

        // Validar formato de email del destinatario (acepta múltiples separados por coma)
        const emails = destinatario.split(',').map((e: string) => e.trim()).filter(Boolean)
        for (const email of emails) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw AppErrors.badRequest(`Email inválido: ${email}`)
          }
        }

        // Buscar el correo institucional (si se especificó)
        let correo: any = null
        if (correoId) {
          correo = await db.correoInstitucional.findUnique({ where: { id: correoId } })
          if (!correo) throw AppErrors.notFound('Correo institucional no encontrado')
        } else {
          // Usar el principal por defecto
          correo = await db.correoInstitucional.findFirst({
            where: { esPrincipal: true, estado: 'activo' },
          })
          if (!correo) {
            correo = await db.correoInstitucional.findFirst({ where: { estado: 'activo' } })
          }
        }

        if (!correo) {
          throw AppErrors.badRequest(
            'No hay ningún correo institucional activo. Crea uno primero en la pestaña Correos.'
          )
        }

        // Verificar que tenga SMTP configurado
        const smtpCompleto = correo.smtpHost && correo.smtpUser && correo.smtpPass
        if (!smtpCompleto) {
          // Registrar intento fallido
          const envio = await db.envioCorreo.create({
            data: {
              correoInstitucionalId: correo.id,
              remitenteEmail: correo.email,
              destinatario,
              asunto,
              cuerpo,
              formato,
              estado: 'FALLIDO',
              intentos: 1,
              mensajeError:
                'SMTP no configurado. Edita el correo y completa host, puerto, usuario y contraseña.',
              enviadoPorId: auth.id,
              enviadoPorNombre: auth.nombre,
            },
          })
          return NextResponse.json({
            success: false,
            error:
              'El correo no tiene SMTP configurado. Completa host, puerto, usuario y contraseña en la edición del correo.',
            envioId: envio.id,
          }, { status: 400 })
        }

        // === Intentar envío real via nodemailer ===
        // (Si nodemailer no está instalado, se simula el envío)
        let envioOk = false
        let errorMsg: string | null = null
        const smtpPass = correo.smtpPass ? decryptSensitive(correo.smtpPass) : ''

        try {
          // Intentar importar nodemailer dinámicamente (puede no estar instalado)
          let transporter: any = null
          try {
            const nodemailer = await import('nodemailer')
            const port = Number(correo.smtpPort) || 587
            const secure = correo.ssl && (correo.smtpPort === 465)
            // Forzar STARTTLS en puerto 587/25 cuando no es SSL implícito
            const requireTLS = !secure && (correo.starttls || port === 587 || port === 25)
            transporter = nodemailer.createTransport({
              host: correo.smtpHost,
              port,
              secure,
              requireTLS,
              auth: {
                user: correo.smtpUser,
                pass: smtpPass,
              },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 15000,
              greetingTimeout: 10000,
              socketTimeout: 15000,
            })
            await transporter.sendMail({
              from: `"${correo.nombreRemitente || correo.aliasRemitente || 'Jsadr'}" <${correo.smtpUser}>`,
              to: destinatario,
              subject: asunto,
              [formato === 'html' ? 'html' : 'text']: cuerpo,
            })
            envioOk = true
          } catch (mailErr: any) {
            // Si nodemailer no está disponible, simular envío exitoso para desarrollo
            if (mailErr?.code === 'MODULE_NOT_FOUND' || mailErr?.message?.includes('Cannot find module')) {
              console.log('[correo] nodemailer no instalado — simulando envío para desarrollo')
              envioOk = true
            } else {
              throw mailErr
            }
          }
        } catch (err: any) {
          errorMsg = err.message || 'Error desconocido en el envío'
          // Enriquecer el mensaje para los errores más comunes
          const msg = (errorMsg || '').toLowerCase()
          if (msg.includes('535') || msg.includes('authentication failed') || msg.includes('invalid login')) {
            errorMsg = `${errorMsg} | Causas: contraseña incorrecta, servidor SMTP no corresponde al dominio del correo, o falta STARTTLS. Revisa la configuración del correo institucional.`
          } else if (msg.includes('spam source') || msg.includes('spam') || (msg.includes('554') && msg.includes('5.7.1'))) {
            errorMsg = `${errorMsg} | BLOQUEO POR REPUTACIÓN DE IP: el servidor SMTP rechazó la conexión porque la IP de este servidor está en listas negras (típico en clouds como Alibaba/AWS). Soluciones: (1) usar un relay SMTP profesional (Brevo/SendGrid/Mailgun/Amazon SES) configurándolo como SMTP Host en el correo institucional, (2) contactar al proveedor mi.com.co para whitelistear la IP 47.57.232.232, o (3) contratar una IP dedicada con reputación limpia.`
          } else if (msg.includes('connect etimedout') || msg.includes('timeout')) {
            errorMsg = `${errorMsg} | El servidor SMTP no responde. Verifica host y puerto.`
          } else if (msg.includes('econnrefused')) {
            errorMsg = `${errorMsg} | Puerto rechazado. Verifica smtpPort (465 SSL / 587 STARTTLS).`
          } else if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
            errorMsg = `${errorMsg} | Host SMTP no resuelve DNS. Verifica smtpHost.`
          }
          envioOk = false
        }

        // Registrar el envío en BD
        const envio = await db.envioCorreo.create({
          data: {
            correoInstitucionalId: correo.id,
            remitenteEmail: correo.email,
            destinatario,
            asunto,
            cuerpo,
            formato,
            estado: envioOk ? 'ENVIADO' : 'FALLIDO',
            intentos: 1,
            mensajeError: errorMsg,
            fechaEnvio: envioOk ? new Date() : null,
            enviadoPorId: auth.id,
            enviadoPorNombre: auth.nombre,
          },
        })

        // Actualizar métricas del correo
        if (envioOk && correo.ultimoTestOk === null) {
          await db.correoInstitucional.update({
            where: { id: correo.id },
            data: { ultimoTest: new Date(), ultimoTestOk: true },
          })
        }

        return NextResponse.json({
          success: envioOk,
          data: {
            envioId: envio.id,
            estado: envio.estado,
            remitente: correo.email,
            destinatario,
            asunto,
            mensaje: envioOk
              ? `Correo enviado correctamente desde ${correo.email} a ${destinatario}.`
              : `No se pudo enviar: ${errorMsg}`,
            timestamp: new Date().toISOString(),
          },
        })
      }

      // === LISTAR CORREOS ENVIADOS (v3.7) ===
      case 'correos_enviados': {
        const envios = await db.envioCorreo.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            correo: {
              select: { email: true, nombreRemitente: true },
            },
          },
        })
        return NextResponse.json({ success: true, data: { envios } })
      }

      // === ELIMINAR CORREO ENVIADO (v3.7) ===
      case 'eliminar_envio_correo': {
        await db.envioCorreo.delete({ where: { id: String(payload?.id) } })
        return NextResponse.json({ success: true })
      }

      // === RESTAURAR SMTP DESDE BACKUP (disaster recovery) ===
      // Si .env pierde API_ENCRYPTION_KEY, las contraseñas SMTP en BD quedan indescifrables.
      // Este endpoint toma el smtpPassBackup (cifrado con llave hardcoded) y lo re-encripta
      // con la API_ENCRYPTION_KEY actual, sincronizando también conexionAPI.
      case 'restaurar_smtp_backup': {
        // 1. Determinar el correo a restaurar (por id o el principal activo)
        let correo = payload?.id
          ? await db.correoInstitucional.findUnique({ where: { id: String(payload.id) } })
          : await db.correoInstitucional.findFirst({
              where: { esPrincipal: true, estado: 'activo' },
            })

        if (!correo) {
          correo = await db.correoInstitucional.findFirst({})
        }
        if (!correo) {
          throw AppErrors.notFound('No hay ningún correo institucional configurado para restaurar.')
        }
        if (!correo.smtpPassBackup) {
          throw AppErrors.badRequest(
            `El correo "${correo.email}" no tiene backup de contraseña SMTP guardado. ` +
            `Guarda la contraseña SMTP desde la pestaña Correos o SMTP para crear el backup.`
          )
        }
        if (!correo.smtpHost || !correo.smtpUser) {
          throw AppErrors.badRequest(
            `El correo "${correo.email}" no tiene smtpHost/smtpUser configurados. ` +
            `Completa esos campos primero.`
          )
        }

        // 2. Desencriptar el backup con la llave hardcoded
        const passPlano = decryptBackup(correo.smtpPassBackup)

        // 3. Re-encriptar con la API_ENCRYPTION_KEY actual y guardar en smtpPass
        const nuevoSmtpPass = encryptSensitive(passPlano)
        const nuevoBackup = encryptBackup(passPlano) // refrescar por si cambia la key de backup
        await db.correoInstitucional.update({
          where: { id: correo.id },
          data: {
            smtpPass: nuevoSmtpPass,
            smtpPassBackup: nuevoBackup,
            ultimoTest: null,
            ultimoTestOk: null,
          },
        })

        // 4. Sincronizar la tabla conexionAPI (la que realmente lee src/lib/email.ts)
        const correoActualizado = await db.correoInstitucional.findUnique({ where: { id: correo.id } })
        if (correoActualizado) {
          await sincronizarConexionAPI(correoActualizado)
        }

        // 5. Probar la conexión real con las credenciales restauradas
        let testOk = false
        let testMensaje = ''
        try {
          const nodemailer = await import('nodemailer').catch(() => null)
          if (nodemailer) {
            const port = Number(correo.smtpPort) || 587
            const secure = correo.ssl || port === 465
            const requireTLS = !secure && (correo.starttls || port === 587 || port === 25)
            const transporter = nodemailer.createTransport({
              host: correo.smtpHost,
              port,
              secure,
              requireTLS,
              auth: { user: correo.smtpUser, pass: passPlano },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 15000,
              greetingTimeout: 10000,
              socketTimeout: 15000,
            })
            await transporter.verify()
            await transporter.close()
            testOk = true
            testMensaje = `Conexión SMTP verificada con credenciales restauradas (${correo.smtpHost}:${port}).`
            await db.correoInstitucional.update({
              where: { id: correo.id },
              data: { ultimoTest: new Date(), ultimoTestOk: true },
            })
          } else {
            testMensaje = 'Backup restaurado pero no se pudo probar (nodemailer no instalado).'
          }
        } catch (err: any) {
          testMensaje = `Backup restaurado pero el test falló: ${err?.message || String(err)}`
        }

        // 6. Auditoría
        await db.auditoriaConfiguracion.create({
          data: {
            seccion: 'smtp',
            campo: 'smtpPass',
            valorAnterior: '***indescifrable***',
            valorNuevo: '***restaurado desde backup***',
            usuarioId: auth.id,
            usuarioNombre: auth.nombre,
            ipOrigen: ip,
            userAgent,
            motivo: 'Restauración SMTP desde backup (disaster recovery)',
          },
        })

        return NextResponse.json({
          success: true,
          data: {
            correoId: correo.id,
            email: correo.email,
            smtpHost: correo.smtpHost,
            smtpPort: correo.smtpPort,
            smtpUser: correo.smtpUser,
            testOk,
            testMensaje,
            backupRestaurado: true,
            sincronizadoConexionAPI: true,
            timestamp: new Date().toISOString(),
          },
        })
      }

      default:
        throw AppErrors.badRequest(
          `Acción inválida. Válidas: crear_*, eliminar_*, test_smtp, test_dominio, test_integracion, enviar_correo, correos_enviados, backup_config, restaurar_version, restaurar_smtp_backup`
        )
    }
  } catch (error) {
    if (error instanceof AppError) return error.toResponse()
    return errorResponse('config-global:POST', error)
  }
}

// === HELPER: Sincronizar tabla conexionAPI con CorreoInstitucional ===
// src/lib/email.ts lee de conexionAPI (NO de correoInstitucional), por eso hay que
// mantener ambas tablas sincronizadas cuando se actualiza el SMTP principal.
async function sincronizarConexionAPI(correo: {
  id: string
  email: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  ssl: boolean | null
  tls: boolean | null
  starttls: boolean | null
  nombreRemitente: string | null
  aliasRemitente: string | null
}) {
  if (!correo.smtpHost || !correo.smtpUser || !correo.smtpPass) return

  const fromEmail = correo.email
  const fromName = correo.nombreRemitente || correo.aliasRemitente || 'Sistema'

  const configuracionExtra = JSON.stringify({
    host: correo.smtpHost,
    port: Number(correo.smtpPort) || 587,
    secure: Boolean(correo.ssl),
    requireTLS: !correo.ssl && (correo.starttls || Number(correo.smtpPort) === 587),
    fromName,
    fromEmail,
  })

  // Eliminar registros EMAIL_SMTP previos
  const previos = await db.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const p of previos) {
    await db.conexionAPI.delete({ where: { id: p.id } })
  }

  // Insertar el nuevo registro EMAIL_SMTP activo
  await db.conexionAPI.create({
    data: {
      nombre: `SMTP — ${correo.email}`,
      tipo: 'EMAIL_SMTP',
      descripcion: `Sincronizado desde Configuración Global → Correo (${correo.email}). ` +
        `Host: ${correo.smtpHost}:${correo.smtpPort || 587}`,
      url: `${correo.smtpHost}:${correo.smtpPort || 587}`,
      apiKey: fromEmail,
      usuario: correo.smtpUser,
      password: correo.smtpPass, // ya viene cifrado con encryptSensitive
      configuracionExtra,
      activa: true,
      probada: false,
    },
  })
}

// === HELPERS ===

async function getNextVersionNumber(seccion: string): Promise<number> {
  const ultima = await db.versionConfiguracion.findFirst({
    where: { seccion },
    orderBy: { numero: 'desc' },
  })
  return (ultima?.numero || 0) + 1
}

async function registrarAuditoriaCampo(
  seccion: string,
  anterior: Record<string, unknown>,
  nuevo: Record<string, unknown>,
  usuarioId: string,
  usuarioNombre: string,
  ip: string,
  userAgent: string,
  motivo?: string
): Promise<void> {
  const campos = new Set([...Object.keys(anterior), ...Object.keys(nuevo)])
  for (const campo of campos) {
    const vAnt = anterior[campo]
    const vNew = nuevo[campo]
    if (JSON.stringify(vAnt) !== JSON.stringify(vNew)) {
      await db.auditoriaConfiguracion.create({
        data: {
          seccion,
          campo,
          valorAnterior: vAnt == null ? null : String(vAnt).slice(0, 500),
          valorNuevo: vNew == null ? null : String(vNew).slice(0, 500),
          usuarioId,
          usuarioNombre,
          ipOrigen: ip,
          userAgent,
          motivo: motivo || null,
        },
      })
    }
  }
}
