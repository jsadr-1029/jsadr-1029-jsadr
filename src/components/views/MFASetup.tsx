'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ShieldCheck,
  Smartphone,
  MessageCircle,
  CheckCircle,
  XCircle,
  Loader2,
  KeyRound,
} from 'lucide-react'

export function MFASetup({ userId, usuarioNombre }: { userId: string; usuarioNombre: string }) {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalActivar, setModalActivar] = useState(false)
  const [modalDesactivar, setModalDesactivar] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [codigoVerificacion, setCodigoVerificacion] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [enviandoOtp, setEnviandoOtp] = useState(false)
  const { toast } = useToast()

  // Cargar estado al montar
  useEffect(() => {
    cargarEstado()
  }, [])

  const cargarEstado = async () => {
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'obtener_estado', userId }),
      })
      const json = await res.json()
      if (json.success) {
        setMfaEnabled(json.data.mfaEnabled)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const iniciarActivacion = async () => {
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'activar', userId }),
      })
      const json = await res.json()
      if (json.success) {
        setQrUrl(json.data.qrUrl)
        setSecret(json.data.secret)
        setModalActivar(true)
        setCodigoVerificacion('')
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const confirmarActivacion = async () => {
    if (!codigoVerificacion || codigoVerificacion.length !== 6) {
      toast({ title: 'Error', description: 'Ingresa el código de 6 dígitos' })
      return
    }
    setVerificando(true)
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'verificar_activacion', userId, codigo: codigoVerificacion }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: '✅ MFA activado', description: json.mensaje, duration: 6000 })
        setMfaEnabled(true)
        setModalActivar(false)
        setQrUrl('')
        setSecret('')
        setCodigoVerificacion('')
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setVerificando(false)
    }
  }

  const desactivar = async () => {
    if (!codigoVerificacion || codigoVerificacion.length !== 6) {
      toast({ title: 'Error', description: 'Ingresa tu código actual para confirmar' })
      return
    }
    setVerificando(true)
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'desactivar', userId, codigo: codigoVerificacion }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'MFA desactivado', description: json.mensaje })
        setMfaEnabled(false)
        setModalDesactivar(false)
        setCodigoVerificacion('')
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setVerificando(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={mfaEnabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${mfaEnabled ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <ShieldCheck className={`w-6 h-6 ${mfaEnabled ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="font-semibold text-sm flex items-center gap-2">
                  Autenticación de Dos Factores (MFA)
                  {mfaEnabled ? (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                      <CheckCircle className="w-3 h-3 mr-1" />Activa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                      <XCircle className="w-3 h-3 mr-1" />No activada
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mfaEnabled
                    ? 'Tu cuenta requiere un código de Google Authenticator + envío por WhatsApp para iniciar sesión.'
                    : 'Activa MFA para proteger tu cuenta con un segundo factor de autenticación.'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={mfaEnabled ? 'outline' : 'default'}
              onClick={() => {
                if (mfaEnabled) {
                  setModalDesactivar(true)
                  setCodigoVerificacion('')
                } else {
                  iniciarActivacion()
                }
              }}
            >
              {mfaEnabled ? 'Desactivar' : 'Activar MFA'}
            </Button>
          </div>

          {mfaEnabled && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span className="text-muted-foreground">Método principal:</span>
                <strong>Google Authenticator (TOTP)</strong>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-muted-foreground">Método alternativo:</span>
                <strong>WhatsApp (OTP de 6 dígitos, 5 min)</strong>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal activar MFA */}
      <Dialog open={modalActivar} onOpenChange={setModalActivar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Activar MFA - Google Authenticator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                1. Escanea este código QR con Google Authenticator:
              </p>
              {qrUrl && (
                <img src={qrUrl} alt="QR Code MFA" className="mx-auto rounded-lg border" width={200} height={200} />
              )}
              <p className="text-xs text-muted-foreground mt-2">
                O ingresa este código manualmente:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                {secret}
              </code>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigoMFA">
                2. Ingresa el código de 6 dígitos de Google Authenticator:
              </Label>
              <Input
                id="codigoMFA"
                value={codigoVerificacion}
                onChange={(e) => setCodigoVerificacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                maxLength={6}
                inputMode="numeric"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
              💡 Si no tienes Google Authenticator, puedes usar Authy, Microsoft Authenticator
              o cualquier app TOTP. También puedes recibir el código por WhatsApp durante el login.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setModalActivar(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmarActivacion} disabled={verificando || codigoVerificacion.length !== 6}>
                {verificando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Confirmar Activación
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal desactivar MFA */}
      <Dialog open={modalDesactivar} onOpenChange={setModalDesactivar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              Desactivar MFA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
              ⚠️ <strong>Advertencia:</strong> Al desactivar MFA, tu cuenta será menos segura.
              Cualquiera con tu contraseña podrá iniciar sesión sin un segundo factor.
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigoDesactivar">
                Ingresa tu código actual de Google Authenticator para confirmar:
              </Label>
              <Input
                id="codigoDesactivar"
                value={codigoVerificacion}
                onChange={(e) => setCodigoVerificacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                maxLength={6}
                inputMode="numeric"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalDesactivar(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={desactivar} disabled={verificando || codigoVerificacion.length !== 6}>
                {verificando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Desactivar MFA
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
