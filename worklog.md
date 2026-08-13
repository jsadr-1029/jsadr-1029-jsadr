
---
Task ID: 11-fix-certificado-blob-url
Agent: Super Z (main)
Task: Corregir error "Failed to parse URL from /api/firma/certificado?firmaId=..." al hacer clic en "Ver Certificado de Firma Electrónica Completo" desde un documento imprimible (pagaré + carta).

Work Log:
- Usuario envió captura de pantalla mostrando modal de error:
  "Error al abrir el certificado: Failed to execute 'fetch' on 'Window': Failed to parse URL from /api/firma/certificado?firmald=cmssqr0u2v0003jy04ww3udw7"
- VLM analizó la captura y reveló: el error ocurre al hacer clic en botón "Ver Certificado de Firma Electrónica Completo" dentro de un documento HTML imprimible que se abrió como blob URL (barra de direcciones: blob:https://jsadr.com.co/56ace656-b916-487d-9fe7-164a4414be79).
- Búsqueda del código: src/app/api/documentos/route.ts tiene generarScriptAbrirCertificadoFirma() que inyecta un <script> inline con la función abrirCertificadoFirma(firmaId). Esa función hace fetch('/api/firma/certificado?firmaId=...') con URL relativa.
- Diagnóstico raíz: en contexto blob URL, las URLs relativas NO se resuelven contra el dominio del creador. window.location.origin preserva el origin del creador (https://jsadr.com.co), pero window.location.href es el blob URL. Por eso el fetch con URL relativa fallaba con "Failed to parse URL".
- Nota sobre "firmald": el screenshot muestra "firmald" pero en el código fuente está "firmaId" correctamente. La I mayúscula sans-serif en el modal del navegador se ve visualmente como l minúscula.
- Fix aplicado en src/app/api/documentos/route.ts (función generarScriptAbrirCertificadoFirma):
  * Construir URL absoluta: var origin = window.location.origin || ''; (preserva https://jsadr.com.co en blob URLs)
  * Fallback: si origin no empieza con 'http', usar 'https://jsadr.com.co' (dominio canónico de producción)
  * var url = origin + '/api/firma/certificado?firmaId=' + encodeURIComponent(firmaId);
  * fetch(url, ...) en vez de fetch('/api/firma/certificado?...')
- Commit: 67425b9 "fix(certificado): usar URL absoluta en fetch desde blob URL"
- Push a origin/main: 1c46199..67425b9 → exitoso. Vercel auto-deploy disparado.

Stage Summary:
- ✅ Fix aplicado y pusheado a GitHub.
- ✅ Vercel auto-deploy disparado (típicamente 1-2 min para que esté READY).
- 📌 El usuario debe esperar ~2 min y luego:
  1. Recargar la página del admin (para que el nuevo bundle JS esté cargado)
  2. Volver a abrir el documento imprimible (pagaré + carta)
  3. Hacer clic en "Ver Certificado de Firma Electrónica Completo"
  4. El certificado debería abrirse en una nueva pestaña sin error
- ⚠️ Si el problema persiste, puede ser cache del navegador — probar en ventana incógnito o hard refresh (Ctrl+Shift+R).

---
Task ID: 12-cargos-iniciales-cuota1
Agent: Super Z (main)
Task: Corregir que los cobros (Pagaré + Carta, Flexibilidad Financiera PREMIUM, Tarifa de Uso de Plataforma) se vean en el estado de cuenta pero NO se reflejen en el cobro de cuotas. Adicionalmente, corregir que el estado de cuenta muestre "Correo no registrado" cuando el cliente sí tiene email.

Work Log:
- Usuario reportó: estado de cuenta de préstamo JSA-CC-1214731649-20260810-28 ($500.000) muestra los 3 conceptos como "incluidos en la primera cuota" pero las 4 cuotas aparecen iguales ($193.145) sin los cargos sumados. Saldo pendiente $802.578 NO incluye los $59.700 de cargos.
- VLM analizó la imagen del usuario y confirmó: 3 conceptos visibles (Pagaré $13.990, Flexibilidad PREMIUM $34.900, Tarifa Plataforma $4.900) pero no sumados al saldo.
- Diagnóstico BD: préstamo Johan Alvarez tiene cargos configurados pero flags flexibilidadCobroAplicado=false y tarifaPlataformaCargada=false. El sistema NUNCA sumaba estos cargos al total a pagar.
- Diagnóstico correo "No registrado": en estado-cuenta/route.ts:659 se usaba `p.cliente?.email || 'No registrado'` pero `p.cliente` no estaba incluido en prestamosCalculados → siempre undefined → siempre "No registrado".

Fix aplicado (commit b2444ce):
1. **finanzas.ts**: nueva función calcularCargosInicialesPendientes(prestamo) que devuelve {cargos, totalPendiente, totalConfigurado, totalYaCobrado} para los 4 conceptos (pagaré, tarifa plataforma, flexibilidad, fondo garantía).
2. **pagos/route.ts (aplicarPago)**:
   - Calcula cargos pendientes cuando numeroCuota===1.
   - Suma cargos al totalCuotaConCargos (total a pagar real de la cuota 1).
   - Distribución: mora → cargosIniciales → interés → capital.
   - Al completar pago de cuota 1 con cargos, marca flags flexibilidadCobroAplicado=true y tarifaPlataformaCargada=true.
   - Ajusta totalPagar/saldoTotal del préstamo (+cargosInicialesPendientes) para que cuadre con el pago.
   - Registra ingresos en cajas específicas (CAJA-USO-PLATAFORMA, CAJA-PAGARE-CARTA, CAJA-FLEXIBILIDAD-FINANCIERA).
   - Marca CARGOS_INICIALES:monto en notas para soportar pagos parciales sobre la cuota 1.
3. **estado-cuenta/route.ts**:
   - Incluye objeto cliente en cada préstamo (corrige "No registrado").
   - Cambia fallback de "No registrado" a "—" para consistencia.
   - Suma cargos iniciales pendientes al saldo pendiente mostrado.
   - Tabla de amortización: primera cuota muestra total con cargos incluidos + nota visual.
   - Detalle del préstamo: "Total a pagar" y "Saldo" con cargos incluidos.
   - Resumen general: bloque informativo con total de cargos pendientes.
4. **pagos/aplicar/route.ts (GET)**: incluye cargosInicialesPendientes, cargosInicialesPendientesMonto y totalCuotaConCargos en la respuesta.

Script retrospectivo (ejecutado):
- scripts/_fix-cargos-iniciales-legacy.cjs: marcó flags en 19 préstamos legacy donde la cuota 1 ya fue pagada APLICADO pero los flags seguían en false. El préstamo de la imagen NO se modificó (cuota 1 no pagada).

Push a GitHub: 67425b9..b2444ce → origin/main. Vercel auto-deploy disparado.

Stage Summary:
- ✅ Fix aplicado y pusheado a GitHub.
- ✅ 19 préstamos legacy corregidos retrospectivamente (flags marcados).
- 📌 El préstamo de la imagen (JSA-CC-1214731649-20260810-28) tiene $59.700 en cargos pendientes que se cobrarán automáticamente cuando el cliente pague la cuota 1 con el nuevo código.
- 📌 El usuario debe esperar ~2 min para que Vercel despliegue, luego:
  1. Recargar la página del admin (para cargar el nuevo bundle JS)
  2. Abrir el estado de cuenta del préstamo JSA-CC-1214731649-20260810-28
  3. Verificar que:
     - La primera cuota muestre $252.845 (= $193.145 + $59.700 cargos) con nota "incluye $59.700 cargos iniciales"
     - El saldo pendiente muestre $862.278 (= $802.578 + $59.700)
     - El correo del cliente aparezca correctamente (no "No registrado")
  4. Al aplicar pago a la cuota 1 con monto $252.845, el sistema:
     - Marca flexibilidadCobroAplicado=true y tarifaPlataformaCargada=true
     - Registra ingresos en CAJA-USO-PLATAFORMA, CAJA-PAGARE-CARTA, CAJA-FLEXIBILIDAD-FINANCIERA
     - Ajusta totalPagar del préstamo a $862.278
     - El saldo restante será $609.433 (= $862.278 - $252.845)
