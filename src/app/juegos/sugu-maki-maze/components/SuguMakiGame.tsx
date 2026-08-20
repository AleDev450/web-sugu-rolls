'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { audio } from '../game/AudioManager';
import type { GameEngine } from '../game/GameEngine';
import type { Dir } from '../game/types';
import { useSuguMakiStore } from '../store/useSuguMakiStore';
import { BarraProgreso, GameHUD } from './GameHUD';
import {
  AvisoFlotante,
  CuentaAtras,
  GameOver,
  MenuInicio,
  NivelCompletado,
  Pausa,
} from './GameOverlay';
import { Cruceta, PistaTactil, useSinZoom, useSwipe, useTactil } from './MobileControls';

/**
 * Pantalla completa de Sugu Maki Maze: monta el motor, escucha los controles y
 * decide qué cartel toca según el estado.
 *
 * PixiJS se importa DENTRO del efecto, no arriba: el módulo toca `window` al
 * cargarse y en el servidor no existe. Con el import dinámico el bundle del
 * juego ni siquiera se pide hasta que el componente está montado en el
 * navegador.
 */

const TECLAS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

export default function SuguMakiGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [listo, setListo] = useState(false);

  const status = useSuguMakiStore((s) => s.status);
  const sonido = useSuguMakiStore((s) => s.sonido);
  const musica = useSuguMakiStore((s) => s.musica);
  const hydrateBest = useSuguMakiStore((s) => s.hydrateBest);
  const reset = useSuguMakiStore((s) => s.reset);

  // --- montaje del motor -------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    let motor: GameEngine | null = null;

    hydrateBest();
    audio.precargarMusica();

    (async () => {
      const { GameEngine } = await import('../game/GameEngine');
      if (cancelado || !hostRef.current) return;

      motor = new GameEngine();
      await motor.init(hostRef.current);
      if (cancelado) {
        motor.destroy();
        return;
      }
      engineRef.current = motor;
      setListo(true);
    })();

    return () => {
      cancelado = true;
      motor?.destroy();
      engineRef.current = null;
      reset();
    };
  }, [hydrateBest, reset]);

  // los interruptores de sonido del panel de pausa mandan sobre el audio
  useEffect(() => {
    audio.setSonido(sonido);
  }, [sonido]);
  useEffect(() => {
    audio.setMusica(musica);
  }, [musica]);

  // --- controles ---------------------------------------------------------
  const mover = useCallback((dir: Dir) => {
    engineRef.current?.mover(dir);
  }, []);

  const alternarPausa = useCallback(() => {
    const motor = engineRef.current;
    if (!motor) return;
    const actual = useSuguMakiStore.getState().status;
    if (actual === 'playing') motor.pausar();
    else if (actual === 'paused') motor.reanudar();
  }, []);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        alternarPausa();
        return;
      }
      const dir = TECLAS[e.code];
      if (!dir) return;
      // las flechas hacen scroll en la página si no se les corta el paso
      e.preventDefault();
      mover(dir);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [mover, alternarPausa]);

  const enJuego = status === 'playing' || status === 'countdown';
  const tactil = useTactil();
  useSwipe(hostRef, mover, enJuego);
  useSinZoom();

  // pierdes el foco de la pestaña a mitad de partida: se pausa solo
  useEffect(() => {
    const alOcultar = () => {
      if (document.hidden && useSuguMakiStore.getState().status === 'playing') {
        engineRef.current?.pausar();
      }
    };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, []);

  // --- acciones ----------------------------------------------------------
  const jugar = useCallback(() => {
    // dentro del click: los navegadores solo dejan sonar tras un gesto
    audio.desbloquear();
    engineRef.current?.empezarPartida();
  }, []);

  const salirAlMenu = useCallback(() => {
    audio.stopMusic();
    reset();
  }, [reset]);

  return (
    <div className={`maze-marco${tactil ? ' con-cruceta' : ''}`}>
      <div className="maze-cabina">
        <GameHUD onPausa={alternarPausa} />

        <div className="maze-tablero">
          <div ref={hostRef} className="maze-canvas" />

          <AvisoFlotante />
          <PistaTactil visible={status === 'countdown'} />

          <AnimatePresence mode="wait">
            {status === 'menu' && <MenuInicio key="menu" onJugar={jugar} />}
            {status === 'countdown' && (
              <CuentaAtras key="cuenta" onFin={() => engineRef.current?.arrancar()} />
            )}
            {status === 'paused' && (
              <Pausa key="pausa" onSeguir={alternarPausa} onSalir={salirAlMenu} />
            )}
            {status === 'level-complete' && <NivelCompletado key="nivel" />}
            {status === 'game-over' && <GameOver key="fin" onReiniciar={jugar} />}
          </AnimatePresence>

          {!listo && <div className="maze-cargando">CARGANDO…</div>}
        </div>

        <BarraProgreso />
      </div>

      {tactil && <Cruceta onDir={mover} activo={enJuego} />}
    </div>
  );
}
