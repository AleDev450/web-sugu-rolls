'use client';

import { useEffect, useState } from 'react';
import { SHEET_SRC, frameToCss, type FrameId } from '../game/render/sprites';

/**
 * Un frame del sprite sheet pintado en el DOM.
 *
 * El HUD vive en React y no puede tocar texturas de Pixi, así que recorta la
 * misma hoja con `background-position`. Y como la hoja puede no estar todavía
 * en /public, se comprueba UNA vez por sesión —la promesa se cachea a nivel de
 * módulo— y mientras tanto se pinta el emoji de respaldo. El HUD nunca enseña
 * un hueco roto.
 */

let sonda: Promise<boolean> | null = null;

function hojaDisponible(): Promise<boolean> {
  if (sonda) return sonda;
  sonda = new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = SHEET_SRC;
  });
  return sonda;
}

export function useHoja(): boolean {
  const [hay, setHay] = useState(false);
  useEffect(() => {
    let vivo = true;
    void hojaDisponible().then((ok) => {
      if (vivo) setHay(ok);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return hay;
}

interface Props {
  frame: FrameId;
  /**
   * Lado en píxeles. Si no se da, el icono llena a su padre — que es lo que
   * hace falta dentro de los slots de las láminas, cuyo tamaño depende del
   * ancho de la pantalla y no se sabe aquí.
   */
  size?: number;
  /** Emoji que se pinta mientras no haya sprite sheet. */
  fallback: string;
  className?: string;
  title?: string;
}

export function SpriteImg({ frame, size, fallback, className, title }: Props) {
  const hay = useHoja();
  const clase = `match-sprite${size ? '' : ' es-lleno'}${className ? ` ${className}` : ''}`;

  if (!hay) {
    return (
      <span
        className={clase}
        style={
          size
            ? { width: size, height: size, fontSize: size * 0.82, lineHeight: `${size}px` }
            : undefined
        }
        title={title}
        aria-hidden
      >
        {fallback}
      </span>
    );
  }

  return <span className={clase} style={frameToCss(frame, size)} title={title} aria-hidden />;
}
