'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import type { Game } from '../game/Game';
import { sonido } from '../game/SoundManager';
import type { BoosterId } from '../game/types';
import { useSuguMatchStore } from '../store/useSuguMatchStore';
import { BoosterBar, BoosterPista } from './BoosterBar';
import { BotonPausa, GameHUD } from './GameHUD';
import { AvisoFlotante, GameOver, MenuInicio, NivelCompletado, Pausa } from './Overlays';

/**
 * Pantalla completa de Sugu Match: monta el motor, cablea la interfaz y decide
 * qué cartel toca según el estado.
 *
 * `Game` se importa DENTRO del efecto y no arriba del archivo: el módulo
 * arrastra PixiJS, que toca `window` al cargarse. Con el import dinámico el
 * bundle del juego ni siquiera se pide hasta que el componente está montado en
 * el navegador.
 */
export default function SuguMatch() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [listo, setListo] = useState(false);

  const status = useSuguMatchStore((s) => s.status);
  const efectos = useSuguMatchStore((s) => s.sonido);
  const musica = useSuguMatchStore((s) => s.musica);
  const hydrateBest = useSuguMatchStore((s) => s.hydrateBest);
  const reset = useSuguMatchStore((s) => s.reset);

  // --- montaje del motor --------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    let motor: Game | null = null;

    hydrateBest();
    sonido.precargarMusica();

    void (async () => {
      const { Game } = await import('../game/Game');
      if (cancelado || !hostRef.current) return;

      motor = new Game();
      await motor.init(hostRef.current);
      if (cancelado) {
        motor.destroy();
        return;
      }
      gameRef.current = motor;
      setListo(true);
    })();

    return () => {
      cancelado = true;
      motor?.destroy();
      gameRef.current = null;
      reset();
    };
  }, [hydrateBest, reset]);

  // los interruptores del panel de pausa mandan sobre el audio
  useEffect(() => {
    sonido.setSonido(efectos);
  }, [efectos]);
  useEffect(() => {
    sonido.setMusica(musica);
  }, [musica]);

  // --- acciones -----------------------------------------------------------
  const alternarPausa = useCallback(() => {
    const motor = gameRef.current;
    if (!motor) return;
    const actual = useSuguMatchStore.getState().status;
    if (actual === 'playing') motor.pausar();
    else if (actual === 'paused') motor.reanudar();
  }, []);

  const jugar = useCallback(() => {
    // dentro del click: los navegadores solo dejan sonar tras un gesto
    sonido.desbloquear();
    gameRef.current?.empezar();
  }, []);

  const usarBooster = useCallback((id: BoosterId) => {
    sonido.desbloquear();
    gameRef.current?.pulsarBooster(id);
  }, []);

  const reintentar = useCallback(() => gameRef.current?.reintentar(), []);
  const siguiente = useCallback(() => gameRef.current?.siguienteNivel(), []);

  // --- teclado y visibilidad ----------------------------------------------
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      alternarPausa();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [alternarPausa]);

  useEffect(() => {
    const alOcultar = () => {
      if (document.hidden && useSuguMatchStore.getState().status === 'playing') {
        gameRef.current?.pausar();
      }
    };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, []);

  return (
    <div className="match-marco">
      <div className="match-cabina">
        <GameHUD />

        <div className="match-tablero">
          <div ref={hostRef} className="match-canvas" />

          <AvisoFlotante />

          <AnimatePresence mode="wait">
            {status === 'idle' && <MenuInicio key="menu" onJugar={jugar} />}
            {status === 'paused' && (
              <Pausa key="pausa" onSeguir={alternarPausa} onSalir={reintentar} />
            )}
            {status === 'won' && (
              <NivelCompletado key="ganado" onSiguiente={siguiente} onRepetir={reintentar} />
            )}
            {status === 'lost' && <GameOver key="perdido" onReintentar={reintentar} />}
          </AnimatePresence>

          {!listo && <div className="match-cargando">CARGANDO…</div>}
        </div>

        <BoosterPista />

        {/* la pausa va fuera de la lámina de habilidades: los siete huecos
            pintados son de los boosters y meterle un octavo la descuadra */}
        <div className="match-pie">
          <BotonPausa onPausa={alternarPausa} />
          <BoosterBar onUsar={usarBooster} />
        </div>
      </div>
    </div>
  );
}
