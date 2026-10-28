// =====================================================
// Helper para abrir documentos protegidos (PDF, HTML) en una nueva pestaña
// enviando el JWT de autorización.
//
// Soluciona el problema de window.open() que NO envía headers de Authorization.
// En producción, el endpoint /api/estado-cuenta requiere JWT válido.
//
// Uso:
//   import { abrirDocumentoAutenticado } from '@/lib/documentos-auth'
//   abrirDocumentoAutenticado(`/api/estado-cuenta?cedula=${cedula}&prestamoId=${id}`)
// =====================================================

import { getToken } from './api-client'

export async function abrirDocumentoAutenticado(url: string): Promise<void> {
  try {
    const token = getToken()
    const headers: Record<string, string> = {}

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(url, { headers })

    if (!res.ok) {
      console.error('[abrirDocumentoAutenticado] Error HTTP:', res.status, res.statusText)
      // Intentar leer el mensaje de error
      try {
        const errJson = await res.json()
        console.error('[abrirDocumentoAutenticado] Detalle:', errJson)
        alert(`Error al abrir el documento: ${errJson.error || res.statusText}`)
      } catch {
        alert(`Error al abrir el documento (HTTP ${res.status})`)
      }
      return
    }

    const contentType = res.headers.get('content-type') || ''
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)

    // Abrir en nueva pestaña
    window.open(blobUrl, '_blank', 'noopener,noreferrer')

    // Limpiar la URL del blob después de 60 segundos (tiempo suficiente para que cargue)
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl)
      } catch {}
    }, 60000)
  } catch (error: any) {
    console.error('[abrirDocumentoAutenticado] Error:', error)
    alert(`Error al abrir el documento: ${error.message}`)
  }
}
