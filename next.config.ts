import type { NextConfig } from "next";

// Forzar zona horaria del proceso Node a America/Bogota (Colombia, GMT-5)
// Esto afecta TODOS los new Date() en runtime server-side.
if (!process.env.TZ) {
  process.env.TZ = 'America/Bogota'
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Exponer la variable TZ al cliente también
  env: {
    TZ: process.env.TZ || 'America/Bogota',
  },
  // FIX-SEGURIDAD-CRITICA #6 (RESUELTO): ignoreBuildErrors=true fue desactivado
  // tras corregir los 70 errores TS pre-existentes (refactor de accessors Prisma,
  // imports faltantes, alineación de tipos en bot-admin-v2, etc.).
  // Ahora el build de producción abortará si se introducen errores de tipo.
  typescript: {
    ignoreBuildErrors: false,
  },
  // FIX-SEGURIDAD #31: limitar tamaño de body para prevenir DoS por payload grande.
  // 4MB es suficiente para la mayoría de requests JSON; archivos van por multipart
  // con su propio límite. Next.js default es 1MB pero no se aplica a routes.ts.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // FIX-NEXT16: la clave `eslint` fue eliminada del tipo NextConfig en Next.js 16
  // (la configuración de ESLint se hace ahora vía eslintrc directamente, no vía next.config).
  // Eliminar para que el type-check del build no aborte.
  // eslint: {
  //   ignoreDuringBuilds: false,
  // },
  // React strict mode detecta efectos secundarios y bugs
  reactStrictMode: true,
  // No exponer X-Powered-By: Next.js
  poweredByHeader: false,
  // Compresión habilitada
  compress: true,
  // Headers de seguridad adicionales (también se aplican en src/proxy.ts)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Download-Options", value: "noopen" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
        ],
      },
    ];
  },
};

export default nextConfig;
