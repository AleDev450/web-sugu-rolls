'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  borrar,
  guardarPaquete,
  listarCategorias,
  listarPaquetes,
  type CategoriaAdmin,
  type PaqueteAdmin,
} from '@/lib/admin';
import { SubirImagen } from '@/components/admin/SubirImagen';
import { GruposSabores } from '@/components/admin/GruposSabores';
import { soles } from '@/data/productos';
import {
  Aviso,
  Campo,
  Cargando,
  Encabezado,
  Interruptor,
  Modal,
  claseCampo,
} from '@/components/admin/ui';

const NUEVO: PaqueteAdmin = {
  slug: '',
  nombre: '',
  piezas: 20,
  precio: 0,
  ideal: '',
  incluye: [],
  imagen: '/imagenes/web/productos/sugu-especial.webp',
  mas_pedido: false,
  activo: true,
  orden: 0,
  grupos: [],
};

export default function PaquetesAdmin() {
  const [items, setItems] = useState<PaqueteAdmin[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [edicion, setEdicion] = useState<PaqueteAdmin | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      setItems(await listarPaquetes());
    } catch (e) {
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar();
    void listarCategorias()
      .then((c) => setCategorias(c as CategoriaAdmin[]))
      .catch(() => {
        // sin categorías el resto del panel sigue funcionando; solo no se
        // podrá armar un grupo de sabores nuevo hasta recargar
      });
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!edicion) return;
    try {
      await guardarPaquete({
        ...edicion,
        slug: edicion.slug || edicion.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        // las líneas en blanco se descartan aquí, no mientras se escribe
        incluye: edicion.incluye.map((l) => l.trim()).filter(Boolean),
      });
      setEdicion(null);
      setAviso({ tipo: 'ok', texto: 'Promoción guardada.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const eliminar = async (p: PaqueteAdmin) => {
    if (!p.id || !confirm(`¿Eliminar “${p.nombre}”?`)) return;
    try {
      await borrar('packages', p.id);
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Promociones"
        bajada="Las cajas para compartir que aparecen en la portada."
        accion={
          <button onClick={() => setEdicion({ ...NUEVO, orden: items.length + 1 })} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nueva promoción
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((p) => (
          <article key={p.id ?? p.slug} className="card flex flex-col p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{p.nombre}</h2>
                <p className="mt-0.5 text-xs text-bone-dim">{p.ideal}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEdicion(p)}
                  className="rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                  aria-label={`Editar ${p.nombre}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => eliminar(p)}
                  className="rounded-lg border border-white/15 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                  aria-label={`Eliminar ${p.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="mt-5 text-3xl font-extrabold tracking-tight text-sugu">
              {soles(p.precio)}
            </p>
            <p className="mt-1 text-xs text-bone-dim">{p.piezas} piezas</p>

            <ul className="mt-5 flex-1 space-y-1.5 text-[13px] text-bone-dim">
              {p.incluye.map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {!p.activo && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase">
                  Oculto
                </span>
              )}
              {p.mas_pedido && (
                <span className="rounded-full bg-sugu px-2.5 py-1 text-[10px] font-bold uppercase">
                  Más pedido
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <p className="rounded-2xl border border-white/10 p-16 text-center text-sm text-bone-dim">
          Todavía no hay promociones.
        </p>
      )}

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar promoción' : 'Nueva promoción'}
        alCerrar={() => setEdicion(null)}
      >
        {edicion && (
          <form onSubmit={enviar} className="grid gap-5 sm:grid-cols-2">
            <Campo etiqueta="Nombre">
              <input
                required
                value={edicion.nombre}
                onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="Precio (S/)">
              <input
                required
                type="number"
                step="0.10"
                min="0"
                value={edicion.precio}
                onChange={(e) => setEdicion({ ...edicion, precio: Number(e.target.value) })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="N.º de piezas">
              <input
                type="number"
                min="0"
                value={edicion.piezas}
                onChange={(e) => setEdicion({ ...edicion, piezas: Number(e.target.value) })}
                className={claseCampo}
              />
            </Campo>

            <Campo etiqueta="Ideal para…">
              <input
                value={edicion.ideal}
                onChange={(e) => setEdicion({ ...edicion, ideal: e.target.value })}
                className={claseCampo}
                placeholder="Ideal para compartir"
              />
            </Campo>

            <Campo etiqueta="Qué incluye (una línea por ítem)" ancho="completo">
              {/*
                Al escribir NO se filtran las líneas vacías. Antes sí, y eso
                impedía añadir ítems: al pulsar Enter la línea nueva estaba
                vacía, el filtro la borraba en el acto y el cursor volvía
                arriba. Las vacías se descartan al guardar, en `enviar`.
              */}
              <textarea
                rows={4}
                value={edicion.incluye.join('\n')}
                onChange={(e) =>
                  setEdicion({ ...edicion, incluye: e.target.value.split('\n') })
                }
                className={claseCampo}
                placeholder={'40 piezas\n4 sabores a elección\n2 bebidas'}
              />
            </Campo>

            <Campo etiqueta="Sabores por categoría (opcional)" ancho="completo">
              <GruposSabores
                valor={edicion.grupos}
                categorias={categorias}
                piezasPromo={edicion.piezas}
                alCambiar={(grupos) => setEdicion({ ...edicion, grupos })}
              />
            </Campo>

            <Campo etiqueta="Imagen de la promoción" ancho="completo">
              <SubirImagen
                valor={edicion.imagen}
                nombreBase={edicion.slug || edicion.nombre}
                tipo="paquete"
                alCambiar={(url) => setEdicion({ ...edicion, imagen: url })}
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

            <div className="flex items-end gap-6 pb-1">
              <Interruptor
                activo={edicion.activo}
                alCambiar={(v) => setEdicion({ ...edicion, activo: v })}
                etiqueta="Visible"
              />
              <Interruptor
                activo={edicion.mas_pedido}
                alCambiar={(v) => setEdicion({ ...edicion, mas_pedido: v })}
                etiqueta="Más pedido"
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
