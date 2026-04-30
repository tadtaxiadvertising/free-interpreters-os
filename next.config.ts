import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Required for Docker/Next.js 16+: moved out of 'experimental'
  outputFileTracingIncludes: {
    "/": ["./prisma/**/*"],
  },
};

export default nextConfig;
