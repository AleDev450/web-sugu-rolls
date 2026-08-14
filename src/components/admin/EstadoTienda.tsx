'use client';

import { useEffect, useState } from 'react';
import { Clock, Store } from 'lucide-react';
import { guardarAjustes, traerAjustesAdmin } from '@/lib/admin';
import { Campo, claseCampo } from './ui';

type Modo = 'auto' | 'abierta' | 'cerrada';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const MODOS: { id: Modo; titulo: string; bajada: string }[] = [
  { id: 'auto', titulo: 'Por horario', bajada: 'Abre y cierra sola según las horas de abajo.' },
  { id: 'abierta', titulo: 'Abierta ahora', bajada: 'Acepta pedidos aunque sea fuera de hora.' },
  { id: 'cerrada', titulo: 'Cerrada ahora', bajada: 'No acepta pedidos aunque esté en horario.' },
];

/**
 * Estado de la tienda: si se aceptan pedidos o no.
 *
 * El modo manual MANDA sobre el horario, que es lo que se pidió: si un día se
 * decide atender más rato, se pulsa "Abierta ahora" y funciona sin tocar las
 * horas. Volver a "Por horario" devuelve el control al calendario.
 *
 * La comprobación real la hace la base (`tienda_abierta()`), no el navegador:
 * alguien con el reloj del sistema cambiado podría pedir de madrugada.
 */
export function EstadoTienda({
  alAvisar,
}: {
  alAvisar: (a: { tipo: 'ok' | 'error'; texto: string }) => void;
}) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [apertura, setApertura] = useState('12:00');
  const [cierre, setCierre] = useState('22:00');
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const f = (await traerAjustesAdmin()) as Record<string, unknown>;
        setModo(((f.tienda_modo as Modo) ?? 'auto') as Modo);
        setApertura(String(f.hora_apertura ?? '12:00').slice(0, 5));
        setCierre(String(f.hora_cierre ?? '22:00').slice(0, 5));
        setDias((f.dias_atencion as number[]) ?? [0, 1, 2, 3, 4, 5, 6]);
        setAviso(String(f.aviso_cerrado ?? ''));
      } catch {
        setModo('auto');
      }
    })();
  }, []);

  if (modo === null) return null;

  const guardar = async (parche: Record<string, unknown>) => {
    setGuardando(true);
    try {
      await guardarAjustes(parche as Record<string, string>);
      alAvisar({ tipo: 'ok', texto: 'Estado de la tienda actualizado.' });
    } catch (e) {
      alAvisar({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarModo = (m: Modo) => {
    setModo(m);
    void guardar({ tienda_modo: m });
  };

  const alternarDia = (d: number) => {
    const siguiente = dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort();
    setDias(siguiente);
    void guardar({ dias_atencion: siguiente });
  };

  return (
    <section className="card mb-6 p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-sugu/10">
          <Store className="h-5 w-5 text-sugu" />
        </span>
        <div>
          <h2 className="font-bold">Estado de la tienda</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-bone-dim">
            Decide si la web acepta pedidos. Los modos manuales mandan sobre el horario, así que
            puedes abrir un rato más sin tocar las horas.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {MODOS.map((m) => (
          <button
            key={m.id}
            onClick={() => cambiarModo(m.id)}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              modo === m.id
                ? m.id === 'cerrada'
                  ? 'border-sugu bg-sugu/10'
                  : 'border-emerald-500/60 bg-emerald-600/10'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            <p className="font-bold">{m.titulo}</p>
            <p className="mt-1 text-[12px] leading-snug text-bone-dim">{m.bajada}</p>
          </button>
        ))}
      </div>

      <div
        className={`mt-6 border-t border-white/10 pt-6 transition-opacity ${
          modo === 'auto' ? '' : 'opacity-45'
        }`}
      >
        <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-bone-dim">
          <Clock className="h-3.5 w-3.5" />
          Horario de atención
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Abre a las">
            <input
              type="time"
              value={apertura}
              onChange={(e) => setApertura(e.target.value)}
              onBlur={() => void guardar({ hora_apertura: apertura })}
              className={`${claseCampo} [color-scheme:dark]`}
            />
          </Campo>
          <Campo etiqueta="Cierra a las">
            <input
              type="time"
              value={cierre}
              onChange={(e) => setCierre(e.target.value)}
              onBlur={() => void guardar({ hora_cierre: cierre })}
              className={`${claseCampo} [color-scheme:dark]`}
            />
          </Campo>
        </div>

        <p className="mb-2 mt-5 block text-[13px] font-medium">Días que se atiende</p>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((nombre, d) => (
            <button
              key={d}
              onClick={() => alternarDia(d)}
              aria-pressed={dias.includes(d)}
              className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                dias.includes(d)
                  ? 'bg-sugu text-white'
                  : 'bg-white/5 text-bone-dim hover:bg-white/10'
              }`}
            >
              {nombre}
            </button>
          ))}
        </div>

        <Campo etiqueta="Aviso cuando está cerrada" ancho="completo">
          <input
            value={aviso}
            onChange={(e) => setAviso(e.target.value)}
            onBlur={() => void guardar({ aviso_cerrado: aviso })}
            className={`${claseCampo} mt-4`}
            placeholder="Estamos cerrados en este momento…"
          />
        </Campo>

        {modo !== 'auto' && (
          <p className="mt-4 text-[12px] text-amber-400">
            El horario está en pausa: manda el modo «{MODOS.find((m) => m.id === modo)?.titulo}».
          </p>
        )}
        {guardando && <p className="mt-2 text-[12px] text-white/40">Guardando…</p>}
      </div>
    </section>
  );
}
