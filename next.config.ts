import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ============================================================
  // VPS OPTIMIZATION CONFIG (Easypanel / $0 Budget)
  // ============================================================

  // CRITICAL: Reduces Docker image from ~1GB to ~150MB
  output: "standalone",

  // Security: Remove X-Powered-By header
  poweredByHeader: false,

  // Performance: Disable double-renders, saves CPU cycles on VPS
  reactStrictMode: false,

  // Memory: No source maps in production (saves ~50MB RAM)
  productionBrowserSourceMaps: false,

  // React 19 Compiler: Eliminates unnecessary re-renders at build time
  // Frees CPU cycles by moving memoization from runtime to compile-time
  reactCompiler: true,

  // Prisma must run in Node.js, not Edge Runtime
  serverExternalPackages: ["@prisma/client", "prisma", "@prisma/adapter-pg", "pg"],

  // Required for Docker standalone: include Prisma schema files
  outputFileTracingIncludes: {
    "/": ["./prisma/**/*"],
  },

  // Disable telemetry to save bandwidth and CPU
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },
};

export default nextConfig;
