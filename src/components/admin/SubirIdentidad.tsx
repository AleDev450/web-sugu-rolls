'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { subirImagenIdentidad } from '@/lib/imagenes';

/**
 * Campo de subida para el favicon y el logo del negocio.
 *
 * A diferencia de `SubirImagen` (que recorta y recomprime a WebP), esto sube
 * el archivo TAL CUAL a una ruta fija del almacén — ver `subirImagenIdentidad`
 * para el porqué: un favicon necesita mantener su formato original y su URL
 * nunca puede cambiar.
 */
export function SubirIdentidad({
  valor,
  ruta,
  forma,
  cuadrada,
  ladoMinimo,
  ayuda,
  alCambiar,
}: {
  valor: string;
  ruta: 'secciones/favicon' | 'secciones/logo';
  /** cómo se recorta la vista previa: circular imita cómo lo muestra Google */
  forma: 'circular' | 'cuadrada';
  cuadrada?: boolean;
  ladoMinimo?: number;
  ayuda: string;
  alCambiar: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medida, setMedida] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await subirImagenIdentidad(archivo, ruta, { cuadrada, ladoMinimo });
      alCambiar(r.url);
      setMedida(r.ancho && r.alto ? `${r.ancho}×${r.alto} px · ${r.pesoKB} KB` : `${r.pesoKB} KB`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div
        className={`relative h-20 w-20 flex-none overflow-hidden border border-white/10 bg-night ${
          forma === 'circular' ? 'rounded-full' : 'rounded-xl'
        }`}
      >
        {valor ? (
          <Image src={valor} alt="" fill sizes="80px" className="object-cover" unoptimized />
        ) : (
          <span className="grid h-full place-items-center text-center text-[10px] text-white/25">
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
          accept="image/png,image/jpeg,image/webp,image/x-icon,.ico"
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
            {subiendo ? 'Subiendo…' : valor ? 'Cambiar' : 'Subir'}
          </button>

          {valor && !subiendo && (
            <button
              type="button"
              onClick={() => {
                alCambiar('');
                setMedida(null);
              }}
              className="inline-flex items-center gap-1.5 px-2 text-[13px] text-bone-dim transition-colors hover:text-sugu"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          )}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-white/40">{ayuda}</p>
        {medida && <p className="mt-1 text-[11px] text-emerald-400">Listo · {medida}</p>}
        {error && <p className="mt-1 text-[11px] text-sugu">{error}</p>}
      </div>
    </div>
  );
}
