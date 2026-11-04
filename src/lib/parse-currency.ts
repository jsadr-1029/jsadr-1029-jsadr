// =====================================================
// Helper: parseCurrency
// -----------------------------------------------------
// Convierte strings en formato colombiano/español a números:
//   "80000"      → 80000
//   "80.000"     → 80000   (punto como separador de miles)
//   "80,000"     → 80000   (coma como separador de miles)
//   "$80.000"    → 80000   (con símbolo de peso)
//   "80.000,50"  → 80000.5 (formato europeo con coma decimal)
//   "80,000.50"  → 80000.5 (formato anglosajón con punto decimal)
//   ""           → 0
//   null/undef   → 0
//
// Esto resuelve el bug donde el usuario escribe "80.000"
// pensando que son $80,000 pero parseFloat("80.000") devuelve 80.
// =====================================================

export function parseCurrency(value: any): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return isNaN(value) ? 0 : value

  let s = String(value).trim()
  if (!s) return 0

  // Quitar símbolos de moneda y espacios
  s = s.replace(/[$\s]/g, '')

  // Detectar formato:
  // - Si tiene punto y coma: el ÚLTIMO separador es el decimal
  //   ej: "1.234,56" → 1234.56 (formato europeo)
  //   ej: "1,234.56" → 1234.56 (formato anglosajón)
  // - Si solo tiene punto:
  //   ej: "80.000" → 80000 (asumir separador de miles si son 3 dígitos después)
  //   ej: "80.5"    → 80.5 (asumir decimal si no son 3 dígitos)
  // - Si solo tiene coma:
  //   ej: "80,000" → 80000 (asumir separador de miles si son 3 dígitos después)
  //   ej: "80,5"    → 80.5 (asumir decimal si no son 3 dígitos)

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // Ambos presentes: el último es el decimal, el otro es separador de miles
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) {
      // Formato europeo: "1.234,56" → "1234.56"
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato anglosajón: "1,234.56" → "1234.56"
      s = s.replace(/,/g, '')
    }
  } else if (hasDot) {
    // Solo punto. Si hay múltiples puntos → separador de miles
    // Si hay un punto y después hay exactamente 3 dígitos → separador de miles
    // Si hay un punto y después hay 1 o 2 dígitos → decimal
    const parts = s.split('.')
    if (parts.length > 2) {
      // Múltiples puntos: "1.234.567" → "1234567"
      s = parts.join('')
    } else if (parts.length === 2 && parts[1].length === 3) {
      // Un punto con 3 dígitos después: "80.000" → "80000"
      s = parts.join('')
    }
    // else: dejar como decimal ("80.5" → "80.5")
  } else if (hasComma) {
    // Solo coma
    const parts = s.split(',')
    if (parts.length > 2) {
      // Múltiples comas: "1,234,567" → "1234567"
      s = parts.join('')
    } else if (parts.length === 2 && parts[1].length === 3) {
      // Una coma con 3 dígitos después: "80,000" → "80000"
      s = parts.join('')
    } else {
      // Una coma con 1 o 2 dígitos: "80,5" → "80.5"
      s = s.replace(',', '.')
    }
  }

  const result = parseFloat(s)
  return isNaN(result) ? 0 : result
}
