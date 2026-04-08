import type { NextConfig } from "next";

const normalizeBackendBase = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://localhost:4000";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
};

const nextConfig: NextConfig = {
  async rewrites() {
    const backendBase = normalizeBackendBase(
      process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:4000",
    );

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
