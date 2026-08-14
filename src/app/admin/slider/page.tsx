'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  borrarSlide,
  guardarAjustes,
  guardarSlide,
  listarSlides,
  traerAjustesAdmin,
  type SlideAdmin,
} from '@/lib/admin';
import { Encuadre } from '@/components/admin/Encuadre';
import { SubirImagen } from '@/components/admin/SubirImagen';
import {
  Aviso,
  Campo,
  Cargando,
  Encabezado,
  Interruptor,
  Modal,
  claseCampo,
} from '@/components/admin/ui';

const NUEVA: SlideAdmin = {
  titulo: '',
  subtitulo: '',
  imagen: '',
  imagen_movil: '',
  foco: '50% 50%',
  foco_movil: '50% 50%',
  velo: 35,
  boton_texto: '',
  boton_enlace: '',
  orden: 0,
  activo: true,
};

/**
 * Carrusel de la portada.
 *
 * Cada diapositiva lleva DOS imágenes: la de escritorio (1920×1080) y una
 * vertical para teléfono. Una foto apaisada recortada a pantalla de móvil
 * pierde el centro, así que se controla por separado qué se ve en cada uno.
 */
export default function SliderAdmin() {
  const [items, setItems] = useState<SlideAdmin[] | null>(null);
  const [edicion, setEdicion] = useState<SlideAdmin | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [margen, setMargen] = useState(0);

  const cargar = async () => {
    try {
      setItems(await listarSlides());
      const f = (await traerAjustesAdmin()) as Record<string, unknown>;
      setMargen(Number(f.slider_margen ?? 0));
    } catch (e) {
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!edicion) return;
    try {
      await guardarSlide(edicion);
      setEdicion(null);
      setAviso({ tipo: 'ok', texto: 'Diapositiva guardada.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const eliminar = async (d: SlideAdmin) => {
    if (!d.id || !confirm('¿Eliminar esta diapositiva?')) return;
    try {
      await borrarSlide(d.id);
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const guardarMargen = async (v: number) => {
    setMargen(v);
    try {
      await guardarAjustes({ slider_margen: String(v) });
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Slider de portada"
        bajada="Lo primero que se ve al entrar. Sin diapositivas, la portada usa la cabecera de siempre."
        accion={
          <button
            onClick={() => setEdicion({ ...NUEVA, orden: items.length + 1 })}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nueva diapositiva
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      {/*
        Ajuste fino de la posición. El slider ya empieza donde acaba el menú
        —eso se calcula solo—; esto es el aire extra por debajo, para cuando
        una imagen concreta pide respirar más.
      */}
      <section className="card mb-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-bold">Separación bajo el menú</h2>
          <span className="text-[13px] tabular-nums text-bone-dim">
            {margen === 0 ? 'Pegado al menú' : `${margen} px más abajo`}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={200}
          step={4}
          value={margen}
          onChange={(e) => void guardarMargen(Number(e.target.value))}
          className="mt-4 w-full accent-[#E31323]"
        />

        <div className="mt-4 grid gap-3 text-[12px] leading-relaxed text-white/45 sm:grid-cols-2">
          <p>
            El carrusel ya arranca justo donde termina el menú. Sube esto solo si quieres dejar
            más aire; la altura visible se descuenta sola, así que nunca se sale de la pantalla.
          </p>
          <p>
            <b className="text-white">Medidas de las imágenes:</b> escritorio{' '}
            <span className="font-mono">1920×1080</span>, celular{' '}
            <span className="font-mono">1080×1920</span>. Se recortan y comprimen solas al
            subirlas.
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <p className="card p-16 text-center text-sm text-bone-dim">
          Todavía no hay diapositivas. La portada muestra la cabecera clásica.
        </p>
      ) : (
        <div className="grid gap-5">
          {items.map((d) => (
            <article key={d.id} className="card flex flex-wrap items-center gap-5 p-5">
              <div className="relative h-24 w-44 flex-none overflow-hidden rounded-xl bg-night-3">
                {d.imagen && (
                  <Image src={d.imagen} alt="" fill sizes="176px" className="object-cover" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-bold">{d.titulo || <span className="text-bone-dim">Sin título</span>}</p>
                <p className="mt-0.5 truncate text-[13px] text-bone-dim">{d.subtitulo}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase text-bone-dim">
                    Orden {d.orden}
                  </span>
                  {!d.activo && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase">
                      Oculta
                    </span>
                  )}
                  {!d.imagen_movil && (
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-400">
                      Sin versión móvil
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-none gap-2">
                <button
                  onClick={() => setEdicion(d)}
                  className="rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void eliminar(d)}
                  className="rounded-lg border border-white/15 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar diapositiva' : 'Nueva diapositiva'}
        alCerrar={() => setEdicion(null)}
      >
        {edicion && (
          <form onSubmit={enviar} className="grid gap-5 sm:grid-cols-2">
            <Campo etiqueta="Imagen de escritorio (1920×1080)" ancho="completo">
              <SubirImagen
                valor={edicion.imagen}
                nombreBase={edicion.titulo || 'slide'}
                tipo="slider"
                alCambiar={(url) => setEdicion({ ...edicion, imagen: url })}
              />
              <Encuadre
                imagen={edicion.imagen}
                valor={edicion.foco}
                aspecto="16 / 9"
                etiqueta="Así se verá en escritorio"
                alCambiar={(foco) => setEdicion({ ...edicion, foco })}
              />
            </Campo>

            <Campo etiqueta="Imagen para celular (vertical)" ancho="completo">
              <SubirImagen
                valor={edicion.imagen_movil}
                nombreBase={`${edicion.titulo || 'slide'}-movil`}
                tipo="sliderMovil"
                alCambiar={(url) => setEdicion({ ...edicion, imagen_movil: url })}
              />
              <Encuadre
                imagen={edicion.imagen_movil || edicion.imagen}
                valor={edicion.foco_movil}
                aspecto="9 / 16"
                etiqueta="Así se verá en el celular"
                alCambiar={(foco_movil) => setEdicion({ ...edicion, foco_movil })}
              />
            </Campo>

            <Campo etiqueta="Título" ancho="completo">
              <input
                value={edicion.titulo}
                onChange={(e) => setEdicion({ ...edicion, titulo: e.target.value })}
                className={claseCampo}
                placeholder="Makis que te hacen feliz"
              />
            </Campo>

            <Campo etiqueta="Subtítulo" ancho="completo">
              <input
                value={edicion.subtitulo}
                onChange={(e) => setEdicion({ ...edicion, subtitulo: e.target.value })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="Texto del botón">
              <input
                value={edicion.boton_texto}
                onChange={(e) => setEdicion({ ...edicion, boton_texto: e.target.value })}
                className={claseCampo}
                placeholder="Ver la carta"
              />
            </Campo>

            <Campo etiqueta="Enlace del botón">
              <input
                value={edicion.boton_enlace}
                onChange={(e) => setEdicion({ ...edicion, boton_enlace: e.target.value })}
                className={claseCampo}
                placeholder="/carta"
              />
            </Campo>

            <Campo etiqueta={`Oscurecido de la foto · ${edicion.velo}%`} ancho="completo">
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={edicion.velo}
                onChange={(e) => setEdicion({ ...edicion, velo: Number(e.target.value) })}
                className="w-full accent-[#E31323]"
              />
              <span className="mt-1.5 block text-[11px] text-white/40">
                Sube si el texto no se lee sobre la foto; baja si la imagen se ve apagada. Con 0 la
                foto sale tal cual.
              </span>
            </Campo>

            <Campo etiqueta="Orden">
              <input
                type="number"
                value={edicion.orden}
                onChange={(e) => setEdicion({ ...edicion, orden: Number(e.target.value) })}
                className={claseCampo}
              />
            </Campo>

            <div className="flex items-end pb-1">
              <Interruptor
                activo={edicion.activo}
                alCambiar={(activo) => setEdicion({ ...edicion, activo })}
                etiqueta="Visible en la portada"
              />
            </div>

            <p className="text-[12px] leading-relaxed text-white/40 sm:col-span-2">
              Sin imagen de celular se usa la de escritorio recortada, que en pantallas verticales
              suele dejar fuera lo importante. Merece la pena subir las dos.
            </p>

            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={() => setEdicion(null)} className="btn-ghost">
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Guardar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
