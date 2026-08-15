'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import { guardarAjustes, traerAjustesAdmin } from '@/lib/admin';
import { SubirImagen } from '@/components/admin/SubirImagen';
import { SubirIdentidad } from '@/components/admin/SubirIdentidad';
import { EstadoSeo } from '@/components/admin/EstadoSeo';
import { SeoPorPagina } from '@/components/admin/SeoPorPagina';
import { VistaPreviaSocial } from '@/components/admin/VistaPreviaSocial';
import { VistaPreviaPestana } from '@/components/admin/VistaPreviaPestana';
import { DOMINIO } from '@/data/site';
import { Aviso, Campo, Cargando, Encabezado, Interruptor, claseCampo } from '@/components/admin/ui';

const NOMBRE_POR_DEFECTO = 'Sugu Rolls';
const ALTERNO_POR_DEFECTO = 'SuguRolls';
const TITULO_POR_DEFECTO = 'Sugu Rolls — Makis que te hacen feliz | Delivery de sushi en Lima';
const DESCRIPCION_POR_DEFECTO =
  'Makis preparados al momento con ingredientes frescos. Carta, paquetes para compartir, catering y delivery de sushi en Lima. Pide por WhatsApp y juega para ganar premios.';
const IMAGEN_POR_DEFECTO = '/imagenes/web/hero-makis.webp';
const PLANTILLA_POR_DEFECTO = '%s | Sugu Rolls';

const CAMPOS_TEXTO = [
  'seo_nombre_sitio',
  'seo_nombre_alterno',
  'seo_favicon',
  'seo_logo',
  'meta_titulo',
  'meta_descripcion',
  'meta_imagen',
  'seo_plantilla_titulo',
] as const;

type Campo = (typeof CAMPOS_TEXTO)[number];
type Datos = Record<Campo, string>;

/**
 * SEO y metadatos: identidad del sitio (nombre, favicon), logo del negocio,
 * configuración general (título, descripción, imagen, plantilla, index/
 * follow), tres vistas previas y el estado en vivo de todo eso, más el SEO
 * propio de cada página.
 *
 * Todo vacío = se usa lo que ya trae el código (`layout.tsx`,
 * `DatosEstructurados`, cada `page.tsx`): este panel nunca puede dejar la
 * web sin metadatos por estar a medio llenar.
 */
export default function SeoAdmin() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fila = (await traerAjustesAdmin()) as Record<string, unknown>;
        const limpio = {} as Datos;
        for (const c of CAMPOS_TEXTO) limpio[c] = (fila[c] as string) ?? '';
        setDatos(limpio);
        setRobotsIndex(fila.seo_robots_index !== false);
        setRobotsFollow(fila.seo_robots_follow !== false);
      } catch (e) {
        const vacio = {} as Datos;
        for (const c of CAMPOS_TEXTO) vacio[c] = '';
        setDatos(vacio);
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    })();
  }, []);

  const set = (campo: Campo, valor: string) => setDatos((d) => (d ? { ...d, [campo]: valor } : d));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!datos) return;
    setGuardando(true);
    try {
      await guardarAjustes({
        ...datos,
        seo_robots_index: robotsIndex,
        seo_robots_follow: robotsFollow,
      });
      setAviso({
        tipo: 'ok',
        texto: 'SEO guardado. La web lo refleja en unos minutos (hay una caché corta de por medio).',
      });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return <Cargando />;

  const nombreSitio = datos.seo_nombre_sitio.trim() || NOMBRE_POR_DEFECTO;
  const titulo = datos.meta_titulo.trim() || TITULO_POR_DEFECTO;
  const descripcion = datos.meta_descripcion.trim() || DESCRIPCION_POR_DEFECTO;
  const imagen = datos.meta_imagen.trim() || IMAGEN_POR_DEFECTO;
  const dominioLimpio = DOMINIO.replace(/^https?:\/\//, '');

  return (
    <>
      <Encabezado
        titulo="SEO y metadatos"
        bajada="Identidad, título, descripción e imagen que Google, WhatsApp y el navegador muestran del sitio."
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={enviar} className="space-y-6">
          {/* 1. Identidad en Google */}
          <section className="card p-8">
            <h2 className="font-bold">Identidad en Google</h2>
            <p className="mt-1 text-[13px] text-bone-dim">
              Nombre y favicon que Google asocia al sitio en el resultado de búsqueda.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Campo etiqueta="Nombre del sitio">
                <input
                  value={datos.seo_nombre_sitio}
                  onChange={(e) => set('seo_nombre_sitio', e.target.value)}
                  className={claseCampo}
                  placeholder={NOMBRE_POR_DEFECTO}
                />
              </Campo>
              <Campo etiqueta="Nombre alternativo">
                <input
                  value={datos.seo_nombre_alterno}
                  onChange={(e) => set('seo_nombre_alterno', e.target.value)}
                  className={claseCampo}
                  placeholder={ALTERNO_POR_DEFECTO}
                />
              </Campo>

              <Campo etiqueta="Favicon" ancho="completo">
                <SubirIdentidad
                  valor={datos.seo_favicon}
                  ruta="secciones/favicon"
                  forma="circular"
                  cuadrada
                  ladoMinimo={48}
                  ayuda="Cuadrado. Recomendado 512×512 px, mínimo 48×48 px. PNG, JPG, WEBP o ICO. Se publica siempre en /icon.png y /favicon.ico — reemplazarlo no cambia esa URL, así que Google no se queda con una versión vieja en caché."
                  alCambiar={(url) => set('seo_favicon', url)}
                />
              </Campo>
            </div>
          </section>

          {/* 2. Logo del negocio */}
          <section className="card p-8">
            <h2 className="font-bold">Logo del negocio</h2>
            <p className="mt-1 text-[13px] text-bone-dim">
              Va en los datos estructurados (Restaurant y Organization). No es el favicon ni la
              imagen que se comparte en redes.
            </p>

            <div className="mt-6">
              <SubirIdentidad
                valor={datos.seo_logo}
                ruta="secciones/logo"
                forma="cuadrada"
                ladoMinimo={112}
                ayuda="Recomendado mínimo 112×112 px. Se usa solo en los datos estructurados, no como favicon ni como imagen de Open Graph."
                alCambiar={(url) => set('seo_logo', url)}
              />
            </div>
          </section>

          {/* 3. Configuración SEO */}
          <section className="card p-8">
            <h2 className="font-bold">Configuración SEO</h2>
            <p className="mt-1 text-[13px] text-bone-dim">
              Título, descripción e imagen por defecto de todo el sitio.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Campo etiqueta="URL principal (canónica)" ancho="completo">
                <p className="rounded-xl border border-white/10 bg-night/60 px-4 py-2.5 font-mono text-[13px] text-bone-dim">
                  {DOMINIO}/
                </p>
                <span className="mt-1.5 block text-[11px] text-white/40">
                  Fija: depende del dominio real del sitio, no se edita desde aquí.
                </span>
              </Campo>

              <Campo etiqueta="Título predeterminado" ancho="completo">
                <input
                  value={datos.meta_titulo}
                  onChange={(e) => set('meta_titulo', e.target.value)}
                  className={claseCampo}
                  placeholder={TITULO_POR_DEFECTO}
                  maxLength={70}
                />
                <span className="mt-1.5 block text-[11px] text-white/40">
                  {datos.meta_titulo.length}/70 · vacío = usa el título del código
                </span>
              </Campo>

              <Campo etiqueta="Descripción predeterminada" ancho="completo">
                <textarea
                  rows={3}
                  value={datos.meta_descripcion}
                  onChange={(e) => set('meta_descripcion', e.target.value)}
                  className={claseCampo}
                  placeholder={DESCRIPCION_POR_DEFECTO}
                  maxLength={160}
                />
                <span className="mt-1.5 block text-[11px] text-white/40">
                  {datos.meta_descripcion.length}/160 · vacío = usa la descripción del código
                </span>
              </Campo>

              <Campo etiqueta="Plantilla de título en páginas internas">
                <input
                  value={datos.seo_plantilla_titulo}
                  onChange={(e) => set('seo_plantilla_titulo', e.target.value)}
                  className={`${claseCampo} font-mono`}
                  placeholder={PLANTILLA_POR_DEFECTO}
                />
                <span className="mt-1.5 block text-[11px] text-white/40">
                  %s se reemplaza por el título de cada página, p. ej. &quot;Catering | Sugu
                  Rolls&quot;
                </span>
              </Campo>

              <div className="flex flex-col justify-center gap-4">
                <Interruptor activo={robotsIndex} alCambiar={setRobotsIndex} etiqueta="Permitir indexar (index)" />
                <Interruptor activo={robotsFollow} alCambiar={setRobotsFollow} etiqueta="Permitir seguir enlaces (follow)" />
              </div>

              <Campo etiqueta="Imagen para compartir — 1200×630 (Google, WhatsApp, redes)" ancho="completo">
                <SubirImagen
                  valor={datos.meta_imagen}
                  nombreBase="meta-sugu-rolls"
                  tipo="meta"
                  alCambiar={(url) => set('meta_imagen', url)}
                />
              </Campo>
            </div>
          </section>

          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        {/* Vistas previas */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
              Así se ve en Google
            </p>
            <div className="card flex gap-4 bg-white p-5 text-black">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="relative grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-neutral-100">
                    <Globe className="h-3.5 w-3.5 text-neutral-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-neutral-900">{nombreSitio}</p>
                    <p className="truncate text-[12px] text-neutral-500">{dominioLimpio}</p>
                  </div>
                </div>
                <p className="mt-1.5 truncate text-[19px] text-[#1a0dab]">{titulo}</p>
                <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-[#4d5156]">
                  {descripcion}
                </p>
              </div>
              <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg bg-neutral-100">
                <Image src={imagen} alt="" fill sizes="80px" className="object-cover" unoptimized />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
              Vista previa de WhatsApp / Facebook
            </p>
            <VistaPreviaSocial
              dominio={dominioLimpio}
              titulo={titulo}
              descripcion={descripcion}
              imagen={imagen}
            />
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
              Vista previa de la pestaña
            </p>
            <VistaPreviaPestana favicon="/icon.png" titulo={titulo} />
          </div>

          <p className="text-[11px] leading-relaxed text-white/40">
            Son vistas previas aproximadas: cada plataforma decide el formato final y puede tardar
            en volver a rastrear la web tras un cambio.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <EstadoSeo
          favicon={datos.seo_favicon}
          logo={datos.seo_logo}
          imagenSocial={datos.meta_imagen}
          titulo={datos.meta_titulo}
          descripcion={datos.meta_descripcion}
          dominio={DOMINIO}
        />
        <div />
      </div>

      <div className="mt-8">
        <SeoPorPagina alAvisar={setAviso} />
      </div>
    </>
  );
}
