'use client'

/**
 * Utilidades robustas para captura de fotos desde la cámara del dispositivo.
 *
 * FILOSOFÍA DE ESTE MÓDULO (v3 — botón siempre manual):
 * ----------------------------------------------------------------
 * El botón "Capturar foto" debe estar SIEMPRE habilitado en cuanto la
 * cámara entrega video. Es el usuario quien decide, mirando la pantalla,
 * cuándo la imagen se ve lo suficientemente bien para tomar la foto.
 *
 * Razón: las condiciones automáticas de nitidez / iluminación varían
 * enormemente entre dispositivos (webcams baratas, móviles con poca luz,
 * laptops con cámaras HD de baja calidad). Cualquier umbral automático
 * termina bloqueando a usuarios legítimos. Por eso:
 *
 *   1. El botón se habilita en el evento `onplaying` del <video>.
 *   2. La detección de nitidez sigue corriendo, pero SOLO como guía
 *      visual informativa (un pequeño badge con tips). Nunca bloquea.
 *   3. No existen botones "forzar captura" ni estados de error por
 *      baja calidad. Si la cámara entrega video, se puede capturar.
 *
 * Maneja los principales escenarios de fallo de HARDWARE (no de calidad):
 *  - `OverconstrainedError`: facingMode 'environment' no existe en desktop.
 *    Se reintenta con `video: true` (cualquier cámara disponible).
 *  - `NotAllowedError`: el usuario bloqueó el permiso. Mensaje claro.
 *  - `NotFoundError`: no hay cámara conectada.
 *  - `NotReadableError`: la cámara está en uso por otra app (Zoom, Teams, etc.).
 *  - `SecurityError`: la página no está servida sobre HTTPS.
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

  // 3. Estrategia de fallback en cascada:
  //    Intento A: facingMode preferido + dimensiones ideales
  //    Intento B: solo dimensiones ideales (sin facingMode)
  //    Intento C: video: true (cualquier cámara, cualquier configuración)
  //    Esto cubre desktops, laptops, teléfonos, webcams USB, y casos Edge donde
  //    cualquier constraint específica falla con OverconstrainedError.

  const intentos: Array<{ nombre: string; constraints: MediaStreamConstraints }> = [
    {
      nombre: `facingMode=${preferredFacing} + dimensiones`,
      constraints: {
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
    },
    {
      nombre: 'solo dimensiones (sin facingMode)',
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

  // Si llegamos aquí, todos los intentos fallaron. Si el último error fue
  // NotAllowedError, significa que el usuario SÍ bloqueó el permiso. Si fue
  // NotFoundError, no hay cámara. Si fue OverconstrainedError, ninguna
  // configuración funcionó. En todos los casos, traducir y propagar.
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
 * ====================================================================
 * DETECCIÓN DE NITIDEZ (Sharpness Detection) — SOLO INFORMATIVA
 * ====================================================================
 *
 * Usa la técnica estándar de visión por computadora: varianza del filtro
 * Laplaciano. El Laplaciano resalta los bordes (cambios bruscos de
 * intensidad); una imagen nítida tiene bordes fuertes → varianza alta;
 * una imagen borrosa tiene bordes suaves → varianza baja.
 *
 * IMPORTANTE (v3): La medición se sigue ejecutando, pero el resultado
 * SOLO se usa para mostrar un badge informativo al usuario. NUNCA
 * deshabilita el botón de captura. El usuario decide cuándo capturar.
 *
 * Implementación optimizada para tiempo real:
 *  1. Muestrear el video a un canvas pequeño (128x96) — rápido.
 *  2. Obtener los pixels en escala de grises.
 *  3. Aplicar convolución Laplaciana 3x3 ([0,1,0; 1,-4,1; 0,1,0]).
 *  4. Calcular la varianza de los valores resultantes.
 */

interface MedicionNitidez {
  /** Varianza del Laplaciano (mayor = más nítida). */
  varianza: number
  /** Clasificación legible. */
  nivel: 'NITIDA' | 'ACEPTABLE' | 'BORROSA' | 'SIN_SENAL'
  /** Mensaje corto para el badge. */
  mensaje: string
  /** Recomendación accionable (corta), opcional. */
  recomendacion?: string
}

/**
 * Mide la nitidez de un frame de video.
 * @returns MedicionNitidez con la varianza y clasificación.
 */
function medirNitidez(video: HTMLVideoElement): MedicionNitidez {
  // Si el video no tiene dimensiones aún, retornar SIN_SENAL
  if (!video.videoWidth || !video.videoHeight) {
    return {
      varianza: 0,
      nivel: 'SIN_SENAL',
      mensaje: 'Iniciando cámara...',
    }
  }

  // Canvas pequeño para análisis rápido (downscale no afecta la detección
  // de borrosidad significativamente y reduce el cómputo ~50x).
  const W = 128
  const H = 96
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return {
      varianza: 0,
      nivel: 'SIN_SENAL',
      mensaje: 'Iniciando cámara...',
    }
  }
  ctx.drawImage(video, 0, 0, W, H)
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data

  // Convertir a escala de grises (luminancia perceptual)
  const gray = new Float32Array(W * H)
  for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
    gray[j] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
  }

  // Aplicar Laplaciano 3x3: [0,1,0; 1,-4,1; 0,1,0]
  // y acumular suma y suma de cuadrados para varianza.
  const laplacian = new Float32Array(W * H)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x
      const val = gray[idx - W] + gray[idx + W] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
      laplacian[idx] = val
    }
  }

  // Varianza = E[X²] - (E[X])²
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x
      const v = laplacian[idx]
      sum += v
      sumSq += v * v
      count++
    }
  }
  const mean = sum / count
  const variance = sumSq / count - mean * mean

  // Clasificar según umbrales calibrados.
  // Estos umbrales son SOLO informativos — nunca bloquean la captura.
  if (variance >= 60) {
    return {
      varianza: variance,
      nivel: 'NITIDA',
      mensaje: 'Imagen nítida',
    }
  } else if (variance >= 20) {
    return {
      varianza: variance,
      nivel: 'ACEPTABLE',
      mensaje: 'Imagen aceptable',
      recomendacion: 'Si puedes, acércate un poco o mejora la luz para una foto aún más clara.',
    }
  } else {
    return {
      varianza: variance,
      nivel: 'BORROSA',
      mensaje: 'Imagen algo borrosa',
      recomendacion: 'Si la foto se ve bien en pantalla, puedes capturarla. Si no, acércate, mejora la luz o sujeta firme la cámara.',
    }
  }
}

/**
 * Muestra un modal overlay con el stream de la cámara y botones para capturar
 * o cancelar. Retorna un dataUrl JPEG de la foto capturada, o null si el
 * usuario cancela.
 *
 * FILOSOFÍA (v3): El botón "Capturar foto" está SIEMPRE habilitado en cuanto
 * el video comienza a reproducirse. El usuario decide cuándo tomar la foto
 * mirando la pantalla. La detección de nitidez es puramente informativa
 * (un pequeño badge con tips), nunca bloqueante.
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
    hintEl.innerHTML =
      '📷 Mira la cámara en la pantalla.<br/>' +
      '<strong>Cuando veas que el documento se ve bien claro, presiona el botón para tomar la foto.</strong><br/>' +
      '<span style="opacity:0.7;font-size:11px;">El botón siempre está habilitado — tú decides cuándo capturar.</span>'
    hintEl.style.cssText =
      'color:#cbd5e1;font-size:13px;text-align:center;max-width:520px;margin:0 0 12px 0;line-height:1.5;'
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

    // === Indicador de nitidez (SOLO informativo) ===
    // Pequeño badge discreto en la esquina superior izquierda.
    // Nunca bloquea el botón de captura.
    const nitidezBadge = document.createElement('div')
    nitidezBadge.style.cssText =
      'position:absolute;top:10px;left:10px;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;color:white;backdrop-filter:blur(6px);background:rgba(0,0,0,0.55);transition:background 0.3s;display:flex;align-items:center;gap:6px;'
    nitidezBadge.textContent = '⚪ Iniciando cámara...'
    videoContainer.appendChild(nitidezBadge)

    // Banner inferior con tips de mejora (solo informativo, nunca bloqueante).
    const recomendacionBanner = document.createElement('div')
    recomendacionBanner.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0));color:white;font-size:12px;line-height:1.4;display:none;'
    videoContainer.appendChild(recomendacionBanner)

    // === Botones ===
    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;'

    const btnCapturar = document.createElement('button')
    btnCapturar.textContent = '📸 ' + textoBoton
    // Estado inicial: deshabilitado SOLO hasta que el video comience a reproducirse.
    // Una vez que el video esté reproduciéndose (evento onplaying), se habilita
    // permanentemente, sin importar la nitidez.
    btnCapturar.disabled = true
    btnCapturar.style.cssText =
      'padding:14px 32px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:not-allowed;opacity:0.55;box-shadow:0 8px 24px -6px rgba(99,102,241,0.5);transition:transform 0.15s,opacity 0.2s;'
    btnCapturar.onmouseover = () => {
      if (!btnCapturar.disabled) btnCapturar.style.transform = 'scale(1.05)'
    }
    btnCapturar.onmouseout = () => (btnCapturar.style.transform = 'scale(1)')

    const btnCancelar = document.createElement('button')
    btnCancelar.textContent = '✕ Cancelar'
    btnCancelar.style.cssText =
      'padding:14px 32px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:12px;font-size:16px;cursor:pointer;'

    btnContainer.appendChild(btnCancelar)
    btnContainer.appendChild(btnCapturar)
    overlay.appendChild(btnContainer)

    document.body.appendChild(overlay)

    // Reproducir video (algunos navegadores requieren play() explícito)
    video.play().catch(() => {})

    // ====================================================================
    // HABILITAR BOTÓN EN CUANTO EL VIDEO COMIENZA A REPRODUCIRSE
    // ====================================================================
    // Este es el punto clave: el botón se habilita UNA sola vez, en el evento
    // `onplaying` del <video>. A partir de ahí, permanece habilitado sin
    // importar la medición de nitidez. El usuario decide cuándo capturar.
    let botonHabilitado = false
    const habilitarBoton = () => {
      if (botonHabilitado) return
      botonHabilitado = true
      btnCapturar.disabled = false
      btnCapturar.style.opacity = '1'
      btnCapturar.style.cursor = 'pointer'
      btnCapturar.textContent = '📸 ' + textoBoton
      console.log('[camera] video reproduciéndose — botón capturar habilitado')
    }

    // `loadeddata` se dispara cuando el primer frame está disponible.
    // `playing` se dispara cuando la reproducción ha comenzado realmente.
    // Usamos ambos para cubrir todos los navegadores (el primero que llegue habilita).
    video.addEventListener('loadeddata', habilitarBoton, { once: true })
    video.addEventListener('playing', habilitarBoton, { once: true })

    // Fallback de seguridad: si por algún motivo los eventos no se disparan
    // en 3 segundos, habilitar el botón de todas formas (mejor dejar capturar
    // que dejar al usuario esperando indefinidamente).
    const fallbackTimer = setTimeout(() => {
      if (!botonHabilitado) {
        console.warn('[camera] fallback de seguridad — habilitando botón tras 3s')
        habilitarBoton()
      }
    }, 3000)

    // ====================================================================
    // LOOP DE MEDICIÓN DE NITIDEZ — SOLO INFORMATIVO
    // ====================================================================
    // El loop corre cada 600ms y actualiza el badge visual, pero NUNCA
    // toca el estado del botón de captura. Es puramente orientativo.
    let medicionInterval: ReturnType<typeof setInterval> | null = null
    let medicionTimeout: ReturnType<typeof setTimeout> | null = null
    let medicionActual: MedicionNitidez = {
      varianza: 0,
      nivel: 'SIN_SENAL',
      mensaje: 'Iniciando cámara...',
    }

    const actualizarBadge = (m: MedicionNitidez) => {
      medicionActual = m

      // Colores del badge: usamos tonos informativos, no rojos alarmantes.
      // Verde para nítida, amarillo para aceptable, gris neutro para borrosa
      // (no rojo, para no asustar al usuario ni sugerir que está bloqueado).
      const colores: Record<MedicionNitidez['nivel'], string> = {
        NITIDA: '#10b981',
        ACEPTABLE: '#f59e0b',
        BORROSA: '#94a3b8', // gris neutro — no rojo
        SIN_SENAL: '#6b7280',
      }
      const iconos: Record<MedicionNitidez['nivel'], string> = {
        NITIDA: '✓',
        ACEPTABLE: '◐',
        BORROSA: '◑',
        SIN_SENAL: '○',
      }

      const nivelTexto: Record<MedicionNitidez['nivel'], string> = {
        NITIDA: 'Imagen nítida',
        ACEPTABLE: 'Imagen aceptable',
        BORROSA: 'Imagen algo borrosa',
        SIN_SENAL: 'Iniciando cámara...',
      }

      nitidezBadge.textContent = `${iconos[m.nivel]} ${nivelTexto[m.nivel]}`
      nitidezBadge.style.background = `rgba(0,0,0,0.65)`
      nitidezBadge.style.borderLeft = `4px solid ${colores[m.nivel]}`

      // Banner de recomendación: solo informativo, nunca bloqueante.
      // Se muestra solo si hay una recomendación útil.
      if (m.nivel === 'NITIDA' || m.nivel === 'SIN_SENAL' || !m.recomendacion) {
        recomendacionBanner.style.display = 'none'
      } else {
        recomendacionBanner.style.display = 'block'
        recomendacionBanner.innerHTML =
          `<div style="font-weight:600;margin-bottom:2px;">💡 Tip: ${m.mensaje}</div>` +
          `<div style="opacity:0.9;font-size:11px;">${m.recomendacion}</div>`
      }
    }

    const iniciarMedicionLoop = () => {
      // Pequeño delay inicial para que el video se estabilice
      medicionTimeout = setTimeout(() => {
        // Medición inmediata
        actualizarBadge(medirNitidez(video))
        // Y luego cada 600ms
        medicionInterval = setInterval(() => {
          actualizarBadge(medirNitidez(video))
        }, 600)
      }, 300)
    }
    iniciarMedicionLoop()

    const cleanup = () => {
      if (medicionInterval) clearInterval(medicionInterval)
      if (medicionTimeout) clearTimeout(medicionTimeout)
      clearTimeout(fallbackTimer)
      stream.getTracks().forEach((t) => t.stop())
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }

    btnCancelar.onclick = () => {
      cleanup()
      resolve(null)
    }

    // Función para capturar la foto. Siempre disponible una vez que el video
    // está reproduciéndose. No valida nitidez.
    const capturar = () => {
      // Esperar a que el video tenga dimensiones válidas (debería estar listo
      // porque el botón solo se habilita tras onplaying, pero por seguridad).
      if (!video.videoWidth || !video.videoHeight) {
        // Reintentar en 150ms si el video aún no está listo
        setTimeout(() => capturar(), 150)
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

    btnCapturar.onclick = () => {
      if (btnCapturar.disabled) return
      capturar()
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
