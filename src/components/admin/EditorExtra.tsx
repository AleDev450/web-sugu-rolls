'use client';

import { Plus, Trash2 } from 'lucide-react';
import { claseCampo } from './ui';

/**
 * Editor de los datos propios de cada sección (`extra`).
 *
 * Cada clave se dibuja según su forma, sin que el editor tenga que conocer las
 * secciones: un texto suelto es un input, una lista de textos son líneas con
 * botón de borrar, y una lista de objetos (estadísticas, tarjetas) muestra un
 * campo por propiedad. Así una sección nueva no obliga a tocar este archivo.
 */

/** Convierte `boton_principal` en «Boton principal» para la etiqueta. */
function legible(clave: string): string {
  const t = clave.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function EditorExtra({
  extra,
  alCambiar,
  excluir,
}: {
  extra: Record<string, unknown>;
  alCambiar: (e: Record<string, unknown>) => void;
  /** claves que ya tienen su propio campo especial fuera de aquí (p. ej. una galería) */
  excluir?: string[];
}) {
  const claves = Object.keys(extra ?? {}).filter((c) => !excluir?.includes(c));
  if (claves.length === 0) return null;

  const set = (clave: string, valor: unknown) => alCambiar({ ...extra, [clave]: valor });

  return (
    <fieldset className="rounded-2xl border border-white/10 p-5">
      <legend className="px-2 text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
        Contenido de esta sección
      </legend>

      <div className="space-y-6">
        {claves.map((clave) => {
          const valor = extra[clave];

          // texto suelto
          if (typeof valor === 'string') {
            return (
              <label key={clave} className="block">
                <span className="mb-2 block text-[13px] font-medium">{legible(clave)}</span>
                <input
                  value={valor}
                  onChange={(e) => set(clave, e.target.value)}
                  className={claseCampo}
                />
              </label>
            );
          }

          if (!Array.isArray(valor)) return null;

          // lista de textos
          if (valor.every((v) => typeof v === 'string')) {
            const items = valor as string[];
            return (
              <div key={clave}>
                <span className="mb-2 block text-[13px] font-medium">{legible(clave)}</span>
                <div className="space-y-2">
                  {items.map((linea, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={linea}
                        onChange={(e) => {
                          const copia = [...items];
                          copia[i] = e.target.value;
                          set(clave, copia);
                        }}
                        className={claseCampo}
                      />
                      <button
                        type="button"
                        onClick={() => set(clave, items.filter((_, j) => j !== i))}
                        className="flex-none rounded-lg border border-white/15 px-3 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => set(clave, [...items, ''])}
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-sugu"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir
                </button>
              </div>
            );
          }

          // lista de objetos
          const objetos = valor as Record<string, string>[];
          const campos = Object.keys(objetos[0] ?? {});

          return (
            <div key={clave}>
              <span className="mb-2 block text-[13px] font-medium">{legible(clave)}</span>
              <div className="space-y-3">
                {objetos.map((obj, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-night/40 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-3 pb-2.5">
                      <span className="text-[11px] uppercase tracking-widest text-white/35">
                        #{i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => set(clave, objetos.filter((_, j) => j !== i))}
                        className="text-bone-dim transition-colors hover:text-sugu"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {campos.map((campo) => (
                        <label key={campo} className="block">
                          <span className="mb-1 block text-[11px] text-bone-dim">
                            {legible(campo)}
                          </span>
                          <input
                            value={obj[campo] ?? ''}
                            onChange={(e) => {
                              const copia = objetos.map((o, j) =>
                                j === i ? { ...o, [campo]: e.target.value } : o
                              );
                              set(clave, copia);
                            }}
                            className={claseCampo}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  set(clave, [
                    ...objetos,
                    Object.fromEntries(campos.map((c) => [c, ''])) as Record<string, string>,
                  ])
                }
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-sugu"
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir
              </button>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
