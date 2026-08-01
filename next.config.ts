import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * PixiJS y Matter.js son 100% cliente: se cargan con dynamic import en
   * GameCanvas. Aquí solo evitamos que el bundler intente resolver módulos de
   * node en el navegador.
   *
   * `turbopack` es para `npm run dev`; `webpack` para `npm run build`. Ambos
   * deben decir lo mismo, si no Turbopack avisa de la discrepancia.
   */
  turbopack: {
    resolveAlias: {
      fs: { browser: './src/lib/vacio.ts' },
      path: { browser: './src/lib/vacio.ts' },
    },
  },

  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
};

export default nextConfig;
