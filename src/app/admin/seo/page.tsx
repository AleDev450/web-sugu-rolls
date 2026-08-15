'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import { guardarAjustes, traerAjustesAdmin } from '@/lib/admin';
import { SubirImagen } from '@/components/admin/SubirImagen';
import { DOMINIO } from '@/data/site';
import { Aviso, Campo, Cargando, Encabezado, claseCampo } from '@/components/admin/ui';

const TITULO_POR_DEFECTO = 'Sugu Rolls — Makis que te hacen feliz | Delivery de sushi en Lima';
const DESCRIPCION_POR_DEFECTO =
  'Makis preparados al momento con ingredientes frescos. Carta, paquetes para compartir, catering y delivery de sushi en Lima. Pide por WhatsApp y juega para ganar premios.';
const IMAGEN_POR_DEFECTO = '/imagenes/web/hero-makis.webp';

interface Datos {
  meta_titulo: string;
  meta_descripcion: string;
  meta_imagen: string;
  [clave: string]: string;
}

/**
 * Metas de SEO: lo que Google muestra en el resultado de búsqueda de la
 * portada (título, descripción e imagen).
 *
 * Vacío en cualquier campo = se usa lo que ya trae `src/app/layout.tsx`, así
 * que este panel no puede dejar la web sin metadatos por accidente.
 */
export default function SeoAdmin() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fila = (await traerAjustesAdmin()) as Record<string, string | null>;
        setDatos({
          meta_titulo: fila.meta_titulo ?? '',
          meta_descripcion: fila.meta_descripcion ?? '',
          meta_imagen: fila.meta_imagen ?? '',
        });
      } catch (e) {
        setDatos({ meta_titulo: '', meta_descripcion: '', meta_imagen: '' });
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    })();
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!datos) return;
    setGuardando(true);
    try {
      await guardarAjustes(datos);
      setAviso({ tipo: 'ok', texto: 'Metas guardadas. Google tarda en volver a rastrear la web.' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return <Cargando />;

  const titulo = datos.meta_titulo.trim() || TITULO_POR_DEFECTO;
  const descripcion = datos.meta_descripcion.trim() || DESCRIPCION_POR_DEFECTO;
  const imagen = datos.meta_imagen.trim() || IMAGEN_POR_DEFECTO;
  const dominio = DOMINIO.replace(/^https?:\/\//, '');

  return (
    <>
      <Encabezado
        titulo="SEO y metadatos"
        bajada="Título, descripción e imagen que Google muestra en el resultado de búsqueda."
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={enviar} className="card p-8">
          <div className="grid gap-5">
            <Campo etiqueta="Título para Google" ancho="completo">
              <input
                value={datos.meta_titulo}
                onChange={(e) => setDatos({ ...datos, meta_titulo: e.target.value })}
                className={claseCampo}
                placeholder={TITULO_POR_DEFECTO}
                maxLength={70}
              />
              <span className="mt-1.5 block text-[11px] text-white/40">
                {datos.meta_titulo.length}/70 · vacío = usa el título del código
              </span>
            </Campo>

            <Campo etiqueta="Descripción para Google" ancho="completo">
              <textarea
                rows={3}
                value={datos.meta_descripcion}
                onChange={(e) => setDatos({ ...datos, meta_descripcion: e.target.value })}
                className={claseCampo}
                placeholder={DESCRIPCION_POR_DEFECTO}
                maxLength={160}
              />
              <span className="mt-1.5 block text-[11px] text-white/40">
                {datos.meta_descripcion.length}/160 · vacío = usa la descripción del código
              </span>
            </Campo>

            <Campo etiqueta="Imagen para compartir (Google, WhatsApp, redes)" ancho="completo">
              <SubirImagen
                valor={datos.meta_imagen}
                nombreBase="meta-sugu-rolls"
                tipo="meta"
                alCambiar={(url) => setDatos({ ...datos, meta_imagen: url })}
              />
            </Campo>
          </div>

          <button type="submit" disabled={guardando} className="btn-primary mt-8">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        {/* Vista previa del resultado de Google, para ver el cambio antes de guardar */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
            Así se ve en Google
          </p>
          <div className="card flex gap-4 bg-white p-5 text-black">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-neutral-100">
                  <Globe className="h-3.5 w-3.5 text-neutral-500" />
                </span>
                <span className="truncate text-[13px] text-neutral-800">{dominio}</span>
              </div>
              <p className="mt-1.5 truncate text-[19px] text-[#1a0dab]">{titulo}</p>
              <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-[#4d5156]">
                {descripcion}
              </p>
            </div>
            <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg bg-neutral-100">
              <Image src={imagen} alt="" fill sizes="80px" className="object-cover" />
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Es una vista previa aproximada: Google decide el formato final y puede tardar días o
            semanas en volver a rastrear la web tras un cambio.
          </p>
        </div>
      </div>
    </>
  );
}
