'use client';

import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

/** Aparición al entrar en pantalla, compartida por todas las secciones. */
export const aparecer: Variants = {
  oculto: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export function Aparecer({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="oculto"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={aparecer}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Cabecera de sección: etiqueta, título (con una palabra a pincel) y bajada.
 * `titulo` y `manuscrito` se concatenan; el segundo va en rojo manuscrito.
 */
export function TituloSeccion({
  etiqueta,
  titulo,
  manuscrito,
  bajada,
  centrado = true,
  accion,
}: {
  etiqueta?: string;
  titulo: string;
  manuscrito?: string;
  bajada?: string;
  centrado?: boolean;
  accion?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-7 ${
        centrado
          ? 'items-center text-center'
          : 'items-start sm:flex-row sm:items-end sm:justify-between'
      }`}
    >
      <div className={centrado ? 'flex flex-col items-center' : ''}>
        {etiqueta && <p className="kicker">{etiqueta}</p>}
        <h2 className="title-xl mt-5 text-balance">
          {titulo}{' '}
          {manuscrito && (
            <span className="font-brush text-[1.28em] font-bold leading-[0.7] text-sugu">
              {manuscrito}
            </span>
          )}
        </h2>
        {bajada && (
          <p
            className={`mt-6 max-w-prose text-[17px] leading-[1.75] text-bone-dim ${
              centrado ? 'mx-auto' : ''
            }`}
          >
            {bajada}
          </p>
        )}
      </div>
      {accion}
    </div>
  );
}

/** Separador de pinceladas rojas entre secciones. */
export function Pincelada({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-sugu/60" />
      <span className="h-1.5 w-1.5 rotate-45 bg-sugu" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-sugu/60" />
    </div>
  );
}
