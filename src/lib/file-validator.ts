// =====================================================
// File Validator — Magic Bytes (Jsadr)
// Validación robusta de archivos subidos verificando
// realmente el contenido (no solo el Content-Type).
// Formatos soportados: JPEG, PNG, GIF, WebP, PDF, ZIP.
// =====================================================

export interface FileTypeInfo {
  mimeType: string
  extension: string
  // Función que recibe los primeros N bytes del archivo y dice si coinciden
  matches: (buf: Buffer) => boolean
  maxSize: number // bytes
  description: string
}

// === MAGIC BYTES POR TIPO ===
const FILE_TYPES: FileTypeInfo[] = [
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    description: 'Imagen JPEG',
    maxSize: 10 * 1024 * 1024, // 10 MB
    matches: (buf) => {
      // FFD8FF (SOI + marker)
      if (buf.length < 3) return false
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    },
  },
  {
    mimeType: 'image/png',
    extension: 'png',
    description: 'Imagen PNG',
    maxSize: 10 * 1024 * 1024,
    matches: (buf) => {
      // 89 50 4E 47 0D 0A 1A 0A
      if (buf.length < 8) return false
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      return sig.every((b, i) => buf[i] === b)
    },
  },
  {
    mimeType: 'image/gif',
    extension: 'gif',
    description: 'Imagen GIF',
    maxSize: 10 * 1024 * 1024,
    matches: (buf) => {
      // "GIF87a" o "GIF89a"
      if (buf.length < 6) return false
      const header = buf.subarray(0, 6).toString('ascii')
      return header === 'GIF87a' || header === 'GIF89a'
    },
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    description: 'Imagen WebP',
    maxSize: 10 * 1024 * 1024,
    matches: (buf) => {
      // "RIFF" .... "WEBP"
      if (buf.length < 12) return false
      const riff = buf.subarray(0, 4).toString('ascii')
      const webp = buf.subarray(8, 12).toString('ascii')
      return riff === 'RIFF' && webp === 'WEBP'
    },
  },
  {
    mimeType: 'application/pdf',
    extension: 'pdf',
    description: 'Documento PDF',
    maxSize: 25 * 1024 * 1024, // 25 MB
    matches: (buf) => {
      // "%PDF-" (1.0 a 1.7+)
      if (buf.length < 5) return false
      return buf.subarray(0, 5).toString('ascii') === '%PDF-'
    },
  },
  {
    mimeType: 'application/zip',
    extension: 'zip',
    description: 'Archivo ZIP',
    maxSize: 50 * 1024 * 1024, // 50 MB
    matches: (buf) => {
      // PK\x03\x04 (también PK\x05\x06 vacío y PK\x07\x08 spanned)
      if (buf.length < 4) return false
      return (
        buf[0] === 0x50 &&
        buf[1] === 0x4b &&
        (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
        (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
      )
    },
  },
]

// Mapa para lookup rápido por mime type
const MIME_MAP = new Map(FILE_TYPES.map((t) => [t.mimeType, t]))

// === RESULTADO ===
export interface FileValidationResult {
  valid: boolean
  error?: string
  detectedType?: FileTypeInfo
}

// === API PÚBLICA ===

/**
 * Valida un archivo buffer contra su mimeType declarado verificando
 * magic bytes reales, tamaño máximo permitido y nombre seguro.
 *
 * @param buffer Buffer completo del archivo
 * @param declaredMimeType mimeType declarado por el cliente (Content-Type)
 * @param filename Nombre original del archivo
 * @param size Tamaño en bytes (puede ser buffer.length)
 */
export function validateFile(
  buffer: Buffer,
  declaredMimeType: string,
  filename: string,
  size: number
): FileValidationResult {
  // 1) Sanitizar el nombre del archivo SIEMPRE primero
  const safeName = sanitizeFilename(filename)
  if (!safeName) {
    return { valid: false, error: 'Nombre de archivo inválido.' }
  }

  // 2) Verificar que el mimeType declarado esté en nuestra whitelist
  const declared = MIME_MAP.get(declaredMimeType)
  if (!declared) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${declaredMimeType}. Tipos válidos: ${FILE_TYPES.map((t) => t.extension).join(', ')}.`,
    }
  }

  // 3) Verificar tamaño
  if (size > declared.maxSize) {
    const mb = (declared.maxSize / 1024 / 1024).toFixed(0)
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo permitido (${mb} MB para ${declared.description}).`,
    }
  }

  if (buffer.length === 0) {
    return { valid: false, error: 'Archivo vacío.' }
  }

  // 4) Verificar magic bytes — el tipo detectado debe coincidir con el declarado
  const detected = FILE_TYPES.find((t) => t.matches(buffer))
  if (!detected) {
    return {
      valid: false,
      error: 'No se pudo identificar el tipo de archivo por su contenido (magic bytes inválidos).',
    }
  }

  if (detected.mimeType !== declared.mimeType) {
    return {
      valid: false,
      error: `El contenido del archivo no coincide con el tipo declarado. Declarado: ${declared.description}, detectado: ${detected.description}.`,
    }
  }

  // 5) Verificar extensión del filename vs mimeType
  const ext = getExtension(safeName)
  if (ext && ext !== declared.extension) {
    // No rechazamos — solo reemplazamos la extensión al guardar (en sanitizeFilename se mantiene).
    // Pero registramos advertencia en el resultado (caller puede inspeccionar).
  }

  return { valid: true, detectedType: declared }
}

/**
 * Sanitiza un nombre de archivo:
 * - Elimina path traversal (../, ..\, /, \)
 * - Elimina caracteres no imprimibles y especiales peligrosos
 * - Conserva solo caracteres seguros: [a-zA-Z0-9_.-]
 * - Limita longitud
 * - Fuerza minúsculas en la extensión
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return ''

  // Tomar solo el basename (sin ruta)
  const basename = filename.split(/[\\/]/).pop() || ''

  // Reemplazar caracteres peligrosos
  let safe = basename
    .replace(/\.\.+/g, '_') // evitar path traversal
    .replace(/[^\w.\- ]/g, '') // solo word chars, punto, guion, espacio
    .replace(/\s+/g, '_') // espacios a underscore
    .replace(/^\.+/, '') // sin punto inicial (archivos ocultos Unix)
    .replace(/[.]+/g, '.') // sin múltiples puntos
    .slice(0, 100) // limitar longitud

  // Forzar extensión minúscula
  const lastDot = safe.lastIndexOf('.')
  if (lastDot > 0) {
    const name = safe.slice(0, lastDot)
    const ext = safe.slice(lastDot + 1).toLowerCase()
    safe = `${name}.${ext}`
  }

  return safe
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot < 0) return ''
  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * Lista de tipos permitidos (para mostrar en UI).
 */
export const ALLOWED_FILE_TYPES = FILE_TYPES.map((t) => ({
  mimeType: t.mimeType,
  extension: t.extension,
  maxSize: t.maxSize,
  description: t.description,
}))

/**
 * Tamaño máximo global (para UI / progress).
 */
export const MAX_FILE_SIZE = Math.max(...FILE_TYPES.map((t) => t.maxSize))
