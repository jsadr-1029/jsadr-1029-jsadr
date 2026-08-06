// Verificar todos los hashes bcrypt contra candidatos conocidos
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

// Candidatos conocidos a probar
const candidatosPassword = ['Js951029*', '731649', 'Admin123!', 'admin', '1234', '123456', 'jsadr', 'Jsadr2024*', 'Admin2024*', 'Abogado2024*'];
const candidatosClave = ['1234', '731649', 'Js951029*', 'clave', '123456', 'abcd', 'Jsadr2024*'];

(async () => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, username: true, rol: true, nombre: true, passwordHash: true, claveHash: true }
    });
    const clientes = await prisma.cliente.findMany({
      select: { id: true, cedula: true, nombre: true, pinHash: true, claveHash: true }
    });

    const resultados = { usuarios: [], clientes: [] };

    console.log('\n=== VERIFICACIÓN USUARIOS SISTEMA ===');
    for (const u of usuarios) {
      let pwMatch = null;
      let claveMatch = null;
      for (const c of candidatosPassword) {
        try {
          if (u.passwordHash && await bcrypt.compare(c, u.passwordHash)) { pwMatch = c; break; }
        } catch (e) {}
      }
      for (const c of candidatosClave) {
        try {
          if (u.claveHash && await bcrypt.compare(c, u.claveHash)) { claveMatch = c; break; }
        } catch (e) {}
      }
      const r = {
        username: u.username, rol: u.rol, nombre: u.nombre,
        password: pwMatch,
        clave: claveMatch,
        passwordHash_ok: !!u.passwordHash,
        claveHash_ok: !!u.claveHash
      };
      resultados.usuarios.push(r);
      console.log(JSON.stringify(r));
    }

    console.log('\n=== VERIFICACIÓN CLIENTES ===');
    for (const cl of clientes) {
      let pinMatch = null, claveMatch = null;
      for (const c of candidatosClave) {
        try {
          if (cl.pinHash && await bcrypt.compare(c, cl.pinHash)) { pinMatch = c; break; }
        } catch (e) {}
      }
      for (const c of candidatosClave) {
        try {
          if (cl.claveHash && await bcrypt.compare(c, cl.claveHash)) { claveMatch = c; break; }
        } catch (e) {}
      }
      const r = {
        cedula: cl.cedula, nombre: cl.nombre,
        pin: pinMatch,
        clave: claveMatch
      };
      resultados.clientes.push(r);
      console.log(JSON.stringify(r));
    }

    // Guardar resultados
    const fs = require('fs');
    fs.writeFileSync('/home/z/my-project/download/credenciales-verificadas.json', JSON.stringify(resultados, null, 2));
    console.log('\nResultados guardados en /home/z/my-project/download/credenciales-verificadas.json');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
