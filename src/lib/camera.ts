'use client'

/**
 * Utilidades robustas para captura de fotos desde la cámara del dispositivo.
 *
 * Maneja los principales escenarios de fallo:
 *  - `OverconstrainedError`: facingMode 'environment' no existe en desktop.
 *    Se reintenta con `video: true` (cualquier cámara disponible).
 *  - `NotAllowedError`: el usuario bloqueó el permiso. Mensaje claro.
 *  - `NotFoundError`: no hay cámara conectada.
 *  - `NotReadableError`: la cámara está en uso por otra app (Zoom, Teams, etc.).
 *  - `SecurityError`: la página no está servida sobre HTTPS.
 *
 * Estrategia:
 *  1. Intentar con el facingMode preferido (environment para documentos, user para selfie).
 *  2. Si falla con OverconstrainedError, reintentar con `video: true` (cualquier cámara).
 *  3. Si vuelve a fallar, propagar el error con un mensaje útil en español.
 */

export interface CameraError {
  name: string
  message: string
  userMessage: string
  hint?: string
}

/**
 * Abre la cámara con el facingMode preferido. Si no está disponible
 * (común en desktop), reintenta con `video: true`.
 *
 * @param preferredFacing 'environment' para fotos de documentos, 'user' para selfies.
 * @returns MediaStream si tuvo éxito.
 * @throws CameraError si todos los intentos fallan.
 */
export async function abrirCamara(
  preferredFacing: 'environment' | 'user' = 'user'
): Promise<MediaStream> {
  // 1. Verificar soporte básico
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const err: CameraError = {
      name: 'NotSupported',
      message: 'navigator.mediaDevices.getUserMedia no disponible',
      userMessage: 'Tu navegador no soporta acceso a la cámara.',
      hint: 'Usa Chrome, Edge, Firefox o Safari actualizado. Si estás en una ventana incógnita, ábrela en modo normal.',
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
        hint: 'Si ves "http://" en la URL, cambia a "https://" o contacta al administrador.',
      }
      throw err
    }
  }

  // 3. Intentar con facingMode preferido
  const constraintsPreferidas: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: preferredFacing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraintsPreferidas)
  } catch (e: any) {
    // Si es OverconstrainedError, el facingMode no está disponible → reintentar sin él
    if (e?.name === 'OverconstrainedError' || e?.name === 'ConstraintNotSatisfiedError') {
      console.warn(
        `[camera] facingMode "${preferredFacing}" no disponible, reintentando con video: true`
      )
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (e2: any) {
        throw traducirErrorCamara(e2)
      }
    }
    // Cualquier otro error → traducir
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
 * Muestra un modal overlay con el stream de la cámara y botones para capturar
 * o cancelar. Retorna un dataUrl JPEG de la foto capturada, o null si el
 * usuario cancela.
 *
 * @param stream MediaStream ya abierto (de abrirCamara()).
 * @param opts Opciones: título, espejar (para selfie), texto del botón.
 * @returns dataUrl JPEG o null si cancela.
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
    // Crear elementos
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:12px;'

    const tituloEl = document.createElement('p')
    tituloEl.textContent = titulo
    tituloEl.style.cssText = 'color:#fff;font-size:16px;font-weight:600;margin:0 0 8px 0;'
    overlay.appendChild(tituloEl)

    const hintEl = document.createElement('p')
    hintEl.textContent = 'Coloca el documento dentro del cuadro y asegúrate de que se vea nítido.'
    hintEl.style.cssText = 'color:#cbd5e1;font-size:12px;text-align:center;max-width:480px;margin:0 0 12px 0;'
    overlay.appendChild(hintEl)

    const videoContainer = document.createElement('div')
    videoContainer.style.cssText =
      'position:relative;border-radius:12px;overflow:hidden;box-shadow:0 0 0 2px rgba(99,102,241,0.5),0 12px 32px -8px rgba(0,0,0,0.6);'

    const video = document.createElement('video')
    video.srcObject = stream
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.style.cssText = `max-width:90vw;max-height:60vh;display:block;${espejar ? 'transform:scaleX(-1);' : ''}`
    videoContainer.appendChild(video)
    overlay.appendChild(videoContainer)

    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'margin-top:12px;display:flex;gap:12px;'

    const btnCapturar = document.createElement('button')
    btnCapturar.textContent = '📸 ' + textoBoton
    btnCapturar.style.cssText =
      'padding:12px 28px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px -6px rgba(99,102,241,0.5);transition:transform 0.15s;'
    btnCapturar.onmouseover = () => (btnCapturar.style.transform = 'scale(1.05)')
    btnCapturar.onmouseout = () => (btnCapturar.style.transform = 'scale(1)')

    const btnCancelar = document.createElement('button')
    btnCancelar.textContent = '✕ Cancelar'
    btnCancelar.style.cssText =
      'padding:12px 28px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:12px;font-size:15px;cursor:pointer;'

    btnContainer.appendChild(btnCancelar)
    btnContainer.appendChild(btnCapturar)
    overlay.appendChild(btnContainer)

    document.body.appendChild(overlay)

    // Reproducir video (algunos navegadores requieren play() explícito)
    video.play().catch(() => {})

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop())
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }

    btnCancelar.onclick = () => {
      cleanup()
      resolve(null)
    }

    btnCapturar.onclick = () => {
      // Esperar a que el video tenga dimensiones válidas
      if (!video.videoWidth || !video.videoHeight) {
        // Reintentar en 200ms si el video aún no está listo
        setTimeout(() => btnCapturar.click(), 200)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        cleanup()
        resolve(null)
        return
      }
      // Si espejar (selfie), invertir horizontalmente para coincidir con lo que ve el usuario
      if (espejar) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      cleanup()
      resolve(dataUrl)
    }

    // ESC para cancelar
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey)
        cleanup()
        resolve(null)
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
