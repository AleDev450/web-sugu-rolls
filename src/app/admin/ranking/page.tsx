'use client';

import { useEffect, useState } from 'react';
import { Download, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import {
  borrarPartida,
  editarPuntaje,
  listarPartidas,
  resetearRanking,
  type PartidaAdmin,
} from '@/lib/admin';
import {
  Aviso,
  Cargando,
  ConfirmarPeligro,
  Encabezado,
  Interruptor,
  Modal,
  claseCampo,
} from '@/components/admin/ui';

/** Medallas de los tres primeros puestos. */
const PODIO = ['🥇', '🥈', '🥉'];

/** Una línea del resumen de la partida en el modal de revisión. */
function Dato({
  etiqueta,
  valor,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-white/35">{etiqueta}</dt>
      <dd className={`mt-1 text-[14px] ${alerta ? 'font-bold text-sugu' : ''}`}>{valor}</dd>
    </div>
  );
}

/**
 * Puntos por minuto de partida.
 *
 * Es el detector de trampas a ojo: el juego da del orden de decenas de puntos
 * por segundo incluso jugando muy bien, así que un ritmo desorbitado delata
 * un puntaje inventado aunque haya pasado el techo del servidor.
 */
function ritmo(p: PartidaAdmin): number | null {
  if (p.score === null || !p.finished_at) return null;
  const ms = new Date(p.finished_at).getTime() - new Date(p.started_at).getTime();
  if (ms <= 0) return null;
  return Math.round(p.score / (ms / 60000));
}

/** A partir de aquí conviene mirar la partida con lupa. */
const RITMO_SOSPECHOSO = 9000;

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

  // partida abierta para revisar, y la que está esperando confirmación de borrado
  const [revisar, setRevisar] = useState<PartidaAdmin | null>(null);
  const [nuevoPuntaje, setNuevoPuntaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<PartidaAdmin | null>(null);
  const [borrando, setBorrando] = useState(false);

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

  const abrirRevision = (p: PartidaAdmin) => {
    setRevisar(p);
    setNuevoPuntaje(p.score === null ? '' : String(p.score));
  };

  const guardarPuntaje = async () => {
    if (!revisar) return;
    const valor = Number(nuevoPuntaje);
    if (!Number.isFinite(valor) || valor < 0) {
      setAviso({ tipo: 'error', texto: 'Escribe un puntaje válido.' });
      return;
    }
    setGuardando(true);
    try {
      await editarPuntaje(revisar.id, Math.round(valor));
      setAviso({
        tipo: 'ok',
        texto: `Puntaje de ${revisar.nickname ?? 'la partida'} corregido a ${Math.round(valor).toLocaleString('es')}.`,
      });
      setRevisar(null);
      void cargar(soloTerminadas);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await borrarPartida(aBorrar.id);
      setAviso({
        tipo: 'ok',
        texto: `Partida de ${aBorrar.nickname ?? 'jugador anónimo'} eliminada del ranking.`,
      });
      setABorrar(null);
      void cargar(soloTerminadas);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setBorrando(false);
    }
  };

  const descargar = () => {
    if (!items?.length) return;
    const csv = [
      'puesto,nickname,nombre,telefono,puntaje,ritmo_por_minuto,codigo,codigo_creado,jugada',
      ...items.map((p, i) =>
        [
          i + 1,
          p.nickname ?? '',
          p.full_name ?? '',
          p.phone ?? '',
          p.score ?? '',
          ritmo(p) ?? '',
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
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="border-b border-white/10 bg-night-soft">
              <tr className="text-[11px] uppercase tracking-widest text-bone-dim">
                <th className="p-4">#</th>
                <th className="p-4">Nickname</th>
                <th className="p-4">Nombre</th>
                <th className="p-4">Teléfono</th>
                <th className="p-4 text-right">Puntaje</th>
                <th className="p-4 text-right">Ritmo</th>
                <th className="p-4">Código</th>
                <th className="p-4">Código creado</th>
                <th className="p-4">Jugada</th>
                <th className="p-4 text-right">Acciones</th>
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
                  <td className="p-4 text-right tabular-nums">
                    {(() => {
                      const r = ritmo(p);
                      if (r === null) return <span className="text-bone-dim">—</span>;
                      const alto = r > RITMO_SOSPECHOSO;
                      return (
                        <span
                          className={alto ? 'font-bold text-sugu' : 'text-bone-dim'}
                          title={alto ? 'Ritmo inusual: revisa esta partida' : undefined}
                        >
                          {r.toLocaleString('es')} p/min
                        </span>
                      );
                    })()}
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
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirRevision(p)}
                        className="rounded-lg border border-white/15 p-2 transition-colors hover:border-white/40"
                        aria-label={`Revisar la partida de ${p.nickname ?? 'jugador anónimo'}`}
                        title="Revisar y corregir el puntaje"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setABorrar(p)}
                        className="rounded-lg border border-white/15 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                        aria-label={`Eliminar la partida de ${p.nickname ?? 'jugador anónimo'}`}
                        title="Eliminar del ranking"
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
              Aún no hay partidas registradas.
            </p>
          )}
        </div>
      )}

      {/*
        Revisión de UNA partida. El puntaje se corrige aquí en vez de tener que
        resetear el ranking entero, que era la única salida y se llevaba por
        delante también las partidas buenas.
      */}
      <Modal
        abierto={revisar !== null}
        titulo="Revisar partida"
        alCerrar={() => setRevisar(null)}
      >
        {revisar && (
          <div className="space-y-6 text-sm">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Dato etiqueta="Nickname" valor={revisar.nickname ?? '—'} />
              <Dato etiqueta="Nombre" valor={revisar.full_name ?? '—'} />
              <Dato etiqueta="Teléfono" valor={revisar.phone ?? '—'} />
              <Dato etiqueta="Código" valor={revisar.codigo ?? '—'} />
              <Dato etiqueta="Jugada" valor={fecha(revisar.finished_at ?? revisar.started_at)} />
              <Dato
                etiqueta="Ritmo"
                valor={
                  ritmo(revisar) === null
                    ? '—'
                    : `${ritmo(revisar)!.toLocaleString('es')} p/min`
                }
                alerta={(ritmo(revisar) ?? 0) > RITMO_SOSPECHOSO}
              />
            </dl>

            <label className="block border-t border-white/10 pt-5">
              <span className="mb-2 block text-[13px] font-medium">Puntaje</span>
              <input
                type="number"
                min={0}
                max={10000000}
                value={nuevoPuntaje}
                onChange={(e) => setNuevoPuntaje(e.target.value)}
                className={`${claseCampo} font-mono tabular-nums`}
              />
              <span className="mt-1.5 block text-[11px] text-white/40">
                Se guarda tal cual lo escribas. La fecha de la partida no cambia, así que el
                ritmo por minuto se recalcula solo con el nuevo valor.
              </span>
            </label>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                onClick={() => {
                  setABorrar(revisar);
                  setRevisar(null);
                }}
                className="btn-ghost !text-sugu"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar del ranking
              </button>

              <div className="flex gap-3">
                <button onClick={() => setRevisar(null)} className="btn-ghost">
                  Cancelar
                </button>
                <button
                  onClick={() => void guardarPuntaje()}
                  disabled={guardando}
                  className="btn-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  {guardando ? 'Guardando…' : 'Guardar puntaje'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmarPeligro
        abierto={aBorrar !== null}
        titulo="Eliminar partida"
        textoBoton="Eliminar partida"
        trabajando={borrando}
        alCerrar={() => setABorrar(null)}
        alConfirmar={eliminar}
        descripcion={
          <>
            <p>
              Se borra la partida de{' '}
              <b>{aBorrar?.nickname ?? 'jugador anónimo'}</b>
              {aBorrar?.score != null && (
                <>
                  {' '}
                  con <b>{aBorrar.score.toLocaleString('es')}</b> puntos
                </>
              )}
              . Desaparece de aquí y del ranking que ven los jugadores.
            </p>
            <p className="mt-3">
              El código <b>{aBorrar?.codigo ?? '—'}</b> sigue marcado como usado: nadie podrá
              volver a jugar con él. Si además quieres liberarlo, bórralo desde{' '}
              <b>Códigos del juego</b>.
            </p>
            <p className="mt-3">Esto no se puede deshacer.</p>
          </>
        }
      />

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
