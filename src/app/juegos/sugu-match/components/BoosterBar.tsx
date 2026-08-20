'use client';

import { BOOSTERS, ORDEN_BOOSTERS } from '../game/config/boosters';
import { dentro, INTERFAZ, laminaCss } from '../game/render/interfaz';
import type { FrameId } from '../game/render/sprites';
import type { BoosterId } from '../game/types';
import { useSuguMatchStore } from '../store/useSuguMatchStore';
import { SpriteImg } from './SpriteImg';

/**
 * La barra de habilidades.
 *
 * La lámina `interface.png` trae siete huecos pintados y hay exactamente
 * siete boosters, así que cada uno cae en el suyo. Si algún día se añade un
 * booster más, la barra se queda sin hueco y hay que redibujar la lámina: por
 * eso se recorre `INTERFAZ.slots` y no `ORDEN_BOOSTERS`, para que un booster
 * de más no se salga del marco sin que nadie se entere.
 *
 * El contador sale del store y no del catálogo: hoy lo llena
 * `INVENTARIO_INICIAL`, y el día que los boosters pertenezcan al usuario
 * bastará con rellenar ese mismo campo desde Supabase al entrar a la partida.
 * Ni este componente ni el motor se enteran de dónde vienen los números.
 */
export function BoosterBar({ onUsar }: { onUsar: (id: BoosterId) => void }) {
  const boosters = useSuguMatchStore((s) => s.boosters);
  const activo = useSuguMatchStore((s) => s.boosterActivo);
  const status = useSuguMatchStore((s) => s.status);
  const jugando = status === 'playing';

  return (
    <div className="match-boosters" style={laminaCss(INTERFAZ)}>
      {INTERFAZ.slots.map((slot, i) => {
        const id = ORDEN_BOOSTERS[i];
        if (!id) return null;

        const def = BOOSTERS[id];
        const n = boosters[id] ?? 0;
        const vacio = n <= 0;

        return (
          <button
            key={id}
            type="button"
            style={dentro(INTERFAZ, slot)}
            className={`match-booster${activo === id ? ' es-activo' : ''}${vacio ? ' es-vacio' : ''}`}
            onClick={() => onUsar(id)}
            disabled={vacio || !jugando}
            title={`${def.nombre} — ${def.descripcion}`}
            aria-label={`${def.nombre}: ${def.descripcion}. Quedan ${n}`}
          >
            <SpriteImg frame={def.frame as FrameId} fallback={def.emoji} className="match-booster__icono" />
            <span className="match-booster__n">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Cartelito que explica qué espera el booster que acabas de pulsar. */
export function BoosterPista() {
  const activo = useSuguMatchStore((s) => s.boosterActivo);
  if (!activo) return null;

  const def = BOOSTERS[activo];
  const texto =
    def.target === 'swap' ? 'Toca dos piezas vecinas' : 'Toca una pieza del tablero';

  return (
    <p className="match-booster-pista">
      <strong>{def.nombre}</strong> — {texto}
    </p>
  );
}
