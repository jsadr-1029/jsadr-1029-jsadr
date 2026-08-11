'use client'

/**
 * CÁMARA — VERSIÓN SIMPLE 100% MANUAL (v5)
 * =========================================
 *
 * RESTRICCIONES ELIMINADAS:
 *   ❌ Sin cascada de constraints (antes probaba 4 sets distintos)
 *   ❌ Sin applyConstraints post-stream (focusMode/exposureMode)
 *   ❌ Sin botón deshabilitado esperando eventos del video
 *   ❌ Sin fallback timer de 5 segundos
 *   ❌ Sin paso de confirmación (preview + "Usar esta foto" / "Tomar otra")
 *   ❌ Sin indicador "EN VIVO"
 *   ❌ Sin flash visual
 *   ❌ Sin detección de nitidez ni banners de calidad
 *
 * FLUJO FINAL:
 *   1. Se abre la cámara con { video: true, audio: false } (la constraint más
 *      permisiva posible — funciona en TODOS los dispositivos).
 *   2. Se muestra el video en vivo con un botón GRANDE "Capturar" habilitado
 *      DESDE EL INSTANTE 0 (no espera a ningún evento).
 *   3. El usuario presiona el botón cuando quiera → se captura y se retorna
 *      el dataUrl INMEDIATAMENTE. Sin confirmación, sin pasos extra.
 *
 * Lo único que sigue existiendo (defensa mínima):
 *   - Verificación de soporte de getUserMedia (mensaje claro si no soportado)
 *   - Verificación de HTTPS (mensaje claro si no es contexto seguro)
 *   - Botón "Cancelar" por si el usuario decide no tomar la foto
 *
 * Si el video aún no tiene frames cuando el usuario presiona el botón
 * (caso raro), se reintenta automáticamente cada 100ms hasta que haya imagen.
 */

export interface CameraError {
  name: string
  message: string
  userMessage: string
  hint?: string
}

/**
 * Abre la cámara con la constraint más simple posible.
 * NO aplica ningún constraint avanzado (focusMode, exposureMode, resolución).
 * Solo pide "video: true" — el navegador elige la mejor cámara disponible.
 *
 * @param _preferredFacing Se ignora en esta versión (no restringe facingMode).
 *                        Se mantiene el parámetro por compatibilidad con llamadas existentes.
 * @returns MediaStream si tuvo éxito.
 * @throws CameraError si no se pudo acceder a la cámara.
 */
export async function abrirCamara(
  _preferredFacing: 'environment' | 'user' = 'user'
): Promise<MediaStream> {
  // 1. Verificar soporte básico
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const err: CameraError = {
      name: 'NotSupported',
      message: 'navigator.mediaDevices.getUserMedia no disponible',
      userMessage: 'Tu navegador no soporta acceso a la cámara.',
      hint: 'Usa Chrome, Edge, Firefox o Safari actualizado.',
    }
    throw err
  }

  // 2. Verificar contexto seguro (HTTPS o localhost)
  if (typeof window !== 'undefined') {
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost'
    if (!isSecure) {
      const err: CameraError = {
        name: 'SecurityError',
        message: 'getUserMedia requiere contexto seguro (HTTPS o localhost)',
        userMessage: 'La cámara solo funciona en conexiones HTTPS seguras.',
        hint: 'Si ves "http://" en la URL, cambia a "https://".',
      }
      throw err
    }
  }

  // 3. UN ÚNICO INTENTO con la constraint más permisiva posible.
  //    No cascade, no fallback, no applyConstraints post-stream.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })
    return stream
  } catch (e: any) {
    throw traducirErrorCamara(e)
  }
}

/**
 * Traduce un error nativo de getUserMedia a un CameraError con mensaje útil.
 */
function traducirErrorCamara(e: any): CameraError {
  const name = e?.name || 'Unknown'
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        name,
        message: e?.message || 'Permiso denegado',
        userMessage: 'Bloqueaste el permiso de cámara en este navegador.',
        hint: 'Haz click en el ícono de candado/engranaje junto a la URL → permite "Cámara" → recarga la página. O usa "Subir archivo".',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        name,
        message: e?.message || 'No hay cámara',
        userMessage: 'No se detectó ninguna cámara conectada.',
        hint: 'Conecta una webcam USB o usa "Subir archivo".',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        name,
        message: e?.message || 'Cámara en uso',
        userMessage: 'La cámara está siendo usada por otra aplicación.',
        hint: 'Cierra Zoom, Teams, Meet u otras apps que estén usando la cámara e intenta de nuevo.',
      }
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        name,
        message: e?.message || 'Restricción no satisfecha',
        userMessage: 'La cámara no soporta las restricciones solicitadas.',
        hint: 'Prueba con otra cámara o usa "Subir archivo".',
      }
    case 'SecurityError':
      return {
        name,
        message: e?.message || 'Contexto inseguro',
        userMessage: 'La cámara solo funciona en conexiones HTTPS seguras.',
        hint: 'Verifica que la URL empiece con "https://".',
      }
    case 'AbortError':
      return {
        name,
        message: e?.message || 'Operación abortada',
        userMessage: 'No se pudo iniciar la cámara.',
        hint: 'Reinicia el navegador e intenta de nuevo, o usa "Subir archivo".',
      }
    default:
      return {
        name,
        message: e?.message || 'Error desconocido',
        userMessage: 'No se pudo acceder a la cámara.',
        hint: 'Cierra otras apps que usen la cámara, verifica permisos del navegador, o usa "Subir archivo".',
      }
  }
}

/**
 * Muestra un modal overlay con el stream de la cámara y un botón GRANDE
 * para capturar la foto MANUALMENTE.
 *
 * El botón está habilitado DESDE EL INSTANTE 0 (no espera eventos del video).
 * Al hacer click, captura la foto y la retorna INMEDIATAMENTE (sin paso de
 * confirmación). El usuario puede cancelar con el botón "Cancelar" o ESC.
 *
 * @param stream MediaStream ya abierto (de abrirCamara()).
 * @param opts Opciones: título, espejar (para selfie), texto del botón.
 * @returns dataUrl JPEG (calidad alta) o null si cancela.
 */
export function mostrarModalCamara(
  stream: MediaStream,
  opts: {
    titulo?: string
    textoBoton?: string
    espejar?: boolean // true para selfies (espejo horizontal)
  } = {}
): Promise<string | null> {
  const { titulo = 'Tomar foto', textoBoton = 'Capturar', espejar = false } = opts

  return new Promise((resolve) => {
    // === Estructura del DOM del modal ===
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;'

    // Título
    const tituloEl = document.createElement('p')
    tituloEl.textContent = titulo
    tituloEl.style.cssText = 'color:#fff;font-size:18px;font-weight:700;margin:0 0 4px 0;letter-spacing:-0.01em;'
    overlay.appendChild(tituloEl)

    // Contenedor del video
    const videoContainer = document.createElement('div')
    videoContainer.style.cssText =
      'position:relative;border-radius:14px;overflow:hidden;box-shadow:0 0 0 3px rgba(99,102,241,0.6),0 16px 40px -10px rgba(0,0,0,0.7);background:#000;'

    const video = document.createElement('video')
    video.srcObject = stream
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.style.cssText = `max-width:92vw;max-height:70vh;display:block;object-fit:cover;${espejar ? 'transform:scaleX(-1);' : ''}`
    videoContainer.appendChild(video)
    overlay.appendChild(videoContainer)

    // === Contenedor de botones ===
    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;'
    overlay.appendChild(btnContainer)

    // --- Botón Capturar (GRANDE, habilitado desde el instante 0) ---
    const btnCapturar = document.createElement('button')
    btnCapturar.textContent = '📸  ' + textoBoton
    // Botón SIEMPRE habilitado — sin esperar a eventos del video.
    btnCapturar.disabled = false
    btnCapturar.style.cssText =
      'padding:18px 40px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:14px;font-size:18px;font-weight:700;cursor:pointer;opacity:1;box-shadow:0 10px 28px -8px rgba(99,102,241,0.6);transition:transform 0.12s,box-shadow 0.2s;min-width:200px;'
    btnCapturar.onmouseover = () => {
      btnCapturar.style.transform = 'scale(1.04)'
      btnCapturar.style.boxShadow = '0 14px 36px -8px rgba(99,102,241,0.75)'
    }
    btnCapturar.onmouseout = () => {
      btnCapturar.style.transform = 'scale(1)'
      btnCapturar.style.boxShadow = '0 10px 28px -8px rgba(99,102,241,0.6)'
    }

    // --- Botón Cancelar ---
    const btnCancelar = document.createElement('button')
    btnCancelar.textContent = '✕ Cancelar'
    btnCancelar.style.cssText =
      'padding:18px 28px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.25);border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;transition:background 0.15s;'
    btnCancelar.onmouseover = () => (btnCancelar.style.background = 'rgba(255,255,255,0.18)')
    btnCancelar.onmouseout = () => (btnCancelar.style.background = 'rgba(255,255,255,0.1)')

    btnContainer.appendChild(btnCancelar)
    btnContainer.appendChild(btnCapturar)

    document.body.appendChild(overlay)

    // Reproducir video (algunos navegadores requieren play() explícito)
    video.play().catch(() => {})

    // ====================================================================
    // CAPTURA MANUAL DIRECTA — sin confirmación, sin validación
    // ====================================================================
    let streamDetenido = false

    const detenerStream = () => {
      if (streamDetenido) return
      streamDetenido = true
      stream.getTracks().forEach((t) => t.stop())
    }

    const capturar = () => {
      // Si el video aún no tiene dimensiones (caso raro), reintentar en 100ms
      if (!video.videoWidth || !video.videoHeight) {
        setTimeout(capturar, 100)
        return
      }

      // Canvas a resolución completa del video
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Suavizado de alta calidad al escalar/dibujar
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Si espejar (selfie), invertir horizontalmente para coincidir
      // con lo que ve el usuario en pantalla
      if (espejar) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0)

      // JPEG alta calidad (0.92)
      const fotoCapturada = canvas.toDataURL('image/jpeg', 0.92)

      // Cerrar stream y modal INMEDIATAMENTE — sin paso de confirmación
      detenerStream()
      document.removeEventListener('keydown', onKey)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      resolve(fotoCapturada)
    }

    btnCapturar.onclick = () => {
      capturar()
    }

    // Cancelar: limpiar y resolver null
    btnCancelar.onclick = () => {
      detenerStream()
      document.removeEventListener('keydown', onKey)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      resolve(null)
    }

    // ESC para cancelar, Espacio/Enter para capturar
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        detenerStream()
        document.removeEventListener('keydown', onKey)
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
        resolve(null)
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        capturar()
      }
    }
    document.addEventListener('keydown', onKey)
  })
}

/**
 * Función todo-en-uno: abre la cámara, muestra el modal de captura,
 * retorna el dataUrl o null si el usuario cancela, o lanza CameraError
 * si no se pudo acceder a la cámara.
 *
 * Uso típico:
 *   try {
 *     const dataUrl = await capturarFoto('environment')
 *     if (dataUrl) { /* usar la foto *\/ }
 *   } catch (e) {
 *     // e es CameraError con userMessage y hint
 *     toast({ title: e.userMessage, description: e.hint, variant: 'destructive' })
 *   }
 */
export async function capturarFoto(
  facing: 'environment' | 'user' = 'user',
  opts: { titulo?: string; textoBoton?: string; espejar?: boolean } = {}
): Promise<string | null> {
  const stream = await abrirCamara(facing)
  return mostrarModalCamara(stream, opts)
}

/**
 * Verifica si el navegador soporta getUserMedia y si el contexto es seguro.
 * Útil para mostrar/ocultar el botón "Tomar foto" antes de que el usuario
 * haga click.
 */
export function camaraDisponible(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false
  if (typeof window !== 'undefined') {
    return window.isSecureContext || window.location.hostname === 'localhost'
  }
  return true
}
