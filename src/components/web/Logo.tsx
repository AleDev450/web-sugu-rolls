import Image from 'next/image';
import Link from 'next/link';

/**
 * Logotipo de Sugu Rolls. Es el único punto donde se referencia el archivo:
 * al recibir el original vectorial, se cambia solo aquí.
 */
export function Logo({
  className = '',
  ancho = 150,
  prioridad = false,
}: {
  className?: string;
  ancho?: number;
  prioridad?: boolean;
}) {
  return (
    <Link href="/" className={`inline-block ${className}`} aria-label="Sugu Rolls — Inicio">
      <Image
        src="/imagenes/web/logo.webp"
        alt="Sugu Rolls"
        width={ancho}
        height={Math.round((ancho * 435) / 554)}
        priority={prioridad}
        className="h-auto w-full select-none"
      />
    </Link>
  );
}
