'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  borrar,
  guardarProducto,
  listarCategorias,
  listarProductos,
  type ProductoAdmin,
} from '@/lib/admin';
import { Presentaciones } from '@/components/admin/Presentaciones';
import { SubirImagen } from '@/components/admin/SubirImagen';
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

const ETIQUETAS = ['', 'Nuevo', 'Más pedido', 'Picante', 'Vegetariano'];

const NUEVO: ProductoAdmin = {
  slug: '',
  nombre: '',
  descripcion: '',
  precio: 0,
  categoria: 'makis',
  imagen: '/imagenes/web/productos/acevichado-roll.webp',
  etiqueta: null,
  destacado: false,
  activo: true,
  orden: 0,
  presentaciones: [],
};

export default function ProductosAdmin() {
  const [items, setItems] = useState<ProductoAdmin[] | null>(null);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [edicion, setEdicion] = useState<ProductoAdmin | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      const [p, c] = await Promise.all([listarProductos(), listarCategorias()]);
      setItems(p);
      setCategorias(c as { id: string; nombre: string }[]);
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
      await guardarProducto({
        ...edicion,
        slug: edicion.slug || edicion.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        etiqueta: edicion.etiqueta || null,
      });
      setEdicion(null);
      setAviso({ tipo: 'ok', texto: 'Producto guardado.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const eliminar = async (p: ProductoAdmin) => {
    if (!p.id || !confirm(`¿Eliminar “${p.nombre}”? Esta acción no se puede deshacer.`)) return;
    try {
      await borrar('products', p.id);
      setAviso({ tipo: 'ok', texto: 'Producto eliminado.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Productos"
        bajada="Lo que se muestra en la carta y en los favoritos de la portada."
        accion={
          <button onClick={() => setEdicion({ ...NUEVO, orden: items.length + 1 })} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nuevo producto
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-night-soft">
            <tr className="text-[11px] uppercase tracking-widest text-bone-dim">
              <th className="p-4">Producto</th>
              <th className="p-4">Categoría</th>
              <th className="p-4">Precio</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {items.map((p) => (
              <tr key={p.id ?? p.slug} className="transition-colors hover:bg-white/[0.03]">
                <td className="p-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl bg-night-3">
                      {p.imagen && (
                        <Image src={p.imagen} alt="" fill sizes="48px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.nombre}</p>
                      <p className="truncate text-xs text-bone-dim">{p.descripcion}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-bone-dim">{p.categoria}</td>
                <td className="p-4 font-semibold text-sugu">{soles(p.precio)}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {!p.activo && (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase">
                        Oculto
                      </span>
                    )}
                    {p.destacado && (
                      <span className="rounded-full bg-sugu px-2.5 py-1 text-[10px] font-bold uppercase">
                        Favorito
                      </span>
                    )}
                    {p.etiqueta && (
                      <span className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase">
                        {p.etiqueta}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <p className="p-16 text-center text-sm text-bone-dim">
            Todavía no hay productos. Crea el primero con “Nuevo producto”.
          </p>
        )}
      </div>

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar producto' : 'Nuevo producto'}
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

            <Campo etiqueta="Descripción" ancho="completo">
              <textarea
                rows={2}
                value={edicion.descripcion}
                onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
                className={`${claseCampo} resize-none`}
              />
            </Campo>

            <Campo etiqueta="Categoría">
              <select
                value={edicion.categoria}
                onChange={(e) => setEdicion({ ...edicion, categoria: e.target.value })}
                className={claseCampo}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id} className="bg-night">
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Etiqueta">
              <select
                value={edicion.etiqueta ?? ''}
                onChange={(e) => setEdicion({ ...edicion, etiqueta: e.target.value || null })}
                className={claseCampo}
              >
                {ETIQUETAS.map((t) => (
                  <option key={t} value={t} className="bg-night">
                    {t || 'Sin etiqueta'}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Presentaciones (por 5, por 10…)" ancho="completo">
              <Presentaciones
                valor={edicion.presentaciones ?? []}
                precioBase={edicion.precio}
                alCambiar={(presentaciones) => setEdicion({ ...edicion, presentaciones })}
              />
            </Campo>

            <Campo etiqueta="Imagen del producto" ancho="completo">
              <SubirImagen
                valor={edicion.imagen}
                nombreBase={edicion.slug || edicion.nombre}
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
                activo={edicion.destacado}
                alCambiar={(v) => setEdicion({ ...edicion, destacado: v })}
                etiqueta="Favorito"
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
