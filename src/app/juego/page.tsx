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
import { startMusic, stopMusic } from '@/game/audio/audio';

export default function Page() {
  const [panel, setPanel] = useState<PanelId>(null);

  const status = useGameStore((s) => s.status);
  const festivalOn = useVipStore((s) => s.festivalActive);
  const start = useGameStore((s) => s.start);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  // La música sigue sonando en pausa; se corta al terminar la partida.
  useEffect(() => {
    if (status === 'gameover') stopMusic();
  }, [status]);

  const play = () => {
    setPanel(null);
    reset();
    // Dentro del click, para que el navegador permita el autoplay.
    startMusic();
    // `reset()` deja el status en 'idle'; el motor limpia el tablero al verlo
    // y `start()` en el siguiente tick arranca con el tablero ya vacío.
    requestAnimationFrame(() => start());
  };

  const toMenu = () => {
    setPanel(null);
    reset();
    stopMusic();
  };

  return (
    <main className={`phone${festivalOn ? ' festival' : ''}`}>
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

      {status === 'gameover' && panel === null && <GameOverFormOverlay onMenu={toMenu} />}

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
