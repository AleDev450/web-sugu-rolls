'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { TILES, tileEmoji, tileNombre } from '../game/config/tiles';
import type { ObjectiveState } from '../game/types';
import {
  dentro,
  ESTRELLAS,
  laminaCss,
  LOGO,
  MOVIMIENTOS,
  OBJETIVOS,
  PAUSA,
  PUNTUACION,
  recorteCss,
} from '../game/render/interfaz';
import type { FrameId } from '../game/render/sprites';
import { useSuguMatchStore } from '../store/useSuguMatchStore';
import { SpriteImg } from './SpriteImg';

/**
 * La cabecera: objetivos, logo, movimientos y puntuación.
 *
 * Los cuatro marcos son láminas dibujadas, no cajas de CSS. Cada componente
 * pinta la lámina de fondo y coloca sus números DENTRO de los huecos que el
 * dibujo ya trae, usando las medidas de `render/interfaz.ts`. Aquí no hay ni
 * un porcentaje escrito a mano: si un slot queda descuadrado, lo que hay que
 * corregir es la medida del atlas, no este archivo.
 *
 * Cada bloque se suscribe SOLO al trozo del store que necesita. Si se leyera
 * el estado entero, cambiar la puntuación repintaría también los objetivos y
 * los movimientos, que no han cambiado, y en mitad de una cascada eso son
 * decenas de renders inútiles compitiendo con el canvas.
 */

// --- objetivos ------------------------------------------------------------

function iconoDeObjetivo(o: ObjectiveState): { frame: FrameId; emoji: string } {
  if (o.type === 'collect' && o.tile) {
    return { frame: TILES[o.tile].frame as FrameId, emoji: tileEmoji(o.tile) };
  }
  if (o.type === 'break') {
    return o.layer === 'rope'
      ? { frame: 'layer.rope', emoji: '\u{1FAA2}' }
      : { frame: 'layer.ice', emoji: '\u{1F9CA}' };
  }
  return { frame: 'ui.star', emoji: '⭐' };
}

function etiquetaDeObjetivo(o: ObjectiveState): string {
  if (o.type === 'collect' && o.tile) return tileNombre(o.tile);
  if (o.type === 'break') return o.layer === 'rope' ? 'Cuerdas' : 'Hielo';
  return 'Puntos';
}

/**
 * El marco de objetivos tiene tres slots pintados. Un nivel puede pedir dos
 * objetivos, y entonces sobra uno: los que sobran se dejan vacíos en vez de
 * repartir los que hay, porque los huecos del dibujo no se pueden mover.
 */
export const Objectives = memo(function Objectives() {
  const objetivos = useSuguMatchStore((s) => s.objectives);

  return (
    <div className="match-lamina match-lamina--objetivos" style={laminaCss(OBJETIVOS)}>
      {OBJETIVOS.slots.map((slot, i) => {
        const o = objetivos[i];
        if (!o) return null;
        const { frame, emoji } = iconoDeObjetivo(o);
        const listo = o.remaining === 0;

        return (
          <div key={i} className={`match-obj${listo ? ' es-listo' : ''}`}>
            <span style={dentro(OBJETIVOS, slot)} className="match-obj__slot">
              <SpriteImg
                frame={frame}
                fallback={emoji}
                className="match-obj__icono"
                title={etiquetaDeObjetivo(o)}
              />
            </span>
            <span
              style={dentro(OBJETIVOS, OBJETIVOS.pastillas[i])}
              className="match-obj__n"
              aria-label={`${etiquetaDeObjetivo(o)}: quedan ${o.remaining}`}
            >
              {listo ? '✓' : o.remaining}
            </span>
          </div>
        );
      })}
    </div>
  );
});

// --- movimientos ----------------------------------------------------------

/**
 * Las tres estrellas se reparten a lo ancho de la barra marrón del dibujo,
 * centradas en los tercios. Se dibujan más altas que la barra a propósito:
 * así se apoyan encima en vez de quedar encajonadas, que es como está el
 * boceto.
 */
function Estrellas({ ganadas }: { ganadas: number }) {
  return (
    <span style={dentro(MOVIMIENTOS, MOVIMIENTOS.barra)} className="match-estrellas">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`match-estrella${ganadas > i ? ' es-ganada' : ''}`}
          style={recorteCss(ESTRELLAS, ganadas > i ? ESTRELLAS.oro : ESTRELLAS.apagada)}
        />
      ))}
    </span>
  );
}

export const Moves = memo(function Moves() {
  const moves = useSuguMatchStore((s) => s.moves);
  const stars = useSuguMatchStore((s) => s.stars);
  const pocos = moves <= 5;

  return (
    <div className="match-lamina match-lamina--movimientos" style={laminaCss(MOVIMIENTOS)}>
      <motion.span
        key={moves}
        style={dentro(MOVIMIENTOS, MOVIMIENTOS.numero)}
        className={`match-movimientos${pocos ? ' es-poco' : ''}`}
        initial={{ scale: 1.35 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        aria-label={`${moves} movimientos`}
      >
        {moves}
      </motion.span>
      <Estrellas ganadas={stars} />
    </div>
  );
});

// --- puntuación -----------------------------------------------------------

export const Score = memo(function Score() {
  const score = useSuguMatchStore((s) => s.score);
  const combo = useSuguMatchStore((s) => s.combo);

  return (
    <div className="match-lamina match-lamina--score" style={laminaCss(PUNTUACION)}>
      <span style={dentro(PUNTUACION, PUNTUACION.numero)} className="match-score__n">
        {score.toLocaleString('es-PE')}
      </span>
      {combo > 1 && <span className="match-score__combo">COMBO x{combo}</span>}
    </div>
  );
});

// --- botón de pausa -------------------------------------------------------

export function BotonPausa({ onPausa }: { onPausa: () => void }) {
  return (
    <button
      type="button"
      className="match-pausa"
      style={laminaCss(PAUSA)}
      onClick={onPausa}
      aria-label="Pausa"
    />
  );
}

// --- cabecera completa ----------------------------------------------------

export function GameHUD() {
  const nivel = useSuguMatchStore((s) => s.levelId);

  return (
    <header className="match-hud">
      <div className="match-hud__fila">
        <Objectives />

        <div className="match-hud__centro">
          <h1 className="match-logo" style={laminaCss(LOGO)}>
            <span className="match-solo-lectores">Sugu Match</span>
          </h1>
          <p className="match-nivel">NIVEL {nivel}</p>
        </div>

        <Moves />
      </div>

      <Score />
    </header>
  );
}
