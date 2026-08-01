import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PixiJS y Matter.js son 100% cliente: se cargan con dynamic import en GameCanvas.
  // Aquí solo evitamos que el bundler intente resolver módulos de node en el browser.
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
};

export default nextConfig;
