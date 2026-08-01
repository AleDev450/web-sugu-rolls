import { SITE } from '@/data/site';

/**
 * Lucide 1.x ya no incluye logotipos de marcas, así que los tres van como
 * SVG propios con el mismo trazo para que se vean uniformes.
 */

function Instagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}

function TikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 0 0-.77-.05 5.66 5.66 0 1 0 5.66 5.66V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.21-1.48Z" />
    </svg>
  );
}

const REDES = [
  { nombre: 'Instagram', href: SITE.redes.instagram, Icono: Instagram },
  { nombre: 'Facebook', href: SITE.redes.facebook, Icono: Facebook },
  { nombre: 'TikTok', href: SITE.redes.tiktok, Icono: TikTok },
];

export function RedesSociales({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-2.5 ${className}`}>
      {REDES.map(({ nombre, href, Icono }) => (
        <a
          key={nombre}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={nombre}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-bone-dim transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-sugu hover:bg-sugu hover:text-white"
        >
          <Icono className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
