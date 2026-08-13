'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { GrupoOpciones } from '@/data/productos';

/**
 * Editor de grupos de personalización (base, toppings, proteína, salsas…).
 *
 * Cada grupo lleva su regla de cuántas opciones se pueden marcar. Las
 * opciones se escriben una por línea, que es la forma más rápida de cargar
 * once toppings sin pelearse con una interfaz de filas.
 */
export function GruposOpciones({
  valor,
  alCambiar,
}: {
  valor: GrupoOpciones[];
  alCambiar: (g: GrupoOpciones[]) => void;
}) {
  const cambiar = (i: number, parche: Partial<GrupoOpciones>) =>
    alCambiar(valor.map((g, j) => (i === j ? { ...g, ...parche } : g)));

  const campo =
    'w-full rounded-lg border border-white/10 bg-night px-3 py-2 text-sm outline-none transition-colors focus:border-sugu';

  return (
    <div className="space-y-4">
      {valor.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-night px-4 py-3 text-[12px] leading-relaxed text-bone-dim">
          Sin grupos: el producto se añade al carrito de un clic. Añade grupos si hay que armarlo
          (base, toppings, proteína…).
        </p>
      )}

      {valor.map((g, i) => (
        <fieldset key={i} className="rounded-xl border border-white/10 bg-night p-4">
          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="mb-1.5 block text-[11px] text-bone-dim">Título del grupo</span>
              <input
                value={g.titulo}
                onChange={(e) => cambiar(i, { titulo: e.target.value })}
                placeholder="Elige tus Toppings"
                className={campo}
              />
            </label>
            <button
              type="button"
              onClick={() => alCambiar(valor.filter((_, j) => j !== i))}
              className="mb-1 rounded-lg border border-white/10 p-2.5 text-bone-dim transition-colors hover:border-sugu/50 hover:text-sugu"
              aria-label={`Quitar el grupo ${g.titulo || i + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[11px] text-bone-dim">
                Mínimo (0 = opcional)
              </span>
              <input
                type="number"
                min={0}
                value={g.min}
                onChange={(e) => cambiar(i, { min: Math.max(0, Number(e.target.value)) })}
                className={campo}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-[11px] text-bone-dim">Máximo</span>
              <input
                type="number"
                min={1}
                value={g.max}
                onChange={(e) => cambiar(i, { max: Math.max(1, Number(e.target.value)) })}
                className={campo}
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[11px] text-bone-dim">
              Opciones — una por línea
            </span>
            {/*
              Al escribir NO se limpia nada. Antes se hacía `.trim().filter()`
              en cada tecla, y eso impedía escribir: al pulsar Enter la línea
              nueva estaba vacía, se borraba en el acto y el cursor saltaba
              arriba; tampoco se podían teclear espacios. Se limpia al guardar,
              en el formulario del producto.
            */}
            <textarea
              value={g.opciones.join('\n')}
              onChange={(e) => cambiar(i, { opciones: e.target.value.split('\n') })}
              rows={Math.min(14, Math.max(4, g.opciones.length + 1))}
              placeholder={'Palta\nChoclo\nMango'}
              className={`${campo} font-mono text-[12px] leading-relaxed`}
            />
          </label>

          <p className="mt-2 text-[11px] text-white/40">
            {g.opciones.length} opciones ·{' '}
            {g.min > 0 ? `obligatorio, mínimo ${g.min}` : 'opcional'} · máximo {g.max}
            {g.max > g.opciones.length && g.opciones.length > 0 && (
              <span className="text-amber-400">
                {' '}
                · el máximo supera las opciones que hay
              </span>
            )}
          </p>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() => alCambiar([...valor, { titulo: '', min: 1, max: 1, opciones: [] }])}
        className="inline-flex items-center gap-2 text-[13px] text-sugu transition-opacity hover:opacity-80"
      >
        <Plus className="h-3.5 w-3.5" />
        Añadir grupo
      </button>
    </div>
  );
}
