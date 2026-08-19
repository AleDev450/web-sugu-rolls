'use client';

import dynamic from 'next/dynamic';

/**
 * Puente entre la página (que se renderiza en el servidor, para el SEO) y el
 * juego (que solo existe en el navegador).
 *
 * `ssr: false` no se puede pedir desde un componente de servidor en Next 15,
 * de ahí este envoltorio mínimo marcado como cliente. Sin él, Next intentaría
 * pintar el juego en el servidor y PixiJS reventaría con `window is not
 * defined` en cuanto se cargara el módulo.
 */
const SuguMakiGame = dynamic(() => import('./SuguMakiGame'), {
  ssr: false,
  loading: () => (
    <div className="maze-marco">
      <div className="maze-cabina">
        <div className="maze-tablero">
          <div className="maze-cargando">CARGANDO…</div>
        </div>
      </div>
    </div>
  ),
});

export function GameLoader() {
  return <SuguMakiGame />;
}
