/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — required for Cloudflare Pages.
  // Produces a fully static `out/` folder; no Node runtime needed at the edge.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
