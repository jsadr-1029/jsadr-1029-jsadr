const crypto = require('crypto')
const fs = require('fs')

const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
const ALGORITHM = 'aes-256-cbc'

function decryptWithBackup(encText) {
  if (!encText) return null
  const parts = encText.split(':')
  if (parts.length !== 2) return null
  if (!/^[0-9a-f]+$/i.test(parts[0]) || !/^[0-9a-f]+$/i.test(parts[1])) return null
  try {
    const iv = Buffer.from(parts[0], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, BACKUP_KEY, iv)
    let dec = decipher.update(parts[1], 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  } catch (e) { return null }
}

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60',
      },
    },
  })
  try {
    const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } })
    if (!c) throw new Error('No SMTP')
    let apiKey = c.apiKey
    const dec = decryptWithBackup(apiKey)
    if (dec) apiKey = dec
    if (!apiKey || !apiKey.startsWith('xkeysib-')) throw new Error('Invalid apiKey')

    // Get email events for the last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const url = `https://api.brevo.com/v3/smtp/statistics/events?limit=50&sort=desc&days=1&email=jsa@jsadr.com.co`
    const res = await fetch(url, {
      headers: { 'api-key': apiKey, accept: 'application/json' }
    })
    const text = await res.text()
    console.log('Status:', res.status)
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 500) } }
    if (data.events && Array.isArray(data.events)) {
      console.log(`\nEvents found: ${data.events.length}`)
      for (const e of data.events.slice(0, 10)) {
        console.log(`  - ${e.date} | ${e.event} | subject="${e.subject}" | message-id="${e.messageId || 'N/A'}" | to=${e.email}`)
      }
    } else {
      console.log('Response:', JSON.stringify(data).slice(0, 1000))
    }
  } finally {
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
