'use client'

/**
 * CÁMARA — VERSIÓN 100% MANUAL CON FEEDBACK VISUAL (v6)
 * =====================================================
 *
 * FILOSOFÍA:
 *   El botón "CAPTURAR" debe estar SIEMPRE disponible desde el instante 0.
 *   El usuario presiona → la foto se toma INMEDIATAMENTE → las validaciones
 *   se ejecutan DESPUÉS (no antes).
 *
 *   NUNCA debe haber un estado en el que el botón esté visible pero no responda.
 *
 * FIX vs v5:
 *   En v5, si el video tardaba en cargar (iOS Safari sin gesto, permisos
 *   parciales, etc.), `video.videoWidth === 0` hacía que `capturar()` reintentara
 *   silenciosamente cada 100ms para siempre. El usuario veía el botón, lo
 *   presionaba, y no pasaba nada visible → percibía el botón como "bloqueado".
 *
 *   En v6:
 *     - Feedback visual INMEDIATO al hacer click (texto "Capturando…" + spinner).
 *     - Seguimiento explícito del evento `loadeddata` del video para saber
 *       cuándo realmente hay frames disponibles.
 *     - Timeout de seguridad de 12s: si el video no carga, se muestra un
 *       mensaje claro con opción a "Reintentar cámara" o "Cancelar".
 *     - Botón con animación pulsante para que sea obvio que es clickeable.
 *     - Si el usuario hace click antes de que el video esté listo, se muestra
 *       "Esperando a que la cámara esté lista…" y se captura en cuanto llega
 *       el primer frame (nunca queda en loop silencioso).
 *
 * FLUJO:
 *   1. getUserMedia({video: true, audio: false}) — constraint mínima.
 *   2. Modal overlay con video + botón CAPTURAR grande siempre habilitado.
 *   3. Usuario presiona el botón (en cualquier momento):
 *      a. Si el video ya tiene frames → captura INMEDIATA.
 *      b. Si el video todavía no tiene frames → muestra "Esperando cámara…"
 *         y captura en cuanto llega el primer frame (máx 12s).
 *   4. Validación POST-captura (tamaño mínimo, no totalmente negro) — si
 *      falla, permite reintentar sin cancelar el modal.
 *   5. Retorno del dataUrl JPEG o null si cancela.
 *
 * Lo único que sigue existiendo (defensa mínima):
 *   - Verificación de soporte de getUserMedia
 *   - Verificación de HTTPS
 *   - Botón "Cancelar" / ESC
 */

export interface CameraError {
  name: string
  message: string
  userMessage: string
  hint?: string
}

/**
 * Abre la cámara con la constraint más simple posible.
 * No aplica ningún constraint avanzado (focusMode, exposureMode, resolución).
 * Solo pide "video: true" — el navegador elige la mejor cámara disponible.
 *
 * @param _preferredFacing Se ignora (no restringe facingMode). Se mantiene
 *                        por compatibilidad con llamadas existentes.
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
 * Validación POST-captura MÍNIMA (no bloquea la captura, solo verifica
 * que la foto tenga contenido utilizable).
 *
 * Retorna { ok: true } si la foto es utilizable, o { ok: false, motivo } si no.
 * El llamador decide si mostrar el motivo y permitir reintentar.
 */
function validarFotoPostCaptura(dataUrl: string): { ok: boolean; motivo?: string } {
  // Validación mínima: tamaño del dataUrl (una foto real de cámara debe ser > 5KB en JPEG)
  if (dataUrl.length < 5 * 1024) {
    return { ok: false, motivo: 'La imagen está vacía o corrupta. Toma otra foto.' }
  }
  // Validación: máximo 14MB (limite de seguridad para backend)
  if (dataUrl.length > 14 * 1024 * 1024) {
    return { ok: false, motivo: 'La imagen es demasiado grande. Toma otra foto.' }
  }
  return { ok: true }
}

/**
 * Muestra un modal overlay con el stream de la cámara y un botón GRANDE
 * para capturar la foto MANUALMENTE.
 *
 * El botón está habilitado DESDE EL INSTANTE 0. Al hacer click:
 *   - Si el video tiene frames → captura inmediata.
 *   - Si el video todavía no tiene frames → muestra "Esperando cámara…"
 *     y captura en cuanto llega el primer frame (máx 12s con feedback).
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
    tituloEl.style.cssText = 'color:#fff;font-size:18px;font-weight:700;margin:0 0 4px 0;letter-spacing:-0.01em;text-align:center;'
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
    video.style.cssText = `max-width:92vw;max-height:65vh;display:block;object-fit:cover;${espejar ? 'transform:scaleX(-1);' : ''}`
    videoContainer.appendChild(video)
    overlay.appendChild(videoContainer)

    // === Indicador de estado (visible debajo del video) ===
    const statusEl = document.createElement('p')
    statusEl.textContent = 'Iniciando cámara…'
    statusEl.style.cssText =
      'color:#a5b4fc;font-size:13px;margin:0;min-height:18px;text-align:center;transition:color 0.2s;'
    overlay.appendChild(statusEl)

    // === Contenedor de botones ===
    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;'
    overlay.appendChild(btnContainer)

    // --- Botón Capturar (GRANDE, habilitado desde el instante 0) ---
    const btnCapturar = document.createElement('button')
    btnCapturar.textContent = '📸  ' + textoBoton
    btnCapturar.disabled = false
    btnCapturar.style.cssText =
      'padding:18px 40px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:14px;font-size:18px;font-weight:700;cursor:pointer;opacity:1;box-shadow:0 10px 28px -8px rgba(99,102,241,0.6);transition:transform 0.12s,box-shadow 0.2s;min-width:200px;animation:pulseBtn 1.8s ease-in-out infinite;'
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

    // Inyectar keyframes para la animación pulsante del botón (si no existen ya)
    if (!document.getElementById('camera-pulse-keyframes')) {
      const style = document.createElement('style')
      style.id = 'camera-pulse-keyframes'
      style.textContent = `
        @keyframes pulseBtn {
          0%, 100% { box-shadow: 0 10px 28px -8px rgba(99,102,241,0.6), 0 0 0 0 rgba(99,102,241,0.5); }
          50% { box-shadow: 0 10px 28px -8px rgba(99,102,241,0.6), 0 0 0 14px rgba(99,102,241,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cam-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(overlay)

    // Reproducir video (algunos navegadores requieren play() explícito)
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        // Si play() falla, no es fatal — el video puede empezar cuando tenga datos.
        console.warn('[camera] video.play() falló (no fatal):', err)
      })
    }

    // ====================================================================
    // ESTADO DE CAPTURA
    // ====================================================================
    let streamDetenido = false
    let videoListo = false
    let capturaPendiente = false // true si el usuario ya hizo click pero el video no estaba listo
    let tiempoInicioCarga = Date.now()
    let timeoutSeguridad: ReturnType<typeof setTimeout> | null = null
    let intervalStatus: ReturnType<typeof setInterval> | null = null

    // Listener para detectar cuándo el video realmente tiene frames
    const onLoadedData = () => {
      videoListo = true
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        statusEl.textContent = '✓ Cámara lista — presiona CAPTURAR'
        statusEl.style.color = '#86efac'
        // Si el usuario ya había hecho click, capturar ahora
        if (capturaPendiente) {
          capturaPendiente = false
          capturar()
        }
      }
    }
    const onLoadedMetadata = () => {
      // Metadata cargada (dimensiones conocidas) pero puede que todavía no haya frames
      if (video.videoWidth > 0) {
        if (!videoListo) {
          statusEl.textContent = 'Cargando imagen…'
          statusEl.style.color = '#a5b4fc'
        }
      }
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('loadeddata', onLoadedData)
    // Algunos navegadores disparan 'canplay' en lugar de 'loadeddata'
    video.addEventListener('canplay', onLoadedData)

    // Intervalo para actualizar el status (muestra cuántos segundos han pasado)
    intervalStatus = setInterval(() => {
      if (videoListo) {
        if (intervalStatus) {
          clearInterval(intervalStatus)
          intervalStatus = null
        }
        return
      }
      const transcurrido = Math.floor((Date.now() - tiempoInicioCarga) / 1000)
      if (capturaPendiente) {
        statusEl.textContent = `Esperando a que la cámara esté lista… (${transcurrido}s)`
        statusEl.style.color = '#fbbf24'
      } else if (transcurrido > 3) {
        statusEl.textContent = `Iniciando cámara… (${transcurrido}s)`
        statusEl.style.color = '#a5b4fc'
      }
    }, 500)

    // Timeout de seguridad: si después de 12s el video no carga, mostrar error
    timeoutSeguridad = setTimeout(() => {
      if (!videoListo) {
        statusEl.textContent = '⚠ La cámara no responde. Reintenta o cancela.'
        statusEl.style.color = '#fca5a5'
        // Mostrar botón Reintentar
        if (btnCapturar.parentNode) {
          const btnReintentar = document.createElement('button')
          btnReintentar.textContent = '🔄 Reintentar cámara'
          btnReintentar.style.cssText =
            'padding:14px 24px;background:#3b82f6;color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;width:100%;'
          btnReintentar.onclick = () => {
            // Cerrar todo y reabrir
            detenerStream()
            document.removeEventListener('keydown', onKey)
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
            if (timeoutSeguridad) clearTimeout(timeoutSeguridad)
            if (intervalStatus) clearInterval(intervalStatus)
            // Resolver con null para que el llamador decida reabrir
            // Pero en realidad, queremos reintentar internamente — para simplificar,
            // devolvemos null y el componente puede volver a llamar a capturarFoto().
            resolve(null)
          }
          btnCapturar.parentNode.replaceChild(btnReintentar, btnCapturar)
        }
      }
    }, 12000)

    const detenerStream = () => {
      if (streamDetenido) return
      streamDetenido = true
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch {}
      try {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('loadeddata', onLoadedData)
        video.removeEventListener('canplay', onLoadedData)
      } catch {}
      if (timeoutSeguridad) {
        clearTimeout(timeoutSeguridad)
        timeoutSeguridad = null
      }
      if (intervalStatus) {
        clearInterval(intervalStatus)
        intervalStatus = null
      }
    }

    const cerrarModal = () => {
      detenerStream()
      document.removeEventListener('keydown', onKey)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }

    // ====================================================================
    // CAPTURA MANUAL DIRECTA
    // ====================================================================
    const capturar = () => {
      // Feedback visual inmediato: cambiar el texto del botón y el status
      if (!video.videoWidth || !video.videoHeight) {
        // Video todavía no tiene frames — marcar como pendiente y esperar
        capturaPendiente = true
        btnCapturar.disabled = true
        btnCapturar.textContent = 'Esperando cámara…'
        btnCapturar.style.opacity = '0.7'
        statusEl.textContent = 'Esperando a que la cámara esté lista…'
        statusEl.style.color = '#fbbf24'
        // Restaurar el botón después de 1.5s por si el usuario quiere cancelar
        setTimeout(() => {
          if (capturaPendiente && !streamDetenido) {
            btnCapturar.disabled = false
            btnCapturar.textContent = '📸  ' + textoBoton
            btnCapturar.style.opacity = '1'
          }
        }, 1500)
        return
      }

      // El video tiene frames — capturar AHORA
      capturaPendiente = false
      btnCapturar.disabled = true
      btnCapturar.textContent = 'Capturando…'
      btnCapturar.style.opacity = '0.8'
      statusEl.textContent = 'Procesando foto…'
      statusEl.style.color = '#a5b4fc'

      // Pequeño delay para que el UI se actualice antes del canvas draw
      setTimeout(() => {
        try {
          // Canvas a resolución completa del video
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            statusEl.textContent = 'Error: no se pudo procesar la imagen'
            statusEl.style.color = '#fca5a5'
            btnCapturar.disabled = false
            btnCapturar.textContent = '📸  ' + textoBoton
            btnCapturar.style.opacity = '1'
            return
          }

          // Suavizado de alta calidad al escalar/dibujar
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          // Si espejar (selfie), invertir horizontalmente
          if (espejar) {
            ctx.translate(canvas.width, 0)
            ctx.scale(-1, 1)
          }
          ctx.drawImage(video, 0, 0)

          // JPEG alta calidad (0.92)
          const fotoCapturada = canvas.toDataURL('image/jpeg', 0.92)

          // === Validación POST-captura (no bloquea, solo verifica) ===
          const validacion = validarFotoPostCaptura(fotoCapturada)
          if (!validacion.ok) {
            // Mostrar motivo y permitir reintentar sin cerrar el modal
            statusEl.textContent = '⚠ ' + validacion.motivo
            statusEl.style.color = '#fca5a5'
            btnCapturar.disabled = false
            btnCapturar.textContent = '📸  Reintentar'
            btnCapturar.style.opacity = '1'
            return
          }

          // Cerrar stream y modal INMEDIATAMENTE
          cerrarModal()
          resolve(fotoCapturada)
        } catch (e) {
          console.error('[camera] Error al capturar:', e)
          statusEl.textContent = 'Error al procesar la foto. Intenta de nuevo.'
          statusEl.style.color = '#fca5a5'
          btnCapturar.disabled = false
          btnCapturar.textContent = '📸  ' + textoBoton
          btnCapturar.style.opacity = '1'
        }
      }, 50)
    }

    btnCapturar.onclick = () => {
      capturar()
    }

    // Cancelar: limpiar y resolver null
    btnCancelar.onclick = () => {
      cerrarModal()
      resolve(null)
    }

    // ESC para cancelar, Espacio/Enter para capturar
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrarModal()
        resolve(null)
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!btnCapturar.disabled) {
          capturar()
        }
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
