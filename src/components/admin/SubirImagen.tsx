'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { IMAGEN_PRODUCTO, subirImagenProducto } from '@/lib/imagenes';

/**
 * Campo de imagen con subida.
 *
 * Muestra la foto actual y permite reemplazarla eligiendo un archivo. El
 * recorte y la compresión los hace `subirImagenProducto` en el navegador, así
 * que da igual que llegue una foto de móvil de 5 MB: siempre se guarda a
 * 1200x900 en WebP.
 *
 * La ruta sigue siendo editable a mano debajo, porque las imágenes que ya
 * existen en `/public` se referencian por ruta y no están en el almacén.
 */
export function SubirImagen({
  valor,
  nombreBase,
  alCambiar,
}: {
  valor: string;
  nombreBase: string;
  alCambiar: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peso, setPeso] = useState<number | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const { url, pesoKB } = await subirImagenProducto(archivo, nombreBase || 'producto');
      alCambiar(url);
      setPeso(pesoKB);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-24 w-32 flex-none overflow-hidden rounded-xl border border-white/10 bg-night">
          {valor ? (
            <Image src={valor} alt="" fill sizes="128px" className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-[11px] text-white/25">
              Sin imagen
            </span>
          )}
          {subiendo && (
            <span className="absolute inset-0 grid place-items-center bg-night/80">
              <Loader2 className="h-5 w-5 animate-spin text-sugu" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void elegir(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={subiendo}
              className="btn-ghost !px-5 !py-2.5 text-[13px] disabled:pointer-events-none disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              {subiendo ? 'Subiendo…' : valor ? 'Cambiar imagen' : 'Subir imagen'}
            </button>

            {valor && !subiendo && (
              <button
                type="button"
                onClick={() => {
                  alCambiar('');
                  setPeso(null);
                }}
                className="inline-flex items-center gap-1.5 px-2 text-[13px] text-bone-dim transition-colors hover:text-sugu"
              >
                <X className="h-3.5 w-3.5" />
                Quitar
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-white/40">
            Se recorta y comprime sola a {IMAGEN_PRODUCTO.ancho}×{IMAGEN_PRODUCTO.alto} en WebP.
            Sube la foto más grande que tengas: cuanto mejor el original, mejor el resultado.
          </p>

          {peso !== null && (
            <p className="mt-1 text-[11px] text-emerald-400">Listo · {peso} KB</p>
          )}
          {error && <p className="mt-1 text-[11px] text-sugu">{error}</p>}
        </div>
      </div>

      <input
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-night px-4 py-2.5 font-mono text-[11px] outline-none transition-colors placeholder:text-white/25 focus:border-sugu"
        placeholder="/imagenes/web/productos/mi-roll.webp"
        aria-label="Ruta o URL de la imagen"
      />
    </div>
  );
}
