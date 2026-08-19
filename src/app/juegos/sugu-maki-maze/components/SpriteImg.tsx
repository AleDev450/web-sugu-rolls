'use client';

import { useEffect, useState } from 'react';
import { ANIMS, frameToCss, type AnimId, type FrameId } from '../game/sprites';

/**
 * Un frame del sprite sheet pintado en el DOM.
 *
 * El HUD y los carteles viven fuera del canvas, así que no pueden usar las
 * texturas de PixiJS. En vez de duplicar imágenes se recorta la misma hoja con
 * `background-position`, con los mismos números del atlas: si mañana se mueve
 * un sprite en `sprites.ts`, se mueve en los dos sitios a la vez.
 */
export function SpriteImg({
  frame,
  size = 28,
  className,
  style,
}: {
  frame: FrameId;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{ display: 'inline-block', flex: 'none', ...frameToCss(frame, size), ...style }}
    />
  );
}

/**
 * Lo mismo, pero recorriendo una animación del atlas. Se usa para el maki que
 * saluda en la pantalla de inicio.
 */
export function SpriteAnim({
  anim,
  size = 64,
  fps = 8,
  className,
  style,
}: {
  anim: AnimId;
  size?: number;
  fps?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const frames = ANIMS[anim];
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    if (frames.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % frames.length), 1000 / fps);
    return () => window.clearInterval(id);
  }, [frames, fps]);

  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-block',
        flex: 'none',
        ...frameToCss(frames[i % frames.length], size),
        ...style,
      }}
    />
  );
}
