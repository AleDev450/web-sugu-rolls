import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * /paquetes pasó a llamarse /promociones (ver `src/data/site.ts`). Esta
   * redirección evita que los enlaces que ya circulan —o lo que Google tiene
   * indexado con la URL vieja— terminen en un 404.
   *
   * La antigua /promociones (el juego, ahora /sugu-games) NO tiene una
   * redirección equivalente: esa URL pasó a servir la página nueva de
   * promociones, así que no hay dónde reenviar sin pisar el contenido nuevo.
   */
  async redirects() {
    return [{ source: '/paquetes', destination: '/promociones', permanent: true }];
  },

  /**
   * Las fotos de producto que se suben desde el panel viven en el almacén de
   * Supabase, así que `next/image` necesita tenerlo permitido: sin esto se
   * niega a servir cualquier imagen de un dominio externo.
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },

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
