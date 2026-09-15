import type { NextConfig } from "next";

const backendUrlValue = process.env.BACKEND_URL || "http://localhost:4000";
const parsedBackendUrl = new URL(backendUrlValue);

if (parsedBackendUrl.protocol !== "http:" && parsedBackendUrl.protocol !== "https:") {
  throw new Error("BACKEND_URL debe usar el protocolo http o https");
}

if (parsedBackendUrl.pathname !== "/" || parsedBackendUrl.search || parsedBackendUrl.hash) {
  throw new Error("BACKEND_URL debe contener solo el origen, sin rutas, query ni fragmentos");
}

const backendUrl = parsedBackendUrl.origin;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
