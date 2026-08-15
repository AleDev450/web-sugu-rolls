'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react';
import { DESTINOS, subirImagen, type TipoImagen } from '@/lib/imagenes';

/**
 * Galería de varias fotos, para secciones que se muestran como carrusel
 * (por ahora, catering). Cada foto se sube y recorta igual que en
 * `SubirImagen`; aquí se añade poder subir más de una y reordenarlas.
 */
export function GaleriaImagenes({
  valor,
  nombreBase,
  tipo = 'catering',
  alCambiar,
}: {
  valor: string[];
  nombreBase: string;
  tipo?: TipoImagen;
  alCambiar: (urls: string[]) => void;
}) {
  const destino = DESTINOS[tipo];
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const { url } = await subirImagen(archivo, `${nombreBase}-${valor.length + 1}`, tipo);
      alCambiar([...valor, url]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  const quitar = (i: number) => alCambiar(valor.filter((_, j) => j !== i));

  const mover = (i: number, hacia: -1 | 1) => {
    const j = i + hacia;
    if (j < 0 || j >= valor.length) return;
    const copia = [...valor];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    alCambiar(copia);
  };

  return (
    <div className="space-y-3">
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {valor.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative h-24 w-20 flex-none overflow-hidden rounded-xl border border-white/10 bg-night"
            >
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />

              <button
                type="button"
                onClick={() => quitar(i)}
                className="absolute right-1 top-1 rounded-full bg-night/80 p-1 text-white transition-colors hover:bg-sugu"
                aria-label={`Quitar foto ${i + 1}`}
              >
                <X className="h-3 w-3" />
              </button>

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-night/80 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="p-0.5 text-white/80 transition-colors hover:text-sugu disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Mover antes"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[9px] text-white/50">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === valor.length - 1}
                  className="p-0.5 text-white/80 transition-colors hover:text-sugu disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Mover después"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={subiendo}
        className="btn-ghost !px-5 !py-2.5 text-[13px] disabled:pointer-events-none disabled:opacity-50"
      >
        {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {subiendo ? 'Subiendo…' : 'Añadir foto'}
      </button>

      <p className="text-[11px] leading-relaxed text-white/40">
        Se recortan a {destino.ancho}×{destino.alto}. Con 0 fotos se muestra la imagen de arriba;
        con 1 o más, un carrusel con estas fotos, en este orden.
      </p>
      {error && <p className="text-[11px] text-sugu">{error}</p>}
    </div>
  );
}
