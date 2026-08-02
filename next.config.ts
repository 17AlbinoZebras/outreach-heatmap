import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',   // Emit static files instead of a Node server — required for Electron
  assetPrefix: './',  // Make chunk URLs relative so file:// loading works in Electron
  images: { unoptimized: true }, // Required when output:'export' (no image optimization server)
};

export default nextConfig;
