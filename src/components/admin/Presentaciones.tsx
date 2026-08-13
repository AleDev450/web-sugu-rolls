'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { Presentacion } from '@/data/productos';

/**
 * Editor de presentaciones: cantidades a la venta con su precio.
 *
 * No hay nada fijo en "5" ni en "10" — se añaden las filas que hagan falta y
 * con las cantidades que sean. Sin ninguna fila, el producto se vende a
 * precio único y usa el campo Precio de arriba, que es como funcionaba antes.
 */
export function Presentaciones({
  valor,
  precioBase,
  alCambiar,
}: {
  valor: Presentacion[];
  precioBase: number;
  alCambiar: (p: Presentacion[]) => void;
}) {
  const cambiar = (i: number, campo: keyof Presentacion, n: number) =>
    alCambiar(valor.map((p, j) => (i === j ? { ...p, [campo]: n } : p)));

  const añadir = () => {
    // se propone el doble de piezas de la última fila: la progresión habitual
    const ultima = valor[valor.length - 1];
    alCambiar([
      ...valor,
      ultima
        ? { piezas: ultima.piezas * 2, precio: Math.round(ultima.precio * 1.8 * 10) / 10 }
        : { piezas: 5, precio: precioBase || 0 },
    ]);
  };

  const campo =
    'w-full rounded-lg border border-white/10 bg-night px-3 py-2 text-sm outline-none transition-colors focus:border-sugu';

  return (
    <div className="space-y-3">
      {valor.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-night px-4 py-3 text-[12px] leading-relaxed text-bone-dim">
          Sin presentaciones: se vende a precio único con el importe de arriba. Añade filas si
          este producto va por 5, por 10 o las cantidades que uses.
        </p>
      ) : (
        <ul className="space-y-2">
          {valor.map((p, i) => (
            <li key={i} className="flex items-end gap-3">
              <label className="flex-1">
                <span className="mb-1.5 block text-[11px] text-bone-dim">Piezas</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={p.piezas}
                  onChange={(e) => cambiar(i, 'piezas', Math.max(1, Number(e.target.value)))}
                  className={campo}
                />
              </label>
              <label className="flex-1">
                <span className="mb-1.5 block text-[11px] text-bone-dim">Precio (S/)</span>
                <input
                  type="number"
                  min={0}
                  step="0.10"
                  value={p.precio}
                  onChange={(e) => cambiar(i, 'precio', Math.max(0, Number(e.target.value)))}
                  className={campo}
                />
              </label>
              <button
                type="button"
                onClick={() => alCambiar(valor.filter((_, j) => j !== i))}
                className="mb-1 rounded-lg border border-white/10 p-2.5 text-bone-dim transition-colors hover:border-sugu/50 hover:text-sugu"
                aria-label={`Quitar la presentación de ${p.piezas} piezas`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={añadir}
        className="inline-flex items-center gap-2 text-[13px] text-sugu transition-opacity hover:opacity-80"
      >
        <Plus className="h-3.5 w-3.5" />
        Añadir presentación
      </button>

      {valor.length > 0 && (
        <p className="text-[11px] leading-relaxed text-white/40">
          En la carta se muestran como botones ({valor.map((p) => `${p.piezas} u.`).join(', ')}) y
          el precio cambia al elegir. Se ordenan de menor a mayor solas.
        </p>
      )}
    </div>
  );
}
