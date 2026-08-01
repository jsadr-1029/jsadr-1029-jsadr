require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decryptSensitive } = require('./src/lib/security.ts');
