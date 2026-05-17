import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { reactCompiler: true },
  serverExternalPackages: ['@prisma/client', 'pg', 'bcryptjs']
};

export default nextConfig;
