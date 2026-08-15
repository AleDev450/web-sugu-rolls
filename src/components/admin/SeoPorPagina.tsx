'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { guardarSeoPagina, listarSeoPaginas, type PaginaSeoAdmin } from '@/lib/admin';
import { Campo, claseCampo, Modal } from './ui';

const RUTAS: { ruta: string; nombre: string }[] = [
  { ruta: '/', nombre: 'Portada' },
  { ruta: '/carta', nombre: 'Nuestra Carta' },
  { ruta: '/promociones', nombre: 'Promociones' },
  { ruta: '/catering', nombre: 'Catering' },
  { ruta: '/sugu-games', nombre: 'Sugu Games' },
  { ruta: '/nosotros', nombre: 'Nosotros' },
  { ruta: '/contacto', nombre: 'Contacto' },
];

/**
 * SEO individual por página: título y descripción propios para una ruta
 * puntual, por si alguna necesita algo distinto de lo que ya trae escrito
 * en su `page.tsx`.
 *
 * Vacío en los dos campos = esa página sigue usando lo del código, así que
 * no hace falta llenar las siete para que el sitio funcione.
 */
export function SeoPorPagina({
  alAvisar,
}: {
  alAvisar: (a: { tipo: 'ok' | 'error'; texto: string }) => void;
}) {
  const [porRuta, setPorRuta] = useState<Record<string, PaginaSeoAdmin>>({});
  const [edicion, setEdicion] = useState<PaginaSeoAdmin | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void listarSeoPaginas()
      .then((filas) => {
        const mapa: Record<string, PaginaSeoAdmin> = {};
        for (const f of filas) mapa[f.ruta] = f;
        setPorRuta(mapa);
      })
      .catch(() => {
        // sin fila para ninguna ruta: todas siguen usando lo del código
      });
  }, []);

  const enviar = async () => {
    if (!edicion) return;
    setGuardando(true);
    try {
      await guardarSeoPagina(edicion);
      setPorRuta((prev) => ({ ...prev, [edicion.ruta]: edicion }));
      setEdicion(null);
      alAvisar({ tipo: 'ok', texto: `SEO de "${edicion.ruta}" guardado.` });
    } catch (e) {
      alAvisar({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="card p-8">
      <h2 className="font-bold">SEO por página</h2>
      <p className="mt-1 text-[13px] text-bone-dim">
        Título y descripción propios para una página puntual. Vacío = esa página sigue usando lo
        que ya trae escrito.
      </p>

      <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
        {RUTAS.map(({ ruta, nombre }) => {
          const propio = porRuta[ruta];
          const personalizada = Boolean(propio?.titulo || propio?.descripcion);
          return (
            <div key={ruta} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{nombre}</p>
                <p className="truncate font-mono text-[11px] text-bone-dim">{ruta}</p>
              </div>
              <div className="flex flex-none items-center gap-3">
                {personalizada && (
                  <span className="rounded-full bg-sugu/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sugu">
                    Personalizado
                  </span>
                )}
                <button
                  onClick={() =>
                    setEdicion(propio ?? { ruta, titulo: '', descripcion: '' })
                  }
                  className="rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                  aria-label={`Editar SEO de ${nombre}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        abierto={edicion !== null}
        titulo={`SEO de ${RUTAS.find((r) => r.ruta === edicion?.ruta)?.nombre ?? ''}`}
        alCerrar={() => setEdicion(null)}
      >
        {edicion && (
          <div className="grid gap-5">
            <Campo etiqueta="Título propio" ancho="completo">
              <input
                value={edicion.titulo}
                onChange={(e) => setEdicion({ ...edicion, titulo: e.target.value })}
                className={claseCampo}
                placeholder="Vacío = usa el título que ya trae la página"
                maxLength={70}
              />
            </Campo>
            <Campo etiqueta="Descripción propia" ancho="completo">
              <textarea
                rows={3}
                value={edicion.descripcion}
                onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
                className={claseCampo}
                placeholder="Vacío = usa la descripción que ya trae la página"
                maxLength={160}
              />
            </Campo>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEdicion(null)} className="btn-ghost">
                Cancelar
              </button>
              <button type="button" onClick={() => void enviar()} disabled={guardando} className="btn-primary">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
