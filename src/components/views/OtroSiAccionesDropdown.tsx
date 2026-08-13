'use client'

import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { abrirHtmlImprimible, descargarArchivo } from '@/lib/auth-docs'
import { FileSignature, Printer, Download, ChevronDown, Loader2 } from 'lucide-react'

/**
 * OtroSiAccionesDropdown
 *
 * Botón de acciones para descargar / ver los Otros Síes firmados
 * de un préstamo, ubicado en la columna "Acciones" de la tabla
 * principal de préstamos.
 *
 * Comportamiento:
 *  - Renderiza un botón con icono FileSignature (siempre visible).
 *  - Al abrirse el dropdown, hace fetch a /api/prestamos/[id]/otro-si
 *    para listar los Otros Síes del préstamo.
 *  - Para cada Otro Sí FIRMADO muestra dos acciones:
 *      · Ver (abre HTML imprimible en nueva pestaña)
 *      · Descargar (fuerza descarga .html)
 *  - Si no hay Otros Síes firmados, muestra mensaje informativo.
 *  - Si hay Otros Síes pendientes de firma, los muestra como
 *    información (no descargables) en la parte inferior.
 *
 * Este componente maneja su propio estado para no contaminar al padre
 * (PrestamosView) con N estados de carga simultáneos.
 */
interface OtroSiAccionesDropdownProps {
  prestamoId: string
  prestamoCodigo: string
}

interface OtroSiItem {
  id: string
  codigo: string
  estado: string
  tipoModificacion: string
  fechasAnteriores: string
  createdAt: string
}

export function OtroSiAccionesDropdown({
  prestamoId,
  prestamoCodigo,
}: OtroSiAccionesDropdownProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otrosSi, setOtrosSi] = useState<OtroSiItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Cargar la lista de Otros Síes cuando se abre el dropdown (lazy load).
  useEffect(() => {
    if (!open || loaded || loading) return
    setLoading(true)
    fetch(`/api/prestamos/${prestamoId}/otro-si`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setOtrosSi(json.data || [])
        } else {
          setOtrosSi([])
        }
        setLoaded(true)
      })
      .catch(() => {
        setOtrosSi([])
        setLoaded(true)
      })
      .finally(() => setLoading(false))
  }, [open, loaded, loading, prestamoId])

  const firmados = otrosSi.filter((o) => o.estado === 'FIRMADO')
  const noFirmados = otrosSi.filter((o) => o.estado !== 'FIRMADO')

  const verOtroSi = async (otroSiId: string, codigo: string) => {
    const ok = await abrirHtmlImprimible(`/api/prestamos/${prestamoId}/otro-si/${otroSiId}`)
    if (!ok) {
      toast({
        title: 'No se pudo abrir',
        description: `Otro Sí ${codigo} — intenta nuevamente.`,
        variant: 'destructive',
      })
    }
    setOpen(false)
  }

  const descargarOtroSi = async (otroSiId: string, codigo: string) => {
    const nombreLimpio = codigo.replace(/[^A-Za-z0-9-]/g, '_')
    const ok = await descargarArchivo(
      `/api/prestamos/${prestamoId}/otro-si/${otroSiId}?descargar=1`,
      `OtroSi_${nombreLimpio}.html`
    )
    if (!ok) {
      toast({
        title: 'No se pudo descargar',
        description: `Otro Sí ${codigo} — intenta nuevamente.`,
        variant: 'destructive',
      })
    }
    setOpen(false)
  }

  const getModificacionesCount = (o: OtroSiItem): number => {
    try {
      const arr = JSON.parse(o.fechasAnteriores || '[]')
      return Array.isArray(arr) ? arr.length : 0
    } catch {
      return 0
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
          title={`Otros Síes del préstamo ${prestamoCodigo}`}
        >
          <FileSignature className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-amber-700" />
          Otros Síes — {prestamoCodigo}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="py-3 px-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Cargando...
          </div>
        ) : otrosSi.length === 0 ? (
          <div className="py-4 px-2 text-center text-xs text-muted-foreground">
            <FileSignature className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
            Este préstamo no tiene Otros Síes generados.
          </div>
        ) : firmados.length === 0 ? (
          <div className="py-3 px-2 text-center text-xs text-amber-700 bg-amber-50 rounded mx-1">
            Hay {otrosSi.length} Otro(s) Sí(es) pero ninguno está firmado todavía.
          </div>
        ) : (
          <>
            <DropdownMenuLabel className="text-[11px] text-emerald-700 font-normal uppercase tracking-wide">
              Firmados ({firmados.length}) — descargables
            </DropdownMenuLabel>
            {firmados.map((o) => {
              const nMods = getModificacionesCount(o)
              return (
                <div
                  key={o.id}
                  className="px-1 py-1.5 border-b border-border/60 last:border-b-0"
                >
                  <div className="px-2 py-1 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {o.codigo}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {o.tipoModificacion === 'CAMBIO_FECHA'
                          ? 'Cambio de fecha'
                          : 'Traslado de cuota'}{' '}
                        · {nMods} cuota(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 px-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-[11px] gap-1"
                      onClick={() => verOtroSi(o.id, o.codigo)}
                    >
                      <Printer className="w-3 h-3" />
                      Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-[11px] gap-1 text-blue-700 hover:text-blue-800"
                      onClick={() => descargarOtroSi(o.id, o.codigo)}
                    >
                      <Download className="w-3 h-3" />
                      Descargar
                    </Button>
                  </div>
                </div>
              )
            })}

            {noFirmados.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal uppercase tracking-wide">
                  Pendientes ({noFirmados.length}) — no descargables
                </DropdownMenuLabel>
                {noFirmados.map((o) => {
                  const nMods = getModificacionesCount(o)
                  const estadoLabel =
                    o.estado === 'ANULADO' ? 'Anulado' : 'Pend. firma'
                  return (
                    <div
                      key={o.id}
                      className="px-2 py-1.5 flex items-center justify-between text-[11px] opacity-70"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-blue-700">{o.codigo}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {o.tipoModificacion === 'CAMBIO_FECHA'
                            ? 'Cambio de fecha'
                            : 'Traslado de cuota'}{' '}
                          · {nMods} cuota(s)
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700">{estadoLabel}</span>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
