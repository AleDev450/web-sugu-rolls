'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { TIME_WARNING_S } from '../game/config';
import { useSuguMakiStore } from '../store/useSuguMakiStore';
import { SpriteImg } from './SpriteImg';

/**
 * Marcador superior y barra de progreso inferior.
 *
 * Cada trozo se suscribe SOLO al dato que pinta (`useSuguMakiStore(s => ...)`).
 * Así, cuando el motor avisa de que cambió el reloj, React repinta el reloj y
 * no el marcador ni las vidas.
 */

/** Estética recreativa: el marcador siempre con seis cifras. */
function formatearPuntos(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

export function formatearTiempo(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Vidas() {
  const lives = useSuguMakiStore((s) => s.lives);
  return (
    <div className="maze-vidas">
      <SpriteImg frame="ui.life" size={26} />
      <span className="maze-vidas-x">x{lives}</span>
    </div>
  );
}

function Marcador() {
  const score = useSuguMakiStore((s) => s.score);
  const combo = useSuguMakiStore((s) => s.combo);

  return (
    <div className="maze-marcador">
      <motion.span
        key={Math.floor(score / 1000)}
        initial={{ scale: 1.14 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.22 }}
        className="maze-score"
      >
        {formatearPuntos(score)}
      </motion.span>

      <AnimatePresence>
        {combo > 1 && (
          <motion.span
            className="maze-combo"
            initial={{ opacity: 0, y: -6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
          >
            COMBO x{combo}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Nivel() {
  const level = useSuguMakiStore((s) => s.level);
  return <div className="maze-nivel">NIVEL {level}</div>;
}

function BarraTiempo() {
  const timeMs = useSuguMakiStore((s) => s.timeMs);
  const total = useSuguMakiStore((s) => s.timeTotalMs);
  const segundos = Math.ceil(timeMs / 1000);
  const apurado = segundos <= TIME_WARNING_S;
  const pct = total > 0 ? Math.max(0, Math.min(100, (timeMs / total) * 100)) : 0;

  return (
    <div className={`maze-tiempo${apurado ? ' apurado' : ''}`}>
      <div className="maze-tiempo-pista">
        <div className="maze-tiempo-relleno" style={{ width: `${pct}%` }} />
      </div>
      <span className="maze-reloj">{formatearTiempo(timeMs)}</span>
    </div>
  );
}

export function GameHUD({ onPausa }: { onPausa: () => void }) {
  const status = useSuguMakiStore((s) => s.status);
  const enPausa = status === 'paused';
  // en el menú o en el game over no hay nada que pausar
  const sePuedePausar = status === 'playing' || status === 'paused';

  return (
    <header className="maze-hud">
      <div className="maze-hud-fila">
        <Vidas />
        <Marcador />
        <div className="maze-hud-derecha">
          <Nivel />
          {sePuedePausar && (
            <button
              type="button"
              className="maze-btn-pausa"
              onClick={onPausa}
              aria-label={enPausa ? 'Continuar' : 'Pausa'}
            >
              {enPausa ? <Play size={14} /> : <Pause size={14} />}
              <span>{enPausa ? 'SIGUE' : 'PAUSA'}</span>
            </button>
          )}
        </div>
      </div>

      <BarraTiempo />
    </header>
  );
}

/**
 * Barra inferior: cuánto llevas recogido del nivel, en bloques como los
 * medidores de las recreativas. A la izquierda, el power-up del momento.
 */
export function BarraProgreso() {
  const progress = useSuguMakiStore((s) => s.progress);
  const powerMs = useSuguMakiStore((s) => s.powerMs);
  const BLOQUES = 14;
  const llenos = Math.round(progress * BLOQUES);

  return (
    <footer className={`maze-progreso${powerMs > 0 ? ' con-power' : ''}`}>
      <SpriteImg frame={powerMs > 0 ? 'item.wasabi' : 'item.rice'} size={24} />
      <div className="maze-bloques" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
        {Array.from({ length: BLOQUES }, (_, i) => (
          <span key={i} className={`maze-bloque${i < llenos ? ' lleno' : ''}`} />
        ))}
      </div>
      <span className="maze-progreso-pct">{Math.round(progress * 100)}%</span>
    </footer>
  );
}
