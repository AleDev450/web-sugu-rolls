'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  borrarCategoria,
  guardarCategoria,
  listarCategorias,
  listarProductos,
  type CategoriaAdmin,
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

const NUEVA: CategoriaAdmin = {
  id: '',
  nombre: '',
  descripcion: '',
  orden: 0,
  activa: true,
};

/** Convierte "Platos Calientes" en "platos-calientes". */
function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CategoriasAdmin() {
  const [items, setItems] = useState<CategoriaAdmin[] | null>(null);
  const [cuenta, setCuenta] = useState<Map<string, number>>(new Map());
  const [edicion, setEdicion] = useState<CategoriaAdmin | null>(null);
  const [esNueva, setEsNueva] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      const [c, p] = await Promise.all([listarCategorias(), listarProductos().catch(() => [])]);
      setItems(c as CategoriaAdmin[]);
      const m = new Map<string, number>();
      for (const prod of p) m.set(prod.categoria, (m.get(prod.categoria) ?? 0) + 1);
      setCuenta(m);
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
      await guardarCategoria({ ...edicion, id: edicion.id || aSlug(edicion.nombre) }, esNueva);
      setEdicion(null);
      setAviso({ tipo: 'ok', texto: 'Categoría guardada.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const eliminar = async (c: CategoriaAdmin) => {
    const n = cuenta.get(c.id) ?? 0;
    if (n > 0) {
      setAviso({
        tipo: 'error',
        texto: `“${c.nombre}” tiene ${n} productos. Muévelos a otra categoría o desactívala en vez de borrarla.`,
      });
      return;
    }
    if (!confirm(`¿Eliminar la categoría “${c.nombre}”?`)) return;
    try {
      await borrarCategoria(c.id);
      setAviso({ tipo: 'ok', texto: 'Categoría eliminada.' });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Categorías"
        bajada="Las secciones en las que se agrupa la carta. El orden es el que ven los clientes."
        accion={
          <button
            onClick={() => {
              setEsNueva(true);
              setEdicion({ ...NUEVA, orden: items.length + 1 });
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nueva categoría
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
              <th className="p-4">Orden</th>
              <th className="p-4">Categoría</th>
              <th className="p-4">Identificador</th>
              <th className="p-4 text-right">Productos</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {items.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="p-4 tabular-nums text-bone-dim">{c.orden}</td>
                <td className="p-4">
                  <p className="font-semibold">{c.nombre}</p>
                  <p className="truncate text-xs text-bone-dim">{c.descripcion}</p>
                </td>
                <td className="p-4 font-mono text-[12px] text-bone-dim">{c.id}</td>
                <td className="p-4 text-right tabular-nums text-bone-dim">
                  {cuenta.get(c.id) ?? 0}
                </td>
                <td className="p-4">
                  {c.activa ? (
                    <span className="rounded-full bg-emerald-600/20 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400">
                      Visible
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-bone-dim">
                      Oculta
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEsNueva(false);
                        setEdicion(c);
                      }}
                      className="rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                      aria-label={`Editar ${c.nombre}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void eliminar(c)}
                      className="rounded-lg border border-white/15 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                      aria-label={`Eliminar ${c.nombre}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[13px] text-bone-dim">
        Una categoría con productos no se puede borrar: desactívala y desaparece de la carta sin
        perder nada.
      </p>

      <Modal
        abierto={edicion !== null}
        titulo={esNueva ? 'Nueva categoría' : 'Editar categoría'}
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
                placeholder="Handroll"
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

            <Campo etiqueta="Descripción" ancho="completo">
              <input
                value={edicion.descripcion ?? ''}
                onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
                className={claseCampo}
                placeholder="Conos de alga rellenos, listos para la mano"
              />
            </Campo>

            {esNueva ? (
              <Campo etiqueta="Identificador (se genera solo)" ancho="completo">
                <input
                  value={edicion.id || aSlug(edicion.nombre)}
                  onChange={(e) => setEdicion({ ...edicion, id: aSlug(e.target.value) })}
                  className={`${claseCampo} font-mono text-[12px]`}
                />
                <span className="mt-1.5 block text-[11px] text-white/40">
                  Es la clave con la que se guardan los productos. No se puede cambiar después.
                </span>
              </Campo>
            ) : (
              <p className="text-[12px] text-white/40 sm:col-span-2">
                Identificador: <span className="font-mono">{edicion.id}</span> — no se cambia,
                porque es lo que enlaza los productos con su categoría.
              </p>
            )}

            <div className="flex items-end pb-1 sm:col-span-2">
              <Interruptor
                activo={edicion.activa}
                alCambiar={(activa) => setEdicion({ ...edicion, activa })}
                etiqueta="Visible en la carta"
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
