'use client';

import { Plus, Trash2 } from 'lucide-react';
import { cantidadSabores, type GrupoSaboresPromo } from '@/data/productos';
import type { CategoriaAdmin } from '@/lib/admin';
import { claseCampo } from './ui';

/**
 * Editor de los grupos de sabores de una promoción.
 *
 * No se guarda cuántos sabores elige el cliente: sale de dividir
 * `piezas_asignadas` entre `piezas_por_sabor`, en vivo, tanto aquí como en
 * la web y en `crear_pedido`. Así nunca se desincroniza un número guardado
 * de la cuenta real.
 *
 * La lista de sabores para elegir no se escribe a mano: sale de los
 * productos activos de la categoría elegida, así que un maki nuevo o dado
 * de baja se refleja solo en la promoción sin tocar nada aquí.
 */
export function GruposSabores({
  valor,
  categorias,
  piezasPromo,
  alCambiar,
}: {
  valor: GrupoSaboresPromo[];
  categorias: CategoriaAdmin[];
  /** piezas totales de la promoción, para sugerir el valor al añadir un grupo */
  piezasPromo: number;
  alCambiar: (grupos: GrupoSaboresPromo[]) => void;
}) {
  const set = (i: number, campo: keyof GrupoSaboresPromo, val: string | number) =>
    alCambiar(valor.map((g, j) => (j === i ? { ...g, [campo]: val } : g)));

  const quitar = (i: number) => alCambiar(valor.filter((_, j) => j !== i));

  const anadir = () => {
    const categoria = categorias[0]?.id ?? '';
    const nombreCategoria = categorias[0]?.nombre ?? '';
    alCambiar([
      ...valor,
      {
        titulo: nombreCategoria ? `Elige tus sabores de ${nombreCategoria}` : '',
        categoria,
        piezas_asignadas: piezasPromo || 20,
        piezas_por_sabor: 10,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {valor.length === 0 && (
        <p className="text-[12px] text-white/40">
          Sin grupos: la promoción se pide de un clic, sin elegir nada. Añade uno para que el
          cliente elija sabores reales de una categoría.
        </p>
      )}

      {valor.map((g, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-night/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] text-bone-dim">
                  Título (lo que ve el cliente)
                </span>
                <input
                  value={g.titulo}
                  onChange={(e) => set(i, 'titulo', e.target.value)}
                  className={claseCampo}
                  placeholder="Elige tus sabores de Makis"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] text-bone-dim">Categoría</span>
                <select
                  value={g.categoria}
                  onChange={(e) => set(i, 'categoria', e.target.value)}
                  className={claseCampo}
                >
                  {categorias.length === 0 && <option value="">Sin categorías</option>}
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id} className="bg-night">
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-bone-dim">
                    Piezas de esta promo
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={g.piezas_asignadas}
                    onChange={(e) => set(i, 'piezas_asignadas', Number(e.target.value))}
                    className={claseCampo}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-bone-dim">Piezas por sabor</span>
                  <input
                    type="number"
                    min={1}
                    value={g.piezas_por_sabor}
                    onChange={(e) => set(i, 'piezas_por_sabor', Number(e.target.value))}
                    className={claseCampo}
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => quitar(i)}
              className="flex-none rounded-lg border border-white/15 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
              aria-label="Quitar grupo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-3 text-[12px] text-sugu">
            → el cliente elige exactamente {cantidadSabores(g)} sabor
            {cantidadSabores(g) === 1 ? '' : 'es'} de {categorias.find((c) => c.id === g.categoria)?.nombre ?? g.categoria}
          </p>
        </div>
      ))}

      <button
        type="button"
        onClick={anadir}
        disabled={categorias.length === 0}
        className="inline-flex items-center gap-1.5 text-[12px] text-sugu disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Añadir grupo de sabores
      </button>
    </div>
  );
}
