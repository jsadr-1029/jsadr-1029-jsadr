/**
 * Convierte el documento combinado (pagaré + carta) a PDF usando Playwright.
 * El HTML se obtiene del endpoint /api/documentos?tipo=combinado
 * y se renderiza con headless Chromium para producir el PDF final.
 *
 * Uso: node scripts/render-pagare-pdf.js <prestamoId> [outputPath]
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

async function main() {
  const prestamoId = process.argv[2] || 'cms8chcm2000nqu65omu4817z'
  const outputPath = process.argv[3] || '/home/z/my-project/download/pagare-carta-ejemplo.pdf'

  console.log(`[render-pdf] Renderizando documento para préstamo ID: ${prestamoId}`)
  console.log(`[render-pdf] Output: ${outputPath}`)

  // Asegurar que el directorio exista
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    viewport: { width: 1240, height: 1754 }, // ~A4 at 150dpi
  })

  const page = await context.newPage()

  // Construir la URL del endpoint
  const baseUrl = 'http://localhost:3000'
  const url = `${baseUrl}/api/documentos?prestamoId=${prestamoId}&tipo=combinado`
  console.log(`[render-pdf] Cargando: ${url}`)

  // Navegar al endpoint
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })

  // Esperar a que las imágenes (logo, marca de agua) terminen de cargar
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // Ocultar el botón de imprimir antes de generar el PDF
  await page.addStyleTag({
    content: `.no-print, .print-btn { display: none !important; }`,
  })

  // Generar el PDF
  console.log(`[render-pdf] Generando PDF...`)
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    margin: {
      top: '3.5cm',
      bottom: '3cm',
      left: '2.2cm',
      right: '2.2cm',
    },
    preferCSSPageSize: false,
  })

  console.log(`[render-pdf] ✓ PDF generado: ${outputPath}`)
  console.log(`[render-pdf] Tamaño: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`)

  await browser.close()
}

main().catch((err) => {
  console.error('[render-pdf] ERROR:', err)
  process.exit(1)
})
