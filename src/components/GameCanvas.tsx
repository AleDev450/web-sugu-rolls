'use client';

import { useEffect, useRef } from 'react';
import type { SuguGame } from '@/game/core/SuguGame';

/**
 * Monta el motor. Pixi y Matter solo existen en el cliente, así que se
 * importan de forma dinámica dentro del efecto.
 */
export function GameCanvas({ onReady }: { onReady?: (game: SuguGame) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: SuguGame | null = null;
    let cancelled = false;

    (async () => {
      const { SuguGame } = await import('@/game/core/SuguGame');
      if (cancelled || !hostRef.current) return;
      game = new SuguGame();
      await game.init(hostRef.current);
      if (cancelled) {
        game.destroy();
        return;
      }
      onReady?.(game);
    })();

    return () => {
      cancelled = true;
      game?.destroy();
    };
    // onReady se pasa memoizado desde la página; el motor se monta una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="stage" />;
}
