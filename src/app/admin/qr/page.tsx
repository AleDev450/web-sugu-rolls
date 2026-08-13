'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, ExternalLink, RotateCcw } from 'lucide-react';
import { Aviso, Campo, Encabezado, claseCampo } from '@/components/admin/ui';

/** Destino por defecto: el juego en el dominio propio. */
const URL_POR_DEFECTO = 'https://sugurolls.com/juego';

/** Dónde se recuerda la última URL usada, para no reescribirla cada vez. */
const CLAVE = 'sugu_qr_url';

/**
 * Lado del PNG que se descarga, en píxeles.
 *
 * 1200 da de sobra para imprimir: a 300 ppp son 10 cm de lado, suficiente
 * para un cartel de mesa o un volante. El QR es cuadrado, así que un solo
 * número basta.
 */
const LADO_DESCARGA = 1200;

/**
 * Generador de QR para el panel.
 *
 * Se dibuja en el navegador con la librería `qrcode`: no se manda la URL a
 * ningún servicio externo y funciona sin conexión, que importa porque este
 * código acaba impreso en cartas y mesas.
 *
 * Corrección de errores en nivel H (el más alto): recupera el contenido con
 * hasta un 30% del dibujo dañado. En un adhesivo pegado en una mesa de
 * restaurante eso es la diferencia entre que escanee o no después de unas
 * semanas de uso.
 */
export default function QrAdmin() {
  const [url, setUrl] = useState(URL_POR_DEFECTO);
  const [error, setError] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);

  // se recuerda entre visitas: la URL definitiva se teclea una sola vez
  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE);
    if (guardada) setUrl(guardada);
  }, []);

  const dibujar = useCallback(async (destino: string) => {
    if (!destino.trim()) {
      setError('Escribe la dirección a la que debe llevar el código.');
      setVistaPrevia(null);
      return;
    }
    try {
      const png = await QRCode.toDataURL(destino.trim(), {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 512,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setVistaPrevia(png);
      setError(null);
    } catch {
      setError('No se pudo generar el código con esa dirección.');
      setVistaPrevia(null);
    }
  }, []);

  useEffect(() => {
    void dibujar(url);
    localStorage.setItem(CLAVE, url);
  }, [url, dibujar]);

  const descargar = async () => {
    const canvas = lienzo.current;
    if (!canvas) return;
    try {
      await QRCode.toCanvas(canvas, url.trim(), {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: LADO_DESCARGA,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'qr-sugu-rolls.png';
      a.click();
    } catch {
      setError('No se pudo preparar la descarga.');
    }
  };

  return (
    <>
      <Encabezado
        titulo="Código QR"
        bajada="Genera el código que lleva a tus clientes al juego. Imprímelo en la carta, en las mesas o en el ticket."
        accion={
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir enlace
          </a>
        }
      />

      {error && (
        <div className="mb-6">
          <Aviso tipo="error" texto={error} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="card p-8">
          <Campo etiqueta="¿A dónde lleva el código?">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={claseCampo}
              placeholder={URL_POR_DEFECTO}
              inputMode="url"
              spellCheck={false}
            />
          </Campo>

          <button
            onClick={() => setUrl(URL_POR_DEFECTO)}
            className="mt-3 inline-flex items-center gap-2 text-[13px] text-bone-dim transition-colors hover:text-sugu"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Volver a {URL_POR_DEFECTO}
          </button>

          <div className="mt-8 space-y-4 border-t border-white/10 pt-6 text-[13px] leading-relaxed text-bone-dim">
            <p>
              <b className="text-white">Todavía no compras el dominio.</b> El código ya apunta a{' '}
              <span className="font-mono text-white">sugurolls.com/juego</span>, así que
              funcionará en cuanto lo tengas apuntando a esta web. Mientras tanto, para probar,
              pega aquí la dirección de Vercel y verás el código de prueba.
            </p>
            <p>
              Si cambias de dominio más adelante tendrás que reimprimir: un QR lleva la
              dirección escrita dentro, no se puede redirigir después.
            </p>
          </div>

          <button onClick={() => void descargar()} className="btn-primary mt-8">
            <Download className="h-4 w-4" />
            Descargar PNG
          </button>
          <p className="mt-3 text-[12px] text-white/40">
            {LADO_DESCARGA} × {LADO_DESCARGA} px — unos 10 cm de lado a calidad de imprenta.
          </p>
        </div>

        <div className="card flex flex-col items-center gap-5 p-8">
          {/* fondo blanco obligatorio: un QR sobre negro no lo lee ningún móvil */}
          <div className="rounded-2xl bg-white p-4">
            {vistaPrevia ? (
              <img
                src={vistaPrevia}
                alt={`Código QR hacia ${url}`}
                width={280}
                height={280}
                className="block h-[280px] w-[280px]"
              />
            ) : (
              <div className="grid h-[280px] w-[280px] place-items-center text-[13px] text-black/40">
                Sin código
              </div>
            )}
          </div>
          <p className="max-w-[280px] break-all text-center font-mono text-[11px] text-bone-dim">
            {url}
          </p>
        </div>
      </div>

      {/* lienzo oculto: solo se usa para generar el PNG grande de la descarga */}
      <canvas ref={lienzo} className="hidden" />
    </>
  );
}
