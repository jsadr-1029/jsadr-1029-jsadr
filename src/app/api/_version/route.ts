// Endpoint simple para verificar versión deployada.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    deployedAt: new Date().toISOString(),
    version: 'portal-neobanco-1.0',
    commit: '5f846ad',
    env: process.env.NODE_ENV,
    region: process.env.VERCEL_REGION || 'unknown',
  })
}
