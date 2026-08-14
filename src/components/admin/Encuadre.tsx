'use client';

/**
 * Selector de encuadre con vista previa.
 *
 * Una foto 1920×1080 metida en una pantalla vertical de móvil se recorta
 * muchísimo, y por defecto el navegador conserva el centro — que casi nunca
 * es donde está el plato. Aquí se elige qué zona sobrevive al recorte.
 *
 * La previsualización usa EXACTAMENTE la misma proporción que la web real, así
 * que lo que se ve aquí es lo que va a salir publicado.
 */

/** Las nueve anclas típicas, en el formato que entiende `object-position`. */
const ANCLAS = [
  ['0% 0%', '50% 0%', '100% 0%'],
  ['0% 50%', '50% 50%', '100% 50%'],
  ['0% 100%', '50% 100%', '100% 100%'],
];

export function Encuadre({
  imagen,
  valor,
  aspecto,
  etiqueta,
  alCambiar,
}: {
  imagen: string;
  valor: string;
  /** proporción de la vista previa, p. ej. '16 / 9' */
  aspecto: string;
  etiqueta: string;
  alCambiar: (foco: string) => void;
}) {
  if (!imagen) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-night p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-bone-dim">
        {etiqueta}
      </p>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative flex-1 overflow-hidden rounded-lg border border-white/10 bg-night-3"
          style={{ aspectRatio: aspecto, minWidth: 180 }}
        >
          {/* img nativa y no next/image: aquí interesa ver el recorte crudo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagen}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: valor }}
          />
        </div>

        <div className="flex-none">
          <p className="mb-2 text-[11px] text-bone-dim">Zona que se conserva</p>
          <div className="grid grid-cols-3 gap-1.5">
            {ANCLAS.flat().map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => alCambiar(a)}
                aria-pressed={valor === a}
                aria-label={`Encuadrar en ${a}`}
                className={`h-8 w-8 rounded-md border transition-colors ${
                  valor === a
                    ? 'border-sugu bg-sugu'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
