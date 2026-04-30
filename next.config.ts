import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Required for Docker: include Sharp for image optimization
  experimental: {
    outputFileTracingIncludes: {
      "/": ["./prisma/**/*"],
    },
  },
};

export default nextConfig;
