// =====================================================
// SAFE ERROR HANDLER v3.0
// Mapea errores de Prisma y otros errores internos a mensajes
// seguros para el cliente. NUNCA expone error.message crudo.
// =====================================================

import { Prisma } from '@prisma/client'

export interface SafeError {
  message: string
  code: string
  httpStatus: number
  // Para logs internos (no se envía al cliente)
  internalDetails?: string
}

/**
 * Mapea cualquier error a un mensaje seguro para el cliente.
 * Nunca expone el mensaje crudo de Prisma o de la base de datos.
 */
export function sanitizeError(error: unknown): SafeError {
  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaKnownError(error)
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      message: 'Error inesperado en la base de datos. Intente nuevamente.',
      code: 'DB_UNKNOWN',
      httpStatus: 500,
      internalDetails: error.message,
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      message: 'Datos de entrada inválidos. Verifique los campos enviados.',
      code: 'VALIDATION_ERROR',
      httpStatus: 400,
      internalDetails: error.message,
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      message: 'No se pudo conectar con la base de datos. Contacte al administrador.',
      code: 'DB_INIT_ERROR',
      httpStatus: 503,
      internalDetails: error.message,
    }
  }

  // AppError — errores controlados de aplicación (definido abajo en este archivo)
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      httpStatus: error.httpStatus,
      ...(error.internalMessage ? { internalDetails: error.internalMessage } : {}),
    }
  }

  // Errores personalizados con código HTTP
  if (error instanceof Error) {
    // Validaciones de Zod o similares
    if (error.name === 'ZodError' || error.name === 'ValidationError') {
      return {
        message: 'Los datos enviados no cumplen con el formato esperado.',
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        internalDetails: error.message,
      }
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        message: 'Sesión inválida o expirada. Inicie sesión nuevamente.',
        code: 'AUTH_ERROR',
        httpStatus: 401,
        internalDetails: error.message,
      }
    }

    // Errores explícitamente marcados como seguros (con prefijo SAFE:)
    if (error.message.startsWith('SAFE:')) {
      return {
        message: error.message.slice(5),
        code: 'SAFE_ERROR',
        httpStatus: 400,
      }
    }

    // Error genérico - NUNCA exponer el mensaje crudo
    return {
      message: 'Ocurrió un error procesando la solicitud. Intente nuevamente.',
      code: 'INTERNAL_ERROR',
      httpStatus: 500,
      internalDetails: error.message,
    }
  }

  // Cualquier otra cosa
  return {
    message: 'Error desconocido. Contacte al administrador.',
    code: 'UNKNOWN',
    httpStatus: 500,
    internalDetails: String(error),
  }
}

function mapPrismaKnownError(error: Prisma.PrismaClientKnownRequestError): SafeError {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const target = (error.meta?.target as string[]) || []
      return {
        message: `Ya existe un registro con: ${target.join(', ')}. Verifique los datos únicos.`,
        code: 'DUPLICATE_ENTRY',
        httpStatus: 409,
        internalDetails: error.message,
      }

    case 'P2025':
      // Record not found
      return {
        message: 'El registro solicitado no existe o fue eliminado.',
        code: 'NOT_FOUND',
        httpStatus: 404,
        internalDetails: error.message,
      }

    case 'P2003':
      // Foreign key constraint violation
      return {
        message: 'No se puede completar la operación porque existen registros relacionados. Elimine o reasigne primero los registros dependientes.',
        code: 'FOREIGN_KEY_VIOLATION',
        httpStatus: 409,
        internalDetails: error.message,
      }

    case 'P2014':
      // Required relation violation
      return {
        message: 'Falta una relación requerida en los datos enviados.',
        code: 'INVALID_RELATION',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2011':
      // Null constraint violation
      const nullField = (error.meta?.field as string) || 'campo'
      return {
        message: `El campo "${nullField}" es obligatorio.`,
        code: 'NULL_VIOLATION',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2012':
      // Missing required value
      return {
        message: 'Falta un valor obligatorio en la solicitud.',
        code: 'MISSING_VALUE',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2015':
      // Related record not found
      return {
        message: 'Un registro relacionado no fue encontrado. Verifique los IDs enviados.',
        code: 'RELATED_NOT_FOUND',
        httpStatus: 404,
        internalDetails: error.message,
      }

    case 'P2018':
      // Required connected records not found
      return {
        message: 'No se encontraron los registros conectados requeridos.',
        code: 'CONNECTED_NOT_FOUND',
        httpStatus: 404,
        internalDetails: error.message,
      }

    case 'P2021':
      // Table does not exist
      return {
        message: 'La tabla solicitada no existe en la base de datos. Contacte al administrador.',
        code: 'TABLE_NOT_FOUND',
        httpStatus: 500,
        internalDetails: error.message,
      }

    case 'P2022':
      // Column does not exist
      return {
        message: 'Un campo solicitado no existe en la base de datos. Contacte al administrador.',
        code: 'COLUMN_NOT_FOUND',
        httpStatus: 500,
        internalDetails: error.message,
      }

    case 'P2001':
      // Record does not exist
      return {
        message: 'El registro no existe en la base de datos.',
        code: 'RECORD_NOT_EXISTS',
        httpStatus: 404,
        internalDetails: error.message,
      }

    case 'P2004':
      // Constraint violation on relation
      return {
        message: 'Violación de restricción en la operación de base de datos.',
        code: 'CONSTRAINT_VIOLATION',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2005':
      // Invalid value for field type
      return {
        message: 'Uno de los valores enviados no coincide con el tipo esperado.',
        code: 'INVALID_TYPE',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2006':
      // Invalid value for field
      return {
        message: 'Uno de los valores enviados no es válido para el campo destino.',
        code: 'INVALID_VALUE',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2007':
      // Data validation error
      return {
        message: 'Los datos enviados no pasaron la validación de la base de datos.',
        code: 'DB_VALIDATION',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2010':
      // Raw query error
      return {
        message: 'Error ejecutando la consulta. Contacte al administrador.',
        code: 'RAW_QUERY_ERROR',
        httpStatus: 500,
        internalDetails: error.message,
      }

    case 'P2016':
      // Query interpretation error
      return {
        message: 'La consulta no pudo ser interpretada. Verifique los parámetros.',
        code: 'QUERY_INTERPRETATION',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2019':
      // Input error
      return {
        message: 'Error en los datos de entrada.',
        code: 'INPUT_ERROR',
        httpStatus: 400,
        internalDetails: error.message,
      }

    case 'P2034':
      // Transaction failed
      return {
        message: 'La transacción no pudo completarse. Intente nuevamente.',
        code: 'TRANSACTION_FAILED',
        httpStatus: 500,
        internalDetails: error.message,
      }

    case 'P2030':
      // Could not create a folder
    case 'P2031':
      // MongoDB server error
    case 'P2033':
      // Binary could not be created
      return {
        message: 'Error interno del servidor. Contacte al administrador.',
        code: 'SERVER_ERROR',
        httpStatus: 500,
        internalDetails: error.message,
      }

    default:
      return {
        message: 'Error en la base de datos. Intente nuevamente.',
        code: `DB_${error.code}`,
        httpStatus: 500,
        internalDetails: error.message,
      }
  }
}

/**
 * Log interno del error con detalles completos para depuración.
 * Solo para logs del servidor, NUNCA enviar al cliente.
 */
export function logError(context: string, error: unknown): void {
  const safe = sanitizeError(error)
  console.error(`[${context}] ${safe.code}: ${safe.internalDetails || safe.message}`)
}

/**
 * Crea un NextResponse JSON con un error seguro.
 */
export function errorResponse(context: string, error: unknown, extra?: Record<string, unknown>) {
  const safe = sanitizeError(error)
  logError(context, error)
  return Response.json(
    {
      success: false,
      error: safe.message,
      code: safe.code,
      ...(extra || {}),
    },
    { status: safe.httpStatus }
  )
}

// === AppError — clase para errores de aplicación controlados ===

/**
 * Error de aplicación con código HTTP explícito y mensaje seguro para el cliente.
 * El `internalMessage` (si se proporciona) se usa solo en logs del servidor.
 *
 * Uso:
 *   throw new AppError('SAFE:No autorizado', 401, 'AUTH_REQUIRED')
 *   throw new AppError('Recurso no encontrado', 404, 'NOT_FOUND', 'Préstamo xyz no existe')
 */
export class AppError extends Error {
  public readonly httpStatus: number
  public readonly code: string
  public readonly internalMessage?: string
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    httpStatus: number = 400,
    code: string = 'APP_ERROR',
    internalMessage?: string,
    details?: Record<string, unknown>
  ) {
    // Si el mensaje empieza con "SAFE:" se muestra tal cual al cliente
    const safeMessage = message.startsWith('SAFE:') ? message.slice(5) : message
    super(safeMessage)
    this.name = 'AppError'
    this.httpStatus = httpStatus
    this.code = code
    this.internalMessage = internalMessage
    this.details = details
  }

  /**
   * Convierte este AppError en un SafeError para uso con errorResponse().
   */
  toSafeError(): SafeError {
    return {
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      ...(this.internalMessage ? { internalDetails: this.internalMessage } : {}),
    }
  }

  /**
   * Crea directamente un NextResponse JSON con el error.
   */
  toResponse(extra?: Record<string, unknown>) {
    return Response.json(
      {
        success: false,
        error: this.message,
        code: this.code,
        ...(this.details || {}),
        ...(extra || {}),
      },
      { status: this.httpStatus }
    )
  }
}

/**
 * Helpers para crear AppError comunes.
 */
export const AppErrors = {
  badRequest: (msg: string, details?: Record<string, unknown>) =>
    new AppError(msg, 400, 'BAD_REQUEST', undefined, details),
  unauthorized: (msg = 'No autorizado') =>
    new AppError(msg, 401, 'UNAUTHORIZED'),
  forbidden: (msg = 'No tiene permisos para esta acción') =>
    new AppError(msg, 403, 'FORBIDDEN'),
  notFound: (msg = 'El registro solicitado no existe') =>
    new AppError(msg, 404, 'NOT_FOUND'),
  conflict: (msg: string) =>
    new AppError(msg, 409, 'CONFLICT'),
  tooManyRequests: (msg = 'Demasiadas solicitudes. Intente más tarde.') =>
    new AppError(msg, 429, 'RATE_LIMITED'),
  internal: (msg = 'Error interno del servidor', internal?: string) =>
    new AppError(msg, 500, 'INTERNAL_ERROR', internal),
  serviceUnavailable: (msg = 'Servicio no disponible temporalmente') =>
    new AppError(msg, 503, 'SERVICE_UNAVAILABLE'),
}
