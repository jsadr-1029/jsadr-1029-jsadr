import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now(), build: 'ba02e10', time: new Date().toISOString() })
}
