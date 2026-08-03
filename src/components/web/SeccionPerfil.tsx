'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Bloque del perfil: título con icono y su contenido dentro de una tarjeta.
 *
 * Existe para que las cuatro secciones (tarjeta, canjes, pedidos y datos)
 * compartan exactamente el mismo encabezado. Cuando cada una se maquetaba por
 * su cuenta, los tamaños y los espacios bailaban entre ellas.
 */
export function SeccionPerfil({
  titulo,
  icono: Icono,
  accion,
  children,
  className = '',
}: {
  titulo: string;
  icono: LucideIcon;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-7 ${className}`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-bone-dim">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sugu/10">
            <Icono className="h-4 w-4 text-sugu" />
          </span>
          {titulo}
        </h2>
        {accion}
      </header>
      {children}
    </section>
  );
}

/** Estado vacío con icono, para cuando una sección no tiene nada que mostrar. */
export function Vacio({
  icono: Icono,
  texto,
  accion,
}: {
  icono: LucideIcon;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Icono className="h-10 w-10 text-white/15" />
      <p className="text-[13px] text-bone-dim">{texto}</p>
      {accion}
    </div>
  );
}
