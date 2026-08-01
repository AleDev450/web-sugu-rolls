'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import {
  borrar,
  guardarTestimonio,
  listarTestimonios,
  type TestimonioAdmin,
} from '@/lib/admin';
import {
  Aviso,
  Campo,
  Cargando,
  Encabezado,
  Interruptor,
  Modal,
  claseCampo,
} from '@/components/admin/ui';

const NUEVO: TestimonioAdmin = {
  nombre: '',
  comentario: '',
  estrellas: 5,
  activo: true,
  orden: 0,
};

export default function TestimoniosAdmin() {
  const [items, setItems] = useState<TestimonioAdmin[] | null>(null);
  const [edicion, setEdicion] = useState<TestimonioAdmin | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      setItems(await listarTestimonios());
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
      await guardarTestimonio(edicion);
      setEdicion(null);
      setAviso({ tipo: 'ok', texto: 'Testimonio guardado.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const eliminar = async (t: TestimonioAdmin) => {
    if (!t.id || !confirm(`¿Eliminar el testimonio de ${t.nombre}?`)) return;
    try {
      await borrar('testimonials', t.id);
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Testimonios"
        bajada="Las reseñas del carrusel de la portada."
        accion={
          <button onClick={() => setEdicion({ ...NUEVO, orden: items.length + 1 })} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nuevo testimonio
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {items.map((t) => (
          <article key={t.id} className="card p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-1">
                {Array.from({ length: t.estrellas }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-sugu text-sugu" />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEdicion(t)}
                  className="rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                  aria-label={`Editar testimonio de ${t.nombre}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => eliminar(t)}
                  className="rounded-lg border border-white/15 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                  aria-label={`Eliminar testimonio de ${t.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-bone-soft">“{t.comentario}”</p>

            <footer className="mt-5 flex items-center justify-between">
              <span className="text-[13px] font-semibold">{t.nombre}</span>
              {!t.activo && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase">
                  Oculto
                </span>
              )}
            </footer>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <p className="rounded-2xl border border-white/10 p-16 text-center text-sm text-bone-dim">
          Todavía no hay testimonios.
        </p>
      )}

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar testimonio' : 'Nuevo testimonio'}
        alCerrar={() => setEdicion(null)}
      >
        {edicion && (
          <form onSubmit={enviar} className="grid gap-5 sm:grid-cols-2">
            <Campo etiqueta="Nombre del cliente">
              <input
                required
                value={edicion.nombre}
                onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="Estrellas">
              <select
                value={edicion.estrellas}
                onChange={(e) => setEdicion({ ...edicion, estrellas: Number(e.target.value) })}
                className={claseCampo}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n} className="bg-night">
                    {n} {n === 1 ? 'estrella' : 'estrellas'}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Comentario" ancho="completo">
              <textarea
                required
                rows={4}
                value={edicion.comentario}
                onChange={(e) => setEdicion({ ...edicion, comentario: e.target.value })}
                className={`${claseCampo} resize-none`}
              />
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
                alCambiar={(v) => setEdicion({ ...edicion, activo: v })}
                etiqueta="Visible"
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
