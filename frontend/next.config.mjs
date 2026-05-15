/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      { source: "/api/upload", destination: `${api}/api/upload` },
      { source: "/api/generate", destination: `${api}/api/generate` },
      { source: "/api/enhance", destination: `${api}/api/enhance` },
      { source: "/api/themes", destination: `${api}/api/themes` },
      { source: "/files/:path*", destination: `${api}/files/:path*` },
    ];
  },
};

export default nextConfig;
