const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

require('dotenv').config({ path: '/home/z/my-project/.env' })
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const ALGORITHM = 'aes-256-cbc'
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4' +
  'c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()

function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) return null
  try { return Buffer.from(raw, 'hex') } catch { return Buffer.from(raw, 'utf8') }
}

function decryptSensitive(encrypted) {
  if (!encrypted || typeof encrypted !== 'string') return ''
  const keys = [getEncryptionKey(), BACKUP_KEY].filter(Boolean)
  for (const key of keys) {
    try {
      const parts = encrypted.split(':')
      if (parts.length !== 2) continue
      const iv = Buffer.from(parts[0], 'hex')
      const ct = parts[1]
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      let decrypted = decipher.update(ct, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (e) { /* probar siguiente key */ }
  }
  return encrypted
}

function esCifradoAES(value) {
  if (!value || typeof value !== 'string') return false
  const parts = value.split(':')
  if (parts.length !== 2) return false
  return /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1])
}

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const conexiones = await prisma.conexionAPI.findMany({
      where: { tipo: 'EMAIL_SMTP' },
    })
    for (const c of conexiones) {
      console.log('--- conexion id:', c.id, 'activa:', c.activa)
      console.log('  user:', c.usuario)
      console.log('  url:', c.url)
      console.log('  password raw length:', (c.password || '').length)
      console.log('  password raw (first 40):', (c.password || '').substring(0, 40))
      console.log('  esCifradoAES:', esCifradoAES(c.password))
      const dec = esCifradoAES(c.password) ? decryptSensitive(c.password) : c.password
      console.log('  decrypted length:', dec.length)
      console.log('  decrypted (first 60):', dec.substring(0, 60))
      console.log('  starts with xsmtpsib-:', dec.startsWith('xsmtpsib-'))
      if (c.configuracionExtra) {
        console.log('  configExtra:', c.configuracionExtra)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
