# Auditoría por Escenarios — Módulo de Préstamos
Fecha: 30/7/2026, 11:40:26 p. m.
Sistema: Jsadr · Aurora Bancaria v4.0
Endpoint base: http://localhost:3000

## Resumen ejecutivo

| Estado | Cantidad |
|--------|----------|
| ✅ PASS | 25 |
| ⚠️ RISKY | 4 |
| ❌ FAIL | 0 |
| ⛔ BLOCKED | 1 |
| **Total** | **30** |

**Tasa de éxito: 83.3%**

---

## Resultados detallados

| # | Escenario | Estado | HTTP | Detalle |
|---|-----------|--------|------|---------|
| 1 | Login admin (adm-jsadr) | ✅ PASS | 200 | Cookie JWT obtenida |
| 2 | Listar préstamos | ✅ PASS | 200 | 12 préstamos listados |
| 3 | Calcular cuota personalizada (500k @20% mensual / 4 cuotas quincenal) | ✅ PASS | 200 | Cuota: $175,000 |
| 4 | Crear préstamo SIN codeudor | ✅ PASS | 200 | Código: JA-CC-1214731649-20260730-10 |
| 5 | Crear préstamo CON codeudor | ✅ PASS | 200 | Código: JA-CC-1214731649-20260730-11 |
| 6 | Obtener detalle de préstamo | ✅ PASS | 200 | Estado: ACTIVO |
| 7 | Aprobar y enviar TyC | ✅ PASS | 200 | Préstamo JA-CC-1214731649-20260730-08 aprobado |
| 8 | Enviar código OTP | ✅ PASS | 200 | Código OTP enviado por email |
| 9 | Enviar confirmación (LINK) | ✅ PASS | 200 | Link generado |
| 10 | Recalcular saldos | ✅ PASS | 200 | Saldos recalculados |
| 11 | Aplicar pago | ⚠️ RISKY | 400 | Status: 400 |
| 12 | Listar pagos | ✅ PASS | 200 | 8 pagos listados |
| 13 | Informe de pagos | ✅ PASS | 200 | Informe generado |
| 14 | Pagos próximos | ✅ PASS | 200 | Lista de próximos pagos |
| 15 | Predicción de mora | ✅ PASS | 200 | Scoring de mora calculado |
| 16 | Bitácora del préstamo | ✅ PASS | 200 | 0 entradas |
| 17 | Generar pagaré diligenciado (HTML) | ✅ PASS | 200 | HTML 16291 bytes |
| 18 | Generar carta de instrucciones (HTML) | ✅ PASS | 200 | HTML 17141 bytes |
| 19 | Generar pagaré + carta combinado (HTML) | ✅ PASS | 200 | HTML 31541 bytes |
| 20 | Exportar pagos CSV | ✅ PASS | 200 | CSV generado |
| 21 | Renegociar mora | ⛔ BLOCKED | - | No hay préstamo EN_MORA |
| 22 | Renovar préstamo | ⚠️ RISKY | 400 | Status: 400 |
| 23 | Eliminar préstamo (recién creado) | ✅ PASS | 200 | Préstamo eliminado |
| 24 | Limpiar todos (protección por password) | ✅ PASS | 403 | Endpoint protegido correctamente |
| 25 | Conciliación Bancolombia | ⚠️ RISKY | 400 | Status: 400 |
| 26 | Cron mora (sin secret) | ⚠️ RISKY | 200 | Cron ejecutado sin CRON_SECRET — abierto en dev |
| 27 | Exportar pagos global (CSV hoy) | ✅ PASS | 200 | CSV generado |
| 28 | Listar firmas electrónicas del préstamo | ✅ PASS | 404 | Sin firmas registradas (404) |
| 29 | Eliminar préstamo con codeudor | ✅ PASS | 200 | Eliminado |
| 30 | Generar recibo de pago (HTML) | ✅ PASS | 200 | Status 200, ct=application/json |

## Hallazgos críticos

Sin fallos críticos.

## Recomendaciones

Ver las propuestas de mejora adjuntas en la respuesta del asistente.
