'use client'

/**
 * Utilidades para captura MANUAL de fotos desde la cámara del dispositivo.
 *
 * FILOSOFÍA DE ESTE MÓDULO (v4 — manual puro, sin automáticas):
 * ----------------------------------------------------------------
 * El usuario es quien decide, mirando la pantalla, cuándo la imagen se ve
 * bien. NO existen:
 *   - Detección automática de nitidez que actualice badges cada X ms.
 *   - Banners que aparecen/desaparecen solos según condiciones de la imagen.
 *   - Auto-captura por condiciones de calidad.
 *   - "Forzar captura" ni estados de error por baja calidad.
 *
 * El flujo es:
 *   1. Se abre la cámara con las mejores constraints posibles (1920×1080).
 *   2. Se muestra el video en vivo, con un botón GRANDE de "Capturar foto".
 *   3. El botón se habilita solo cuando el video tiene frames reales
 *      (evento `playing`). A partir de ahí permanece SIEMPRE habilitado.
 *   4. El usuario presiona el botón cuando lo decide.
 *   5. Se muestra la foto capturada en un panel de confirmación con
 *      "Usar esta foto" o "Tomar otra". El usuario confirma explícitamente.
 *   6. Solo entonces se retorna el dataUrl.
 *
 * Calidad:
 *   - Constraints: 1920×1080 ideal → 1280×720 → video:true (fallback).
 *   - focusMode/exposureMode continuos cuando el dispositivo lo soporta.
 *   - JPEG quality 0.92, imageSmoothingQuality 'high'.
 *
 * Maneja los principales escenarios de fallo de HARDWARE (no de calidad):
 *  - OverconstrainedError → reintenta con constraints más permisivas.
 *  - NotAllowedError → mensaje claro de permiso bloqueado.
 *  - NotFoundError → no hay cámara conectada.
 *  - NotReadableError → cámara en uso por otra app.
 *  - SecurityError → la página no está en HTTPS.
 */

export interface CameraError {
  name: string
  message: string
  userMessage: string
  hint?: string
}

/**
 * Extiende MediaTrackConstraints con las propiedades avanzadas del ImageCapture API
 * (focusMode, exposureMode, whiteBalanceMode) que NO están en el tipo estándar de
 * TypeScript DOM lib pero SÍ son soportadas por Chrome/Edge/Safari móviles.
 */
interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  focusMode?: ConstrainDOMString
  exposureMode?: ConstrainDOMString
  whiteBalanceMode?: ConstrainDOMString
}

interface ExtendedMediaTrackCapabilities {
  focusMode?: string[]
  exposureMode?: string[]
  whiteBalanceMode?: string[]
}

interface ExtendedMediaStreamTrack {
  getCapabilities?: () => ExtendedMediaTrackCapabilities & MediaTrackCapabilities
  applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
}

/**
 * Abre la cámara con el facingMode preferido. Si no está disponible
 * (común en desktop), reintenta con constraints más permisivas.
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

  // 3. Estrategia de fallback en cascada para maximizar la calidad:
  //    Intento A: facingMode preferido + 1920×1080 + focus/exposure continuos.
  //    Intento B: facingMode preferido + 1920×1080 (sin advanced constraints).
  //    Intento C: 1280×720 sin facingMode (algunos desktops).
  //    Intento D: video: true (cualquier cámara, cualquier configuración).
  const intentos: Array<{ nombre: string; constraints: MediaStreamConstraints }> = [
    {
      nombre: `facingMode=${preferredFacing} + 1920x1080 + focus/exposure continuos`,
      constraints: {
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // advanced se ignora si el dispositivo no soporta estos campos,
          // pero NO hace fallar el getUserMedia.
          advanced: [
            { focusMode: 'continuous' },
            { exposureMode: 'continuous' },
            { whiteBalanceMode: 'continuous' },
          ] as unknown as MediaTrackConstraintSet[],
        },
        audio: false,
      } as MediaStreamConstraints,
    },
    {
      nombre: `facingMode=${preferredFacing} + 1920x1080`,
      constraints: {
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
    },
    {
      nombre: '1280x720 (sin facingMode)',
      constraints: {
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      },
    },
    {
      nombre: 'video: true (sin restricciones)',
      constraints: { video: true, audio: false },
    },
  ]

  let ultimoError: any = null
  for (const intento of intentos) {
    try {
      console.log(`[camera] intento: ${intento.nombre}`)
      const stream = await navigator.mediaDevices.getUserMedia(intento.constraints)
      // Aplicar constraints avanzadas post-stream si el track lo permite
      // (focus continuo, exposición continua). Esto mejora nitidez en móviles.
      stream.getVideoTracks().forEach((track) => {
        try {
          const extTrack = track as ExtendedMediaStreamTrack
          const capabilities = extTrack.getCapabilities?.() || {}
          const constraints: ExtendedMediaTrackConstraints = {}
          if (capabilities.focusMode?.includes('continuous')) {
            constraints.focusMode = 'continuous'
          }
          if (capabilities.exposureMode?.includes('continuous')) {
            constraints.exposureMode = 'continuous'
          }
          if (capabilities.whiteBalanceMode?.includes('continuous')) {
            constraints.whiteBalanceMode = 'continuous'
          }
          if (Object.keys(constraints).length > 0) {
            track.applyConstraints(constraints as MediaTrackConstraints).catch(() => {})
          }
        } catch {
          // Silencioso: estas capabilities son opcionales.
        }
      })
      console.log(`[camera] éxito con: ${intento.nombre}`)
      return stream
    } catch (e: any) {
      console.warn(`[camera] fallo con ${intento.nombre}: ${e?.name} — ${e?.message}`)
      ultimoError = e
      // NotAllowedError y SecurityError no valen la pena reintentar — son fallos
      // de permiso/HTTPS que no se resuelven con otro constraint.
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' ||
          e?.name === 'SecurityError') {
        break
      }
      // Cualquier otro error (OverconstrainedError, NotFoundError, NotReadableError)
      // → intentar con el siguiente set de constraints más permisivo.
    }
  }

  // Si llegamos aquí, todos los intentos fallaron. Traducir y propagar.
  throw traducirErrorCamara(ultimoError)
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
 * para capturar la foto MANUALMENTE. Tras capturar, muestra un panel de
 * confirmación donde el usuario decide si usar la foto o tomar otra.
 *
 * NO hay detección automática de nitidez ni auto-captura. El usuario
 * tiene control total.
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

    // Instrucción clara (estática, no cambia)
    const hintEl = document.createElement('p')
    hintEl.textContent = 'Mira la cámara en la pantalla. Cuando la imagen se vea bien, presiona el botón para tomar la foto.'
    hintEl.style.cssText =
      'color:#cbd5e1;font-size:13px;text-align:center;max-width:560px;margin:0 0 8px 0;line-height:1.5;'
    overlay.appendChild(hintEl)

    // Contenedor del video (con borde resaltado)
    const videoContainer = document.createElement('div')
    videoContainer.style.cssText =
      'position:relative;border-radius:14px;overflow:hidden;box-shadow:0 0 0 3px rgba(99,102,241,0.6),0 16px 40px -10px rgba(0,0,0,0.7);background:#000;'

    const video = document.createElement('video')
    video.srcObject = stream
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.style.cssText = `max-width:92vw;max-height:62vh;display:block;object-fit:cover;${espejar ? 'transform:scaleX(-1);' : ''}`
    videoContainer.appendChild(video)
    overlay.appendChild(videoContainer)

    // Indicador "EN VIVO" — estático, no parpadea para no dar sensación de automatización
    const liveBadge = document.createElement('div')
    liveBadge.style.cssText =
      'position:absolute;top:12px;right:12px;padding:5px 10px;border-radius:6px;font-size:10px;font-weight:700;color:#fff;background:#dc2626;letter-spacing:0.05em;display:flex;align-items:center;gap:6px;'
    liveBadge.innerHTML =
      '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;"></span>EN VIVO'
    videoContainer.appendChild(liveBadge)

    // Capa de flash blanco al capturar (transición breve)
    const flashLayer = document.createElement('div')
    flashLayer.style.cssText =
      'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity 0.08s ease-out;'
    videoContainer.appendChild(flashLayer)

    // === Panel de confirmación (inicialmente oculto) ===
    // Se muestra después de capturar para que el usuario confirme explícitamente.
    const previewContainer = document.createElement('div')
    previewContainer.style.cssText =
      'position:absolute;inset:0;background:#000;display:none;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px;'
    videoContainer.appendChild(previewContainer)

    const previewImg = document.createElement('img')
    previewImg.style.cssText = 'max-width:100%;max-height:75%;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.6);'
    previewContainer.appendChild(previewImg)

    const previewLabel = document.createElement('p')
    previewLabel.textContent = '¿La foto se ve bien?'
    previewLabel.style.cssText = 'color:#fff;font-size:15px;font-weight:600;margin:0;'
    previewContainer.appendChild(previewLabel)

    // === Contenedor de botones (cambia entre "capturar" y "confirmar") ===
    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;'
    overlay.appendChild(btnContainer)

    // --- Botón Capturar (GRANDE, muy visible) ---
    const btnCapturar = document.createElement('button')
    btnCapturar.textContent = '📸  ' + textoBoton
    btnCapturar.disabled = true
    btnCapturar.style.cssText =
      'padding:18px 40px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:14px;font-size:18px;font-weight:700;cursor:not-allowed;opacity:0.55;box-shadow:0 10px 28px -8px rgba(99,102,241,0.6);transition:transform 0.12s,opacity 0.2s,box-shadow 0.2s;min-width:200px;'
    btnCapturar.onmouseover = () => {
      if (!btnCapturar.disabled) {
        btnCapturar.style.transform = 'scale(1.04)'
        btnCapturar.style.boxShadow = '0 14px 36px -8px rgba(99,102,241,0.75)'
      }
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
    // HABILITAR BOTÓN EN CUANTO EL VIDEO COMIENZA A REPRODUCIRSE
    // ====================================================================
    // El botón se habilita UNA sola vez, en el primer evento de reproducción.
    // A partir de ahí permanece SIEMPRE habilitado. NO hay ningún loop
    // que lo deshabilite después — el usuario tiene control total.
    let botonHabilitado = false
    const habilitarBoton = () => {
      if (botonHabilitado) return
      if (!video.videoWidth || !video.videoHeight) {
        // Aún sin dimensiones — esperar al siguiente evento
        return
      }
      botonHabilitado = true
      btnCapturar.disabled = false
      btnCapturar.style.opacity = '1'
      btnCapturar.style.cursor = 'pointer'
      console.log('[camera] video reproduciéndose — botón capturar habilitado')
    }

    video.addEventListener('loadeddata', habilitarBoton, { once: true })
    video.addEventListener('playing', habilitarBoton, { once: true })
    video.addEventListener('loadedmetadata', habilitarBoton, { once: true })

    // Fallback de seguridad: si por algún motivo los eventos no se disparan
    // en 5 segundos, habilitar el botón de todas formas. Preferimos un tiempo
    // mayor (5s vs 3s anterior) para dar más margen a cámaras lentas; el
    // usuario puede esperar o cancelar si prefiere.
    const fallbackTimer = setTimeout(() => {
      if (!botonHabilitado) {
        console.warn('[camera] fallback de seguridad — habilitando botón tras 5s')
        botonHabilitado = true
        btnCapturar.disabled = false
        btnCapturar.style.opacity = '1'
        btnCapturar.style.cursor = 'pointer'
      }
    }, 5000)

    // ====================================================================
    // CAPTURA MANUAL — sin validación de nitidez, sin auto-capture
    // ====================================================================
    let fotoCapturada: string | null = null
    let streamDetenido = false

    const detenerStream = () => {
      if (streamDetenido) return
      streamDetenido = true
      stream.getTracks().forEach((t) => t.stop())
    }

    const capturar = () => {
      if (!video.videoWidth || !video.videoHeight) {
        // Reintentar en 150ms si el video aún no está listo (caso Edge)
        setTimeout(capturar, 150)
        return
      }

      // Canvas a resolución completa del video (hasta 1920×1080)
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

      // JPEG alta calidad (0.92 — equilibrio entre nitidez y tamaño)
      fotoCapturada = canvas.toDataURL('image/jpeg', 0.92)

      // Flash visual breve para confirmar la captura al usuario
      flashLayer.style.opacity = '0.9'
      setTimeout(() => {
        flashLayer.style.opacity = '0'
      }, 120)

      // Pausar el video para ahorrar CPU/batería durante la confirmación
      video.pause()

      // Mostrar panel de confirmación con la foto capturada
      previewImg.src = fotoCapturada
      previewContainer.style.display = 'flex'

      // Cambiar botones: ocultar "Capturar", mostrar "Usar foto" + "Tomar otra"
      btnCapturar.style.display = 'none'
      const btnUsar = document.createElement('button')
      btnUsar.textContent = '✓ Usar esta foto'
      btnUsar.style.cssText =
        'padding:18px 32px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 10px 28px -8px rgba(16,185,129,0.6);transition:transform 0.12s;min-width:180px;'
      btnUsar.onmouseover = () => (btnUsar.style.transform = 'scale(1.04)')
      btnUsar.onmouseout = () => (btnUsar.style.transform = 'scale(1)')
      btnUsar.onclick = () => {
        detenerStream()
        clearTimeout(fallbackTimer)
        document.removeEventListener('keydown', onKey)
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
        resolve(fotoCapturada)
      }

      const btnRetomar = document.createElement('button')
      btnRetomar.textContent = '↻ Tomar otra'
      btnRetomar.style.cssText =
        'padding:18px 28px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.25);border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;transition:background 0.15s;'
      btnRetomar.onmouseover = () => (btnRetomar.style.background = 'rgba(255,255,255,0.18)')
      btnRetomar.onmouseout = () => (btnRetomar.style.background = 'rgba(255,255,255,0.1)')
      btnRetomar.onclick = () => {
        // Volver al modo captura
        fotoCapturada = null
        previewContainer.style.display = 'none'
        btnCapturar.style.display = 'inline-block'
        btnUsar.remove()
        btnRetomar.remove()
        // Reanudar video
        video.play().catch(() => {})
      }

      btnContainer.appendChild(btnRetomar)
      btnContainer.appendChild(btnUsar)
    }

    btnCapturar.onclick = () => {
      if (btnCapturar.disabled) return
      capturar()
    }

    // Cancelar: limpiar y resolver null
    btnCancelar.onclick = () => {
      detenerStream()
      clearTimeout(fallbackTimer)
      document.removeEventListener('keydown', onKey)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      resolve(null)
    }

    // ESC para cancelar
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        detenerStream()
        clearTimeout(fallbackTimer)
        document.removeEventListener('keydown', onKey)
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
        resolve(null)
      }
      // Barra espaciadora o Enter = capturar (cuando el botón está habilitado)
      if ((e.key === ' ' || e.key === 'Enter') && !btnCapturar.disabled && btnCapturar.style.display !== 'none') {
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
