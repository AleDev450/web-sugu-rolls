'use client';

import { useEffect, useState } from 'react';
import { GameCanvas } from '@/components/GameCanvas';
import { Hud, ComboBadge } from '@/components/Hud';
import {
  CodeGateOverlay,
  CollectionOverlay,
  GameOverFormOverlay,
  HowToOverlay,
  PauseOverlay,
  RankingOverlay,
  SettingsOverlay,
  StartOverlay,
  type PanelId,
} from '@/components/Overlays';
import { useGameStore, hydrateFromStorage } from '@/store/useGameStore';
import { useVipStore } from '@/store/useVipStore';
import { VipBar } from '@/components/VipBar';
import { preloadMusic, startMusic, stopMusic } from '@/game/audio/audio';
import { useEscalaJuego } from '@/lib/escala';
import type { DatosJugador } from '@/lib/scores';

export default function Page() {
  const [panel, setPanel] = useState<PanelId>(null);
  // datos que devuelve el canje: precargan el formulario del game over
  const [jugador, setJugador] = useState<DatosJugador | undefined>();
  const marco = useEscalaJuego();

  const status = useGameStore((s) => s.status);
  const festivalOn = useVipStore((s) => s.festivalActive);
  const start = useGameStore((s) => s.start);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    hydrateFromStorage();
    // se descarga mientras el jugador mira el menú; suena al pulsar JUGAR
    preloadMusic();
  }, []);

  // La música sigue sonando en pausa; se corta al terminar la partida.
  useEffect(() => {
    if (status === 'gameover') stopMusic();
  }, [status]);

  const play = (datos?: DatosJugador) => {
    setPanel(null);
    setJugador(datos);
    reset();
    // Dentro del click, para que el navegador permita el autoplay.
    startMusic();
    /*
     * Sin `requestAnimationFrame`: el motor ya limpia el tablero al entrar en
     * partida venga de donde venga (menú o game over), así que no hace falta
     * pasar por un frame intermedio. Ese salto era además una carrera — si la
     * pestaña se ocultaba justo ahí, el frame no llegaba y `start()` se
     * quedaba sin ejecutar.
     */
    start();
  };

  const toMenu = () => {
    setPanel(null);
    reset();
    stopMusic();
  };

  return (
    <main ref={marco} className={`phone${festivalOn ? ' festival' : ''}`}>
      <div className="ambient" />

      <GameCanvas />

      {festivalOn && <div className="festival-veil" />}

      {status !== 'idle' && (
        <>
          <Hud onPause={pause} onBook={() => setPanel('book')} />
          <ComboBadge />
          <VipBar />
        </>
      )}

      {status === 'idle' && panel === null && (
        <StartOverlay
          onPlay={() => setPanel('code')}
          onHowto={() => setPanel('howto')}
          onRanking={() => setPanel('ranking')}
        />
      )}

      {status === 'paused' && panel === null && (
        <PauseOverlay
          onResume={resume}
          onSettings={() => setPanel('settings')}
          onQuit={toMenu}
        />
      )}

      {status === 'gameover' && panel === null && (
        <GameOverFormOverlay onMenu={toMenu} datos={jugador} />
      )}

      {panel === 'code' && (
        <CodeGateOverlay onCancel={() => setPanel(null)} onSuccess={play} />
      )}
      {panel === 'howto' && (
        <HowToOverlay onClose={() => setPanel(null)} onPlay={() => setPanel('code')} />
      )}
      {panel === 'settings' && <SettingsOverlay onClose={() => setPanel(null)} />}
      {panel === 'book' && <CollectionOverlay onClose={() => setPanel(null)} />}
      {panel === 'ranking' && <RankingOverlay onClose={() => setPanel(null)} />}
    </main>
  );
}
