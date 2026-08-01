// =====================================================
// Validadores Zod v4 — Jsadr
// 15+ schemas reutilizables para todas las APIs del sistema.
// Función helper validateInput(schema, data) que retorna
// { success, data?, error? }.
// =====================================================

import { z } from 'zod'

// === 1. CLIENTE ===
export const clienteSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto').max(120),
  cedula: z.string().regex(/^\d{6,12}$/, 'Cédula inválida (6-12 dígitos)'),
  telefono: z.string().regex(/^\d{7,15}$/, 'Teléfono inválido'),
  email: z.email('Email inválido').or(z.literal('')),
  direccion: z.string().max(200).optional().default(''),
  ciudad: z.string().max(80).optional().default(''),
  ocupacion: z.string().max(80).optional().default(''),
  empresa: z.string().max(120).optional().default(''),
  fechaNacimiento: z.string().optional().nullable(),
  notas: z.string().max(2000).optional().default(''),
})
export type ClienteInput = z.infer<typeof clienteSchema>

// === 2. PRÉSTAMO ===
export const prestamoSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido'),
  monto: z.number().positive('Monto debe ser positivo').max(1_000_000_000),
  interes: z.number().min(0).max(200, 'Interés excesivo'),
  cuotas: z.number().int().min(1).max(360),
  frecuencia: z.enum(['diario', 'semanal', 'quincenal', 'mensual']),
  fechaInicio: z.string(),
  tipoTasa: z.enum(['fija', 'variable']).optional().default('fija'),
  descripcion: z.string().max(500).optional().default(''),
})
export type PrestamoInput = z.infer<typeof prestamoSchema>

// === 3. PAGO ===
export const pagoSchema = z.object({
  prestamoId: z.string().min(1),
  monto: z.number().positive('Monto debe ser positivo'),
  fecha: z.string().optional(),
  metodo: z.enum(['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro']),
  referencia: z.string().max(100).optional().default(''),
  nota: z.string().max(500).optional().default(''),
})
export type PagoInput = z.infer<typeof pagoSchema>

// === 4. USUARIO ===
export const usuarioSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.email('Email inválido'),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Username inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
  rol: z.enum(['ADMIN', 'GESTOR', 'CONSULTOR']),
  activo: z.boolean().optional().default(true),
})
export type UsuarioInput = z.infer<typeof usuarioSchema>

// === 5. CONEXIÓN API ===
export const conexionApiSchema = z.object({
  nombre: z.string().min(2).max(120),
  tipo: z.string().min(2).max(80),
  descripcion: z.string().max(500).optional().default(''),
  url: z.string().max(500).optional().default(''),
  apiKey: z.string().max(500).optional().default(''),
  apiSecret: z.string().max(500).optional().default(''),
  usuario: z.string().max(120).optional().default(''),
  password: z.string().max(500).optional().default(''),
  accountId: z.string().max(200).optional().default(''),
  telefonoOrigen: z.string().max(50).optional().default(''),
  configuracionExtra: z.string().max(5000).optional().default(''),
  activa: z.boolean().optional().default(false),
  // Retrocompatibilidad con Integracion (campos legacy opcionales)
  proveedor: z.string().max(80).optional(),
  endpoint: z.string().max(500).optional(),
  metodoAuth: z.enum(['bearer', 'basic', 'apikey', 'oauth2', 'none']).optional(),
  estado: z.enum(['activa', 'inactiva', 'error']).optional(),
  timeout: z.number().int().min(1).max(300).optional(),
})
export type ConexionApiInput = z.infer<typeof conexionApiSchema>

// === 6. OTP (solicitud) ===
export const otpSchema = z.object({
  conversacionId: z.string().min(1),
  metodo: z.enum(['sms', 'whatsapp', 'email', 'llamada']),
  telefono: z.string().optional(),
  email: z.email().optional(),
}).refine(
  (d) => d.metodo !== 'sms' || (d.telefono && d.telefono.length >= 7),
  { message: 'Teléfono requerido para SMS', path: ['telefono'] }
).refine(
  (d) => d.metodo !== 'whatsapp' || (d.telefono && d.telefono.length >= 7),
  { message: 'Teléfono requerido para WhatsApp', path: ['telefono'] }
).refine(
  (d) => d.metodo !== 'email' || !!d.email,
  { message: 'Email requerido', path: ['email'] }
)
export type OtpInput = z.infer<typeof otpSchema>

// === 7. OTP (verificación) ===
export const otpVerifySchema = z.object({
  conversacionId: z.string().min(1),
  codigo: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
})
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>

// === 8. SOLICITUD WEB (portal) ===
// Esquema alineado con el frontend del Portal del Cliente (PortalClienteModal.tsx → enviarSolicitud)
// y con la lógica de negocio del route handler en /api/solicitudes-web/route.ts.
// Los datos del cliente (nombre, cédula, teléfono, email) se obtienen del propio clienteId
// autenticado mediante el token del portal, por lo que NO se exigen en el body.
export const solicitudWebSchema = z.object({
  clienteId: z.string().min(1, 'clienteId es obligatorio'),
  token: z.string().min(1, 'token de sesión es obligatorio'),
  valorSolicitado: z.number().positive('valorSolicitado debe ser mayor a 0').max(1_000_000_000),
  numeroCuotas: z.number().int().min(1, 'numeroCuotas debe ser mayor a 0').max(360),
  frecuencia: z.enum(['MENSUAL', 'QUINCENAL', 'SEMANAL', 'DIARIO'], {
    error: 'Frecuencia inválida. Valores permitidos: MENSUAL, QUINCENAL, SEMANAL, DIARIO',
  }),
  primerPagoFecha: z.string().optional(),
  // Campos opcionales para retrocompatibilidad con otros flujos que aún envíen el formato antiguo
  nombre: z.string().min(2).max(120).optional(),
  cedula: z.string().regex(/^\d{6,12}$/).optional(),
  telefono: z.string().regex(/^\d{7,15}$/).optional(),
  email: z.email().or(z.literal('')).optional(),
  motivo: z.string().max(500).optional().default(''),
  aceptaTerminos: z.boolean().optional(),
})
export type SolicitudWebInput = z.infer<typeof solicitudWebSchema>

// === 9. MENSAJE CHAT ===
export const mensajeChatSchema = z.object({
  conversacionId: z.string().min(1),
  contenido: z.string().min(1, 'Mensaje vacío').max(4000),
  tipo: z.enum(['texto', 'imagen', 'archivo', 'sistema']).optional().default('texto'),
  esInterno: z.boolean().optional().default(false),
})
export type MensajeChatInput = z.infer<typeof mensajeChatSchema>

// === 10. NOTA INTERNA ===
export const notaInternaSchema = z.object({
  conversacionId: z.string().min(1),
  contenido: z.string().min(1).max(4000),
  prioridad: z.enum(['baja', 'media', 'alta']).optional().default('media'),
})
export type NotaInternaInput = z.infer<typeof notaInternaSchema>

// === 11. LOGIN ===
export const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
})
export type LoginInput = z.infer<typeof loginSchema>

// === 12. MFA ===
export const mfaSetupSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token de 6 dígitos requerido'),
})
export type MfaSetupInput = z.infer<typeof mfaSetupSchema>

// === 13. DOMINIO (configuración global) ===
export const dominioSchema = z.object({
  nombre: z.string().min(2).max(120),
  url: z.url('URL inválida'),
  tipo: z.enum(['principal', 'secundario', 'redirect', 'subdominio']),
  estado: z.enum(['activo', 'inactivo', 'redireccion']).optional().default('activo'),
  ambiente: z.enum(['produccion', 'staging', 'desarrollo']).optional().default('produccion'),
  usuarioResp: z.string().max(80).optional().nullable(),
})
export type DominioInput = z.infer<typeof dominioSchema>

// === 14. CORREO INSTITUCIONAL ===
export const correoInstitucionalSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.email('Email inválido'),
  tipo: z.enum(['ventas', 'soporte', 'admin', 'noreply', 'principal']),
  responsable: z.string().max(120).optional().nullable(),
  smtpHost: z.string().max(200).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().max(200).optional().nullable(),
  smtpPass: z.string().max(500).optional().nullable(),
  ssl: z.boolean().optional().default(true),
  tls: z.boolean().optional().default(true),
})
export type CorreoInstitucionalInput = z.infer<typeof correoInstitucionalSchema>

// === 15. INTEGRACIÓN ===
export const integracionSchema = z.object({
  nombre: z.string().min(2).max(120),
  proveedor: z.string().min(2).max(80),
  endpoint: z.url().or(z.literal('')).optional().nullable(),
  apiKey: z.string().max(300).optional().nullable(),
  apiSecret: z.string().max(500).optional().nullable(),
  metodoAuth: z.enum(['bearer', 'basic', 'apikey', 'oauth2', 'none']).optional().default('bearer'),
  estado: z.enum(['activa', 'inactiva', 'error']).optional().default('activa'),
  ambiente: z.enum(['produccion', 'staging', 'desarrollo']).optional().default('produccion'),
  observaciones: z.string().max(500).optional().nullable(),
})
export type IntegracionInput = z.infer<typeof integracionSchema>

// === 16. VARIABLE GLOBAL ===
export const variableGlobalSchema = z.object({
  clave: z.string().min(2).max(80).regex(/^[a-zA-Z0-9_.-]+$/, 'Clave inválida'),
  valor: z.string().max(2000),
  tipo: z.enum(['string', 'number', 'boolean', 'json', 'secret']).optional().default('string'),
  descripcion: z.string().max(300).optional().nullable(),
  categoria: z.string().max(60).optional().default('general'),
  editable: z.boolean().optional().default(true),
})
export type VariableGlobalInput = z.infer<typeof variableGlobalSchema>

// === 17. CONFIGURACIÓN EMPRESA ===
export const configuracionEmpresaSchema = z.object({
  nombre: z.string().min(2).max(120),
  razonSocial: z.string().max(150).optional().nullable(),
  nit: z.string().max(30).optional().nullable(),
  direccion: z.string().max(200).optional().nullable(),
  ciudad: z.string().max(80).optional().nullable(),
  pais: z.string().max(60).optional().default('Colombia'),
  telefono: z.string().max(30).optional().nullable(),
  emailPrincipal: z.email().or(z.literal('')).optional().nullable(),
  sitioWeb: z.url().or(z.literal('')).optional().nullable(),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido').optional().default('#6366f1'),
  colorSecundario: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido').optional().default('#a855f7'),
  idioma: z.string().max(10).optional().default('es-CO'),
  zonaHoraria: z.string().max(60).optional().default('America/Bogota'),
  moneda: z.string().max(5).optional().default('COP'),
})
export type ConfiguracionEmpresaInput = z.infer<typeof configuracionEmpresaSchema>

// === 18. PAGinación / Query params ===
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  search: z.string().max(200).optional().default(''),
  sortBy: z.string().max(60).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
export type PaginationInput = z.infer<typeof paginationSchema>

// === HELPER ===
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors: Record<string, string[]> }

export function validateInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  // Zod v4: result.error.issues (array)
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_'
    if (!fieldErrors[path]) fieldErrors[path] = []
    fieldErrors[path].push(issue.message)
  }
  const firstMessage = result.error.issues[0]?.message || 'Datos inválidos'
  return { success: false, error: firstMessage, fieldErrors }
}
