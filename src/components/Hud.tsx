'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { assetUrl } from '@/game/assets/manifest';
import { TierImage } from './TierImage';

/**
 * Barra superior con el arte de `imagenes/ui/marco-hud.png`:
 * logo (izquierda, ya horneado en la imagen) · panel de puntuación (centro)
 * · SIGUIENTE (derecha). Los números se posicionan en % sobre la imagen,
 * así escalan con cualquier ancho. Si la imagen faltara, cae al HUD simple.
 */
/** ms restantes por debajo de los cuales el reloj avisa en rojo. */
const APURO_MS = 30_000;

/**
 * Reloj de la partida. No se dibuja si no hay límite configurado (el panel
 * permite poner 0 = sin temporizador), así el juego se ve igual que antes.
 */
function Reloj() {
  const restanteMs = useGameStore((s) => s.tiempoRestanteMs);
  if (restanteMs === null) return null;

  const total = Math.ceil(restanteMs / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;

  return (
    <div className={`hud-reloj${restanteMs <= APURO_MS ? ' apuro' : ''}`}>
      {mm}:{String(ss).padStart(2, '0')}
    </div>
  );
}

export function Hud({ onPause, onBook }: { onPause: () => void; onBook: () => void }) {
  const score = useGameStore((s) => s.score);
  const best = useGameStore((s) => s.best);
  const nextTier = useGameStore((s) => s.nextTier);
  const [frameOk, setFrameOk] = useState(true);

  if (!frameOk) {
    // fallback sin arte: HUD simple translúcido
    return (
      <div className="hud">
        <div>
          <div className="score-label">PUNTUACIÓN</div>
          <div className="score-val">{score.toLocaleString('es')}</div>
          <div className="best-val">Mejor · {best.toLocaleString('es')}</div>
        </div>
        <Reloj />
        <div className="hud-right">
          <div className="next-box">
            <div className="next-label">SIGUIENTE</div>
            <TierImage tier={nextTier} size={44} className="next-thumb" />
          </div>
          <div className="icon-row">
            <button className="icon-btn" onClick={onBook} aria-label="Colección">📖</button>
            <button className="icon-btn" onClick={onPause} aria-label="Pausa">⏸</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hud-bar">
      <img
        className="hud-frame"
        src={assetUrl('ui', 'marco-hud')}
        alt=""
        draggable={false}
        onError={() => setFrameOk(false)}
      />
      <div className="hud-score-zone">
        <div className="hud-score-label">PUNTUACIÓN</div>
        <div className="hud-score-val">{score.toLocaleString('es')}</div>
        <div className="hud-best">Mejor · {best.toLocaleString('es')}</div>
      </div>
      <div className="hud-next-zone">
        <TierImage tier={nextTier} size={44} className="hud-next-img" />
      </div>
      {/* debajo del marco, a la izquierda: el arte no deja sitio dentro */}
      <Reloj />
      <div className="hud-btns">
        <button className="icon-btn" onClick={onBook} aria-label="Colección">📖</button>
        <button className="icon-btn" onClick={onPause} aria-label="Pausa">⏸</button>
      </div>
    </div>
  );
}

/** Badge de combo: se remonta con `key` para reiniciar la animación CSS. */
export function ComboBadge() {
  const combo = useGameStore((s) => s.combo);
  const lastMergeAt = useGameStore((s) => s.lastMergeAt);
  const [shown, setShown] = useState<{ n: number; at: number } | null>(null);

  useEffect(() => {
    if (combo >= 2) setShown({ n: combo, at: lastMergeAt });
  }, [combo, lastMergeAt]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 900);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  return (
    <div className="combo-badge" key={shown.at}>
      ¡COMBO x{shown.n}!
    </div>
  );
}
