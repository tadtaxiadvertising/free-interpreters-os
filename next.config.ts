import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: false, // Prevents double-renders & reduces memory pressure
  productionBrowserSourceMaps: false, // Critical for low-RAM environments
  serverExternalPackages: ["@prisma/client", "prisma", "@prisma/adapter-pg", "pg"],
  // Required for Docker/Next.js 16+: moved out of 'experimental'
  outputFileTracingIncludes: {
    "/": ["./prisma/**/*"],
  },
};

export default nextConfig;
