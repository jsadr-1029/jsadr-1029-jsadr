// =====================================================
// /api/manual — Genera el manual automáticamente en tiempo real (Módulo 8)
// Lee:
//   - src/components/views/*.tsx → extrae nombres de componentes + comentarios
//   - src/app/api/**/route.ts   → extrae endpoints (métodos HTTP)
//   - prisma/schema.prisma      → extrae modelos
// Devuelve JSON estructurado con secciones organizadas.
// =====================================================

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface ComponentInfo {
  archivo: string
  nombre: string
  descripcion: string | null
  esClient: boolean
}

interface EndpointInfo {
  ruta: string
  metodos: string[]
  descripcion: string | null
  archivo: string
}

interface ModeloInfo {
  nombre: string
  campos: { nombre: string; tipo: string; extras?: string }[]
  comentario: string | null
}

interface ManualData {
  generadoEn: string
  version: string
  componentes: ComponentInfo[]
  endpoints: EndpointInfo[]
  modelos: ModeloInfo[]
  resumen: {
    totalComponentes: number
    totalEndpoints: number
    totalModelos: number
    totalArchivosApi: number
  }
}

const VIEWS_DIR = path.join(process.cwd(), 'src', 'components', 'views')
const API_DIR = path.join(process.cwd(), 'src', 'app', 'api')
const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma')

// =====================================================
// Recorre recursivamente un directorio y retorna todos los archivos
// =====================================================
function walkDir(dir: string, ext: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...walkDir(full, ext))
    } else if (e.isFile() && e.name.endsWith(ext)) {
      out.push(full)
    }
  }
  return out
}

// =====================================================
// Extrae componentes de un archivo .tsx
// =====================================================
function extraerComponentes(filePath: string): ComponentInfo[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content) return []
    const archivo = path.relative(path.join(process.cwd(), 'src'), filePath)
    const esClient = content.trimStart().startsWith("'use client'") || content.trimStart().startsWith('"use client"')

    // Buscar comentarios de descripción (// === Título === o comentarios al inicio)
    const lineasComentario = content
      .split('\n')
      .filter((l) => l.trim().startsWith('//'))
      .slice(0, 10)
      .map((l) => l.replace(/^\/\/\s*/, '').trim())
      .filter((l) => l.length > 5 && !l.startsWith('==='))
    const descripcion = lineasComentario.join(' ').slice(0, 400) || null

    // Buscar export function NombreComponente o export const NombreComponente
    const out: ComponentInfo[] = []
    const regexExportFn = /export\s+function\s+([A-Z][A-Za-z0-9_]*)/g
    const regexExportConst = /export\s+(?:const|function)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=|\()/g
    const regexDefault = /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/g

    const nombres = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = regexExportFn.exec(content)) !== null) nombres.add(m[1])
    while ((m = regexExportConst.exec(content)) !== null) nombres.add(m[1])
    while ((m = regexDefault.exec(content)) !== null) nombres.add(m[1])

    for (const nombre of nombres) {
      out.push({ archivo, nombre, descripcion, esClient })
    }
    return out
  } catch {
    return []
  }
}

// =====================================================
// Extrae endpoints de un archivo route.ts
// =====================================================
function extraerEndpoints(filePath: string): EndpointInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content) return null

    const rel = path.relative(path.join(process.cwd(), 'src', 'app'), filePath)
    // Construir la ruta pública (/api/...)
    const rutaParts = rel.split(path.sep)
    // rutaParts = ['api', 'juridico', 'portal', 'auth', 'route.ts']
    const ruta = '/' + rutaParts.slice(0, -1).join('/')

    const metodos: string[] = []
    if (/export\s+async\s+function\s+GET\b/.test(content)) metodos.push('GET')
    if (/export\s+async\s+function\s+POST\b/.test(content)) metodos.push('POST')
    if (/export\s+async\s+function\s+PUT\b/.test(content)) metodos.push('PUT')
    if (/export\s+async\s+function\s+PATCH\b/.test(content)) metodos.push('PATCH')
    if (/export\s+async\s+function\s+DELETE\b/.test(content)) metodos.push('DELETE')

    if (metodos.length === 0) return null

    // Extraer comentarios descriptivos al inicio
    const lineasComentario = content
      .split('\n')
      .filter((l) => l.trim().startsWith('//'))
      .slice(0, 15)
      .map((l) => l.replace(/^\/\/\s*/, '').trim())
      .filter((l) => l.length > 3 && !l.startsWith('==='))
    const descripcion = lineasComentario.join(' ').slice(0, 500) || null

    return { ruta, metodos, descripcion, archivo: rel }
  } catch {
    return null
  }
}

// =====================================================
// Extrae modelos del schema.prisma
// =====================================================
function extraerModelos(): ModeloInfo[] {
  try {
    const content = fs.readFileSync(SCHEMA_PATH, 'utf8')
    if (!content) return []
    const modelos: ModeloInfo[] = []

    // Capturar comentarios inmediatamente antes de `model Nombre {`
    const regex = /(?:\/\/\s*(.+?)\n\s*)*model\s+([A-Z][A-Za-z0-9_]*)\s*\{([^}]*)\}/g
    let m: RegExpExecArray | null

    while ((m = regex.exec(content)) !== null) {
      const nombre = m[2]
      const cuerpo = m[3]
      // Buscar comentarios anteriores al modelo
      const indiceModelo = m.index
      const antes = content.slice(Math.max(0, indiceModelo - 300), indiceModelo)
      const lineasComent = antes
        .split('\n')
        .filter((l) => l.trim().startsWith('//'))
        .map((l) => l.replace(/^\/\/\s*/, '').trim())
        .filter((l) => l.length > 3)
      const comentario = lineasComent.join(' ').slice(0, 500) || null

      // Extraer campos (líneas con patrón "nombre Tipo  @anotaciones")
      const campos: { nombre: string; tipo: string; extras?: string }[] = []
      const lineas = cuerpo.split('\n')
      for (const linea of lineas) {
        const trim = linea.trim()
        if (!trim || trim.startsWith('//') || trim.startsWith('@@') || trim.startsWith('model')) continue
        const matchCampo = trim.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([A-Za-z0-9?]+)(.*)$/)
        if (matchCampo) {
          campos.push({
            nombre: matchCampo[1],
            tipo: matchCampo[2],
            extras: matchCampo[3].trim() || undefined,
          })
        }
      }
      modelos.push({ nombre, campos, comentario })
    }

    return modelos
  } catch {
    return []
  }
}

// =====================================================
// GET — Generar manual en tiempo real
// =====================================================
export async function GET() {
  try {
    const componentes: ComponentInfo[] = []
    if (fs.existsSync(VIEWS_DIR)) {
      const archivos = walkDir(VIEWS_DIR, '.tsx')
      for (const a of archivos) {
        componentes.push(...extraerComponentes(a))
      }
    }

    const endpoints: EndpointInfo[] = []
    if (fs.existsSync(API_DIR)) {
      const archivos = walkDir(API_DIR, '.ts')
      for (const a of archivos) {
        const e = extraerEndpoints(a)
        if (e) endpoints.push(e)
      }
    }

    const modelos = extraerModelos()

    const data: ManualData = {
      generadoEn: new Date().toISOString(),
      version: 'v3.7.0',
      componentes,
      endpoints: endpoints.sort((a, b) => a.ruta.localeCompare(b.ruta)),
      modelos,
      resumen: {
        totalComponentes: componentes.length,
        totalEndpoints: endpoints.length,
        totalModelos: modelos.length,
        totalArchivosApi: endpoints.length,
      },
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Error generando manual: ' + (error?.message || 'desconocido') },
      { status: 500 }
    )
  }
}
