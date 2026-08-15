import { servirFavicon } from '@/lib/favicon';

/**
 * `/icon.png`: URL estable del favicon, editable desde /admin/seo sin que
 * la ruta cambie nunca. Ver `servirFavicon` para el porqué.
 */
export async function GET(request: Request) {
  return servirFavicon(request.url);
}
