'use client'

/**
 * Utilidad para abrir/descargar documentos desde endpoints /api/ que
 * requieren autenticacion JWT (Authorization: Bearer).
 *
 * PROBLEMA:
 *   `window.open(url)` no puede aniadir el header `Authorization: Bearer`
 *   porque no usa fetch. Por eso, en produccion, los endpoints protegidos
 *   (estado-cuenta, paz-y-salvo, documentos, export, juridico/exportar)
 *   devuelven 401 cuando se abren con window.open().
 *
 * SOLUCION:
 *   Hacer fetch() autenticado (el fetch-interceptor aniade el header
 *   automaticamente desde localStorage.access_token), obtener el Blob,
 *   y abrirlo en una nueva ventana via URL.createObjectURL(blob).
 *
 * CASOS:
 *   - HTML imprimible (estado-cuenta, paz-y-salvo, documentos):
 *       abre en nueva pestania para que el usuario use "Imprimir o Guardar PDF".
 *   - PDF o Word o Excel directo (export, juridico exportar):
 *       descarga el archivo directamente.
 *   - 401 o 403: muestra alerta de "sesion expirada".
 *   - Error: muestra alerta con el mensaje del servidor.
 */

interface AbrirDocumentoOpts {
  /** Si true, fuerza descarga (no abrir en pestaña). Default: false. */
  descargar?: boolean
  /** Nombre sugerido para el archivo si se descarga. */
  nombreArchivo?: string
}

/**
 * Abre un documento protegido en una nueva pestaña, o lo descarga si
 * `descargar=true`.
 *
 * @param url URL del endpoint (relativa, ej: /api/estado-cuenta?cedula=123)
 * @param opts Opciones: descargar, nombreArchivo
 * @returns true si tuvo éxito, false si falló.
 */
export async function abrirDocumentoAutenticado(
  url: string,
  opts: AbrirDocumentoOpts = {}
): Promise<boolean> {
  const { descargar = false, nombreArchivo } = opts

  try {
    // fetch() es interceptado por fetch-interceptor.ts que añade
    // Authorization: Bearer <token> automáticamente desde localStorage.
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
    })

    // Sesión expirada o token inválido
    if (res.status === 401) {
      let errorMsg = 'Tu sesión ha expirado.'
      try {
        const data = await res.clone().json()
        errorMsg = data.error || errorMsg
      } catch {}
      alert(`No se pudo abrir el documento.\n\n${errorMsg}\n\nCierra sesión e ingresa nuevamente.`)
      return false
    }

    // Sin permisos
    if (res.status === 403) {
      let errorMsg = 'No tienes permisos para esta acción.'
      try {
        const data = await res.clone().json()
        errorMsg = data.error || errorMsg
      } catch {}
      alert(`Acceso denegado.\n\n${errorMsg}`)
      return false
    }

    // Rate limit
    if (res.status === 429) {
      alert('Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.')
      return false
    }

    // Otros errores
    if (!res.ok) {
      let errorMsg = `Error ${res.status}`
      try {
        const data = await res.clone().json()
        errorMsg = data.error || errorMsg
      } catch {
        try {
          const text = await res.clone().text()
          if (text) errorMsg = text.substring(0, 300)
        } catch {}
      }
      alert(`No se pudo abrir el documento.\n\n${errorMsg}`)
      return false
    }

    // Éxito — obtener el contenido como Blob
    const blob = await res.blob()
    const contentType = res.headers.get('Content-Type') || blob.type || 'application/octet-stream'

    // Si el caller pidió descargar, o es binario (no HTML), descargar
    const esHtml = contentType.includes('text/html')
    const debeDescargar = descargar || (!esHtml && contentType !== 'text/plain')

    // Crear URL del objeto
    const blobUrl = URL.createObjectURL(blob)

    if (debeDescargar) {
      // Descarga directa
      const a = document.createElement('a')
      a.href = blobUrl
      // Nombre de archivo: usar el sugerido, o extraer del Content-Disposition,
      // o generar uno genérico basado en el content-type.
      let filename = nombreArchivo
      if (!filename) {
        const cd = res.headers.get('Content-Disposition')
        if (cd) {
          const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '')
          }
        }
      }
      if (!filename) {
        const ext = contentType.includes('pdf') ? 'pdf'
          : contentType.includes('word') ? 'docx'
          : contentType.includes('spreadsheet') || contentType.includes('excel') ? 'xlsx'
          : contentType.includes('json') ? 'json'
          : 'bin'
        filename = `documento-${Date.now()}.${ext}`
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Limpiar blob URL después de 1 minuto (tiempo suficiente para la descarga)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
    } else {
      // Abrir en nueva pestaña (HTML imprimible, etc.)
      const nuevaVentana = window.open(blobUrl, '_blank')
      if (!nuevaVentana) {
        // Popup bloqueado — intentar descargar como fallback
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = nombreArchivo || `documento-${Date.now()}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      } else {
        // Limpiar blob URL después de 5 minutos (tiempo suficiente para imprimir)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000)
      }
    }

    return true
  } catch (e: any) {
    console.error('[auth-docs] Error abriendo documento:', e)
    alert(`No se pudo abrir el documento.\n\n${e?.message || 'Error de red.'}`)
    return false
  }
}

/**
 * Atajo para abrir un documento HTML imprimible (estado de cuenta, paz y salvo,
 * documentos de préstamo) en una nueva pestaña.
 */
export async function abrirHtmlImprimible(url: string): Promise<boolean> {
  return abrirDocumentoAutenticado(url, { descargar: false })
}

/**
 * Atajo para descargar un archivo binario (PDF, Excel, Word) directamente.
 */
export async function descargarArchivo(
  url: string,
  nombreArchivo?: string
): Promise<boolean> {
  return abrirDocumentoAutenticado(url, { descargar: true, nombreArchivo })
}
