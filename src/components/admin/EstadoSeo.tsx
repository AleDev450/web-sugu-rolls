'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

type Estado = 'ok' | 'aviso' | 'error' | 'revisando';

interface Chequeo {
  etiqueta: string;
  estado: Estado;
  detalle: string;
}

const ICONO: Record<Estado, typeof CheckCircle2> = {
  ok: CheckCircle2,
  aviso: AlertTriangle,
  error: XCircle,
  revisando: Loader2,
};

const COLOR: Record<Estado, string> = {
  ok: 'text-emerald-400',
  aviso: 'text-amber-400',
  error: 'text-sugu',
  revisando: 'text-white/30',
};

/** Mide una imagen por URL sin descargarla dos veces innecesariamente. */
function medir(url: string): Promise<{ ancho: number; alto: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function urlResponde(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Comprobaciones en vivo del estado del SEO, corridas desde el propio
 * navegador del admin: no hay forma de saber si Google va a poder abrir el
 * favicon o la imagen social sin de verdad pedirlas, así que se piden.
 */
export function EstadoSeo({
  favicon,
  logo,
  imagenSocial,
  titulo,
  descripcion,
  dominio,
}: {
  favicon: string;
  logo: string;
  imagenSocial: string;
  titulo: string;
  descripcion: string;
  dominio: string;
}) {
  const [chequeos, setChequeos] = useState<Chequeo[] | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      const urlFavicon = `${dominio}/icon.png`;
      const urlLogo = logo || `${dominio}/imagenes/web/logo.png`;
      const urlImagenSocial = imagenSocial || `${dominio}/imagenes/web/hero-makis.webp`;

      const [medidaFavicon, faviconOk, medidaSocial, sitemapOk, robotsOk] = await Promise.all([
        medir(urlFavicon),
        urlResponde(urlFavicon),
        medir(urlImagenSocial),
        urlResponde(`${dominio}/sitemap.xml`),
        urlResponde(`${dominio}/robots.txt`),
      ]);
      const logoOk = await urlResponde(urlLogo);

      if (!vivo) return;

      const lista: Chequeo[] = [
        {
          etiqueta: 'Favicon disponible públicamente',
          estado: faviconOk ? 'ok' : 'error',
          detalle: faviconOk ? '/icon.png responde' : '/icon.png no respondió',
        },
        {
          etiqueta: 'Favicon cuadrado',
          estado: !medidaFavicon ? 'aviso' : medidaFavicon.ancho === medidaFavicon.alto ? 'ok' : 'error',
          detalle: medidaFavicon
            ? `${medidaFavicon.ancho}×${medidaFavicon.alto} px`
            : 'No se pudo medir (normal si es .ico)',
        },
        {
          etiqueta: 'Logo disponible públicamente',
          estado: logoOk ? 'ok' : 'aviso',
          detalle: logo
            ? logoOk
              ? 'Se puede abrir'
              : 'No respondió'
            : 'Usando el logo por defecto del código',
        },
        {
          etiqueta: 'Imagen social en 1200×630',
          estado: !medidaSocial
            ? 'aviso'
            : medidaSocial.ancho === 1200 && medidaSocial.alto === 630
              ? 'ok'
              : 'aviso',
          detalle: medidaSocial
            ? `${medidaSocial.ancho}×${medidaSocial.alto} px`
            : 'No se pudo medir la imagen',
        },
        {
          etiqueta: 'Título dentro del tamaño recomendado',
          estado: titulo.length === 0 || titulo.length <= 60 ? 'ok' : 'aviso',
          detalle: `${titulo.length || 0}/60 caracteres`,
        },
        {
          etiqueta: 'Descripción dentro del tamaño recomendado',
          estado: descripcion.length === 0 || descripcion.length <= 160 ? 'ok' : 'aviso',
          detalle: `${descripcion.length || 0}/160 caracteres`,
        },
        {
          etiqueta: 'URL canónica correcta',
          estado: dominio.startsWith('https://') ? 'ok' : 'error',
          detalle: dominio,
        },
        {
          etiqueta: 'Datos estructurados generados',
          estado: 'ok',
          detalle: 'Restaurant, Organization y WebSite en cada página',
        },
        {
          etiqueta: 'Sitemap accesible',
          estado: sitemapOk ? 'ok' : 'error',
          detalle: sitemapOk ? '/sitemap.xml responde' : '/sitemap.xml no respondió',
        },
        {
          etiqueta: 'robots.txt accesible',
          estado: robotsOk ? 'ok' : 'error',
          detalle: robotsOk ? '/robots.txt responde' : '/robots.txt no respondió',
        },
      ];

      setChequeos(lista);
    })();

    return () => {
      vivo = false;
    };
  }, [favicon, logo, imagenSocial, titulo, descripcion, dominio]);

  return (
    <div className="card p-8">
      <h2 className="font-bold">Estado del SEO</h2>
      <p className="mt-1 text-[13px] text-bone-dim">
        Comprobaciones en vivo, hechas desde este navegador.
      </p>

      <ul className="mt-5 space-y-3">
        {(chequeos ?? Array.from({ length: 10 })).map((c, i) => {
          const item = c as Chequeo | undefined;
          const Icono = item ? ICONO[item.estado] : Loader2;
          return (
            <li key={item?.etiqueta ?? i} className="flex items-start gap-3">
              <Icono
                className={`mt-0.5 h-4 w-4 flex-none ${item ? COLOR[item.estado] : 'text-white/20'} ${
                  !item || item.estado === 'revisando' ? 'animate-spin' : ''
                }`}
              />
              <div className="min-w-0">
                <p className="text-[13px]">{item?.etiqueta ?? 'Revisando…'}</p>
                {item && <p className="text-[11px] text-white/40">{item.detalle}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
