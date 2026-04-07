import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendBase =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:4000";

    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendBase}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
