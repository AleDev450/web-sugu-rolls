'use client';

import dynamic from 'next/dynamic';

/**
 * Puente entre la página (que se renderiza en el servidor, para el SEO) y el
 * juego (que solo existe en el navegador).
 *
 * `ssr: false` no se puede pedir desde un componente de servidor, de ahí este
 * envoltorio mínimo marcado como cliente. Sin él, Next intentaría pintar el
 * juego en el servidor y PixiJS reventaría con `window is not defined` en
 * cuanto se cargara el módulo.
 */
const SuguMatch = dynamic(() => import('./SuguMatch'), {
  ssr: false,
  loading: () => (
    <div className="match-marco">
      <div className="match-cabina">
        <div className="match-tablero">
          <div className="match-cargando">CARGANDO…</div>
        </div>
      </div>
    </div>
  ),
});

export function GameLoader() {
  return <SuguMatch />;
}
