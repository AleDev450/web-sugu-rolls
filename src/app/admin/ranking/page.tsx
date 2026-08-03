'use client';

import { useEffect, useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { listarPartidas, resetearRanking, type PartidaAdmin } from '@/lib/admin';
import {
  Aviso,
  Cargando,
  ConfirmarPeligro,
  Encabezado,
  Interruptor,
} from '@/components/admin/ui';

/** Medallas de los tres primeros puestos. */
const PODIO = ['🥇', '🥈', '🥉'];

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Ranking de partidas. A diferencia del que ve el jugador (solo nickname y
 * puntaje), aquí salen los datos de contacto para poder entregar el premio.
 */
export default function RankingAdmin() {
  const [items, setItems] = useState<PartidaAdmin[] | null>(null);
  const [soloTerminadas, setSoloTerminadas] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [reseteando, setReseteando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async (terminadas: boolean) => {
    setItems(null);
    try {
      setItems(await listarPartidas(terminadas));
      setAviso(null);
    } catch (e) {
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar(soloTerminadas);
  }, [soloTerminadas]);

  const resetear = async () => {
    setReseteando(true);
    try {
      const n = await resetearRanking();
      setAviso({ tipo: 'ok', texto: `Ranking a cero: se borraron ${n} partidas.` });
      void cargar(soloTerminadas);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setReseteando(false);
      setConfirmar(false);
    }
  };

  const descargar = () => {
    if (!items?.length) return;
    const csv = [
      'puesto,nickname,nombre,telefono,puntaje,codigo,codigo_creado,jugada',
      ...items.map((p, i) =>
        [
          i + 1,
          p.nickname ?? '',
          p.full_name ?? '',
          p.phone ?? '',
          p.score ?? '',
          p.codigo ?? '',
          p.codigo_creado ?? '',
          p.finished_at ?? '',
        ]
          // el nombre puede traer comas: se entrecomilla todo
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranking-sugu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Encabezado
        titulo="Ranking del juego"
        bajada={
          items
            ? `${items.length} partidas${soloTerminadas ? ' registradas' : ' (incluye las no terminadas)'}. Ordenadas de mayor a menor puntaje.`
            : 'Cargando partidas…'
        }
        accion={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setConfirmar(true)}
              className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
              disabled={!items?.length}
            >
              <Trash2 className="h-4 w-4" />
              Resetear ranking
            </button>
            <button onClick={() => void cargar(soloTerminadas)} className="btn-ghost">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
            <button
              onClick={descargar}
              className="btn-primary disabled:pointer-events-none disabled:opacity-40"
              disabled={!items?.length}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="mb-5">
        <Interruptor
          activo={soloTerminadas}
          alCambiar={setSoloTerminadas}
          etiqueta="Solo partidas con puntaje registrado"
        />
      </div>

      {!items ? (
        <Cargando />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 bg-night-soft">
              <tr className="text-[11px] uppercase tracking-widest text-bone-dim">
                <th className="p-4">#</th>
                <th className="p-4">Nickname</th>
                <th className="p-4">Nombre</th>
                <th className="p-4">Teléfono</th>
                <th className="p-4 text-right">Puntaje</th>
                <th className="p-4">Código</th>
                <th className="p-4">Código creado</th>
                <th className="p-4">Jugada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.map((p, i) => (
                <tr key={p.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="p-4 font-bold text-bone-dim">{PODIO[i] ?? i + 1}</td>
                  <td className="p-4 font-semibold">{p.nickname ?? '—'}</td>
                  <td className="p-4 text-bone-dim">{p.full_name ?? '—'}</td>
                  <td className="p-4 text-bone-dim">
                    {p.phone ? (
                      <a href={`tel:${p.phone}`} className="transition-colors hover:text-sugu">
                        {p.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-4 text-right font-mono font-bold tabular-nums">
                    {p.score === null ? (
                      <span className="text-[11px] font-normal uppercase text-bone-dim">
                        Sin terminar
                      </span>
                    ) : (
                      p.score.toLocaleString('es')
                    )}
                  </td>
                  <td className="p-4">
                    <span className="font-mono tracking-widest">{p.codigo ?? '—'}</span>
                    {p.codigo_etiqueta && (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-bone-dim">
                        {p.codigo_etiqueta}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-bone-dim">{fecha(p.codigo_creado)}</td>
                  <td className="p-4 text-bone-dim">{fecha(p.finished_at ?? p.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && (
            <p className="p-16 text-center text-sm text-bone-dim">
              Aún no hay partidas registradas.
            </p>
          )}
        </div>
      )}

      <ConfirmarPeligro
        abierto={confirmar}
        titulo="Resetear ranking"
        textoBoton="Resetear ranking"
        trabajando={reseteando}
        alCerrar={() => setConfirmar(false)}
        alConfirmar={resetear}
        descripcion={
          <>
            <p>
              Se borran <b>todas las partidas jugadas</b> y la tabla queda a cero, tanto aquí
              como en el ranking que ven los jugadores. También se limpia la bitácora de
              intentos de canje.
            </p>
            <p className="mt-3">
              Los códigos <b>no se tocan</b>: los que ya se canjearon siguen marcados como
              usados, para que nadie vuelva a jugar con un código gastado.
            </p>
            <p className="mt-3">Esto no se puede deshacer.</p>
          </>
        }
      />
    </>
  );
}
