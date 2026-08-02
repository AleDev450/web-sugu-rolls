'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { guardarSeccion, listarSecciones, type SeccionAdmin } from '@/lib/admin';
import { PAGINAS } from '@/data/secciones';
import {
  Aviso,
  Campo,
  Cargando,
  Encabezado,
  Modal,
  claseCampo,
} from '@/components/admin/ui';
import { EditorExtra } from '@/components/admin/EditorExtra';

/**
 * Editor del contenido de cada sección, agrupado por la página donde vive.
 * Los campos comunes (etiqueta, título, manuscrito, bajada, imagen) son
 * iguales para todas; lo propio de cada sección se edita en `extra`.
 */
export default function PaginasAdmin() {
  const [items, setItems] = useState<SeccionAdmin[] | null>(null);
  const [edicion, setEdicion] = useState<SeccionAdmin | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      setItems(await listarSecciones());
    } catch (e) {
      setItems([]);
      setAviso({
        tipo: 'error',
        texto:
          (e as Error).message +
          ' — ¿ejecutaste supabase/secciones.sql en el SQL Editor?',
      });
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!edicion) return;
    try {
      await guardarSeccion(edicion);
      setEdicion(null);
      setAviso({ tipo: 'ok', texto: 'Sección guardada. La web ya muestra los cambios.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Páginas"
        bajada="Textos e imágenes de cada sección, agrupados por la página donde aparecen."
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="space-y-10">
        {PAGINAS.map((pagina) => {
          const secciones = items.filter((s) => s.pagina === pagina.id);
          if (secciones.length === 0) return null;

          return (
            <section key={pagina.id}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-bold">{pagina.nombre}</h2>
                <a
                  href={pagina.ruta}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-bone-dim transition-colors hover:text-sugu"
                >
                  {pagina.ruta}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {secciones.map((s) => (
                  <article key={s.id} className="card flex flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{s.titulo_panel}</h3>
                        {s.etiqueta && (
                          <p className="mt-1 truncate text-[11px] uppercase tracking-widest text-sugu">
                            {s.etiqueta}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setEdicion(s)}
                        className="flex-none rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                        aria-label={`Editar ${s.titulo_panel}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {(s.titulo || s.manuscrito) && (
                      <p className="mt-3 text-sm">
                        {s.titulo}{' '}
                        <span className="font-brush text-lg text-sugu">{s.manuscrito}</span>
                      </p>
                    )}

                    {s.bajada && (
                      <p className="mt-2 line-clamp-2 text-[13px] text-bone-dim">{s.bajada}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {items.length === 0 && !aviso && (
        <p className="rounded-2xl border border-white/10 p-16 text-center text-sm text-bone-dim">
          No hay secciones. Ejecuta <code className="text-sugu">supabase/secciones.sql</code>.
        </p>
      )}

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.titulo_panel ?? ''}
        alCerrar={() => setEdicion(null)}
      >
        {edicion && (
          <form onSubmit={enviar} className="grid gap-5 sm:grid-cols-2">
            <Campo etiqueta="Texto pequeño (sobre el título)" ancho="completo">
              <input
                value={edicion.etiqueta}
                onChange={(e) => setEdicion({ ...edicion, etiqueta: e.target.value })}
                className={claseCampo}
                placeholder="Los más pedidos"
              />
            </Campo>

            <Campo etiqueta="Título">
              <input
                value={edicion.titulo}
                onChange={(e) => setEdicion({ ...edicion, titulo: e.target.value })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="Palabra en rojo (manuscrita)">
              <input
                value={edicion.manuscrito}
                onChange={(e) => setEdicion({ ...edicion, manuscrito: e.target.value })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="Párrafo" ancho="completo">
              <textarea
                rows={3}
                value={edicion.bajada}
                onChange={(e) => setEdicion({ ...edicion, bajada: e.target.value })}
                className={`${claseCampo} resize-none`}
              />
            </Campo>

            <Campo etiqueta="Imagen" ancho="completo">
              <input
                value={edicion.imagen}
                onChange={(e) => setEdicion({ ...edicion, imagen: e.target.value })}
                className={claseCampo}
                placeholder="/imagenes/web/hero-makis.webp"
              />
            </Campo>

            <div className="sm:col-span-2">
              <EditorExtra
                extra={edicion.extra}
                alCambiar={(extra) => setEdicion({ ...edicion, extra })}
              />
            </div>

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
