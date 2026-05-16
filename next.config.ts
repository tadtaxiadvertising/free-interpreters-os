import type { NextConfig } from "next";

/**
 * NEXT.JS CONFIG — INTERPRETERS-API (Backend)
 * ============================================================
 * CORS: Permite solicitudes exclusivamente desde el Frontend.
 * Security: Headers de seguridad enterprise (CSP, HSTS, X-Frame).
 * Performance: Standalone output para contenedores Docker mínimos.
 * 
 * NOTA: FRONTEND_ORIGIN debe ser la URL exacta del frontend en producción.
 * En Easypanel, configúrala como variable de entorno.
 * ============================================================
 */

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://freeinterpreters.com";

const nextConfig: NextConfig = {
  output: 'standalone',

  // React Compiler para optimización automática de renders
  experimental: { reactCompiler: true },

  // Prisma debe ser external para evitar bundling en el serverless edge
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'bcryptjs'],

  /**
   * CORS + SECURITY HEADERS
   * --------------------------------------------------------
   * Aplicados a nivel de Next.js para TODAS las respuestas.
   * Los headers CORS en /api/* son el primer escudo; el middleware
   * maneja el preflight OPTIONS explícitamente.
   */
  async headers() {
    return [
      {
        // CORS headers para assets estáticos (fuentes, imágenes)
        source: '/_next/static/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
        ],
      },
      {
        // Security headers para todas las páginas
        source: '/:path*',
        headers: [


          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
