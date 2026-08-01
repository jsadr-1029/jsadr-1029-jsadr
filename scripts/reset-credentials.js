#!/usr/bin/env node
// =====================================================
// reset-credentials.js — Reasignar credenciales
// =====================================================
// Coloca la clave "Js951029*" para ADMIN, GESTOR y CONSULTOR.
// ABOGADO se maneja aparte (portal jurídico con cédula 1234567890 / 951029).
// =====================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

const NUEVA_CLAVE = 'Js951029*'

async function main() {
  console.log('=== Reasignando credenciales ===')
  console.log(`Nueva clave para ADMIN/GESTOR/CONSULTOR: ${NUEVA_CLAVE}`)
  console.log()

  // Generar hash bcrypt rounds=12
  const hash = await bcrypt.hash(NUEVA_CLAVE, 12)
  console.log(`Hash generado: ${hash.substring(0, 30)}...`)

  // Actualizar los 3 usuarios internos
  const usuarios = [
    { username: 'adm-jsadr',       rol: 'ADMIN' },
    { username: 'gestor-jsadr',    rol: 'GESTOR' },
    { username: 'consultor-jsadr', rol: 'CONSULTOR' },
  ]

  for (const u of usuarios) {
    const actualizado = await prisma.usuario.update({
      where: { username: u.username },
      data: {
        passwordHash: hash,
        mustChangePassword: false,
        activo: true,
      },
      select: { id: true, nombre: true, username: true, rol: true, activo: true },
    })
    console.log(`✓ ${actualizado.rol.padEnd(10)} @${actualizado.username.padEnd(15)} → OK`)
    console.log(`  Nombre: ${actualizado.nombre}`)
  }

  // Listar todos para verificación
  console.log('\n=== Estado final de usuarios ===')
  const todos = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, email: true, rol: true, activo: true, ultimoAcceso: true },
    orderBy: { rol: 'asc' },
  })
  for (const u of todos) {
    console.log(`  [${u.rol.padEnd(10)}] @${u.username.padEnd(20)} | ${u.activo ? '✓ activo' : '✗ inactivo'} | ${u.nombre}`)
  }

  await prisma.$disconnect()
  console.log('\n=== Credenciales reasignadas ===')
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
