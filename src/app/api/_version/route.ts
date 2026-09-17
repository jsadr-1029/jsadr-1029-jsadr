import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    deployedAt: '2026-09-17-build-3',
    commit: '48ae3c4',
    timestamp: Date.now(),
    region: process.env.VERCEL_REGION || 'unknown',
    env: process.env.NODE_ENV,
  })
}
