'use client'

// =====================================================
// EliminarConfirmacionDialog v1.0
// =====================================================
// Modal de confirmación reforzada para borrado de recursos críticos
// en Configuración Global (correos SMTP, API keys de Brevo y otros
// proveedores, variables tipo secret, dominios).
//
// Cómo funciona:
//   1. El usuario pulsa el botón "Eliminar" en cualquier panel.
//   2. Se abre este modal mostrando qué se va a borrar.
//   3. Se pide escribir EXACTAMENTE la palabra "Eliminar" en el input.
//   4. El botón "Eliminar" del modal solo se habilita cuando el texto
//      coincide carácter por carácter con "Eliminar".
//   5. Al confirmar, se llama a onConfirm() que invoca la API con
//      { clave: 'Eliminar' } en el payload.
//
// La clave NO caduca, NO se genera dinámicamente, NO se almacena en BD.
// Es una constante del lado servidor. Cualquier intento de borrar sin
// ella desde la API devuelve 403.
// =====================================================

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Trash2, ShieldCheck, Loader2 } from 'lucide-react'

// La palabra clave debe coincidir con CLAVE_ELIMINACION_MAESTRA del backend.
const CLAVE_ESPERADA = 'Eliminar'

export interface EliminarConfirmacionDialogProps {
  /** Si el modal está abierto */
  open: boolean
  /** Callback al cerrar (cancelar) */
  onClose: () => void
  /** Callback al confirmar con la clave correcta */
  onConfirm: () => void | Promise<void>
  /** Título corto del recurso a eliminar, p.ej. "Correo institucional" */
  recursoTipo: string
  /** Identificador legible del recurso, p.ej. "jsa@jsadr.com.co" o "Brevo API" */
  recursoNombre: string
  /** Descripción opcional con más detalles (se muestra en gris) */
  recursoDetalle?: string
  /** Estado de carga — deshabilita el botón mientras la petición está en curso */
  cargando?: boolean
}

export function EliminarConfirmacionDialog({
  open,
  onClose,
  onConfirm,
  recursoTipo,
  recursoNombre,
  recursoDetalle,
  cargando = false,
}: EliminarConfirmacionDialogProps) {
  const [clave, setClave] = useState('')

  // Resetear el input cada vez que se abre el modal
  useEffect(() => {
    if (open) setClave('')
  }, [open])

  const claveCorrecta = clave === CLAVE_ESPERADA

  const handleConfirm = async () => {
    if (!claveCorrecta || cargando) return
    await onConfirm()
  }

  // Permitir Enter para confirmar si la clave es correcta
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && claveCorrecta && !cargando) {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !cargando) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Eliminar {recursoTipo}
          </DialogTitle>
          <DialogDescription className="pt-2">
            Esta acción es <strong className="text-red-600 dark:text-red-400">permanente e irreversible</strong>.
            Se va a eliminar:
          </DialogDescription>
        </DialogHeader>

        {/* === Tarjeta del recurso a borrar === */}
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 my-2">
          <div className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-red-700 dark:text-red-300 break-words">
                {recursoNombre}
              </p>
              {recursoDetalle && (
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {recursoDetalle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* === Instrucción de clave maestra === */}
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold flex items-center gap-1 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Protección de credenciales críticas
          </p>
          <p className="ml-5">
            Para confirmar, escribe la palabra <code className="px-1 py-0.5 bg-amber-500/20 rounded font-mono font-bold">Eliminar</code> en el campo
            de abajo. La clave es <strong>ilimitada y no caduca</strong> — solo se requiere para autorizar el borrado.
          </p>
        </div>

        {/* === Input de clave === */}
        <div className="space-y-1.5">
          <Label htmlFor="clave-eliminacion" className="text-xs">
            Clave de autorización
          </Label>
          <Input
            id="clave-eliminacion"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Escribe "Eliminar"'
            disabled={cargando}
            className={
              clave.length === 0
                ? ''
                : claveCorrecta
                  ? 'border-emerald-500 focus-visible:ring-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'border-red-500 focus-visible:ring-red-500/30'
            }
          />
          {clave.length > 0 && !claveCorrecta && (
            <p className="text-xs text-red-500">
              La clave no coincide. Debe ser exactamente <code className="font-mono font-bold">Eliminar</code>.
            </p>
          )}
          {claveCorrecta && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Clave correcta — puedes confirmar.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={cargando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!claveCorrecta || cargando}
            className="gap-2"
          >
            {cargando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Eliminando…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
