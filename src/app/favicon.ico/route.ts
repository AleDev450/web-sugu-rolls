import { servirFavicon } from '@/lib/favicon';

/**
 * `/favicon.ico`: algunos navegadores lo piden solos, sin fijarse en el
 * `<link rel="icon">` de la página. Misma fuente que `/icon.png` — ver
 * `servirFavicon`.
 */
export async function GET(request: Request) {
  return servirFavicon(request.url);
}
