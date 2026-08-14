'use client';

import { Monitor, Smartphone } from 'lucide-react';
import type { SlideAdmin } from '@/lib/admin';

/**
 * Vista previa de una diapositiva tal como sale publicada.
 *
 * Reproduce lo mismo que hace el slider real: la proporción (16:9 en
 * escritorio, 9:16 en móvil), el encuadre elegido y el velo con su
 * intensidad. Así se comprueba si el titular de la imagen queda visible
 * ANTES de publicar, en vez de descubrirlo abriendo la web.
 */
export function VistaPreviaSlider({ slide }: { slide: SlideAdmin }) {
  const velo = Math.min(100, Math.max(0, slide.velo ?? 35)) / 100;
  const hayTexto = Boolean(slide.titulo || slide.subtitulo || slide.boton_texto);

  const vistas = [
    {
      icono: Monitor,
      nombre: 'Escritorio',
      aspecto: '16 / 9',
      imagen: slide.imagen,
      foco: slide.foco,
      ancho: 'flex-[2]',
    },
    {
      icono: Smartphone,
      nombre: 'Celular',
      aspecto: '9 / 16',
      imagen: slide.imagen_movil || slide.imagen,
      foco: slide.foco_movil,
      ancho: 'flex-[0.8]',
    },
  ];

  return (
    <div className="flex flex-wrap items-start gap-5">
      {vistas.map((v) => (
        <div key={v.nombre} className={`min-w-[140px] ${v.ancho}`}>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-bone-dim">
            <v.icono className="h-3.5 w-3.5" />
            {v.nombre}
          </p>

          <div
            className="relative overflow-hidden rounded-xl border border-white/10 bg-night-3"
            style={{ aspectRatio: v.aspecto }}
          >
            {v.imagen ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.imagen}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: v.foco || '50% 50%' }}
                />

                {hayTexto && (
                  <>
                    <div
                      className="absolute inset-x-0 bottom-0 h-2/3"
                      style={{
                        backgroundImage: `linear-gradient(to top, rgba(5,5,5,${velo}), rgba(5,5,5,${velo * 0.45}) 45%, transparent)`,
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      {slide.titulo && (
                        <p className="truncate text-[13px] font-extrabold leading-tight">
                          {slide.titulo}
                        </p>
                      )}
                      {slide.subtitulo && (
                        <p className="mt-0.5 truncate text-[10px] text-bone-dim">
                          {slide.subtitulo}
                        </p>
                      )}
                      {slide.boton_texto && (
                        <span className="mt-1.5 inline-block rounded-full bg-sugu px-2.5 py-1 text-[9px] font-bold">
                          {slide.boton_texto}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <span className="grid h-full place-items-center text-[11px] text-white/25">
                Sin imagen
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
