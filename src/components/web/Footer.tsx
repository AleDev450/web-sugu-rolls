import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { FOOTER_LINKS, SITE } from '@/data/site';
import { Logo } from './Logo';
import { RedesSociales } from './RedesSociales';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-night pt-16">
      <div className="wrap grid gap-12 pb-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo ancho={140} />
          <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-bone-dim">
            {SITE.descripcion} Delivery en Lima y catering para tus eventos.
          </p>
          <RedesSociales className="mt-6" />
        </div>

        <nav aria-labelledby="footer-rapidos">
          <h3
            id="footer-rapidos"
            className="text-[11px] font-semibold uppercase tracking-widest text-white"
          >
            Enlaces rápidos
          </h3>
          <ul className="mt-5 space-y-3">
            {FOOTER_LINKS.rapidos.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-[13px] text-bone-dim transition-colors hover:text-sugu"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-ayuda">
          <h3
            id="footer-ayuda"
            className="text-[11px] font-semibold uppercase tracking-widest text-white"
          >
            Ayuda y políticas
          </h3>
          <ul className="mt-5 space-y-3">
            {FOOTER_LINKS.ayuda.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-[13px] text-bone-dim transition-colors hover:text-sugu"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white">
            Contacto
          </h3>
          <ul className="mt-5 space-y-3.5">
            <li className="flex items-start gap-2.5 text-[13px] text-bone-dim">
              <MapPin className="mt-0.5 h-4 w-4 flex-none text-sugu" />
              {SITE.direccion}
            </li>
            <li>
              <a
                href={`tel:${SITE.telefono.replace(/\s/g, '')}`}
                className="flex items-start gap-2.5 text-[13px] text-bone-dim transition-colors hover:text-sugu"
              >
                <Phone className="mt-0.5 h-4 w-4 flex-none text-sugu" />
                {SITE.telefono}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SITE.correo}`}
                className="flex items-start gap-2.5 text-[13px] text-bone-dim transition-colors hover:text-sugu"
              >
                <Mail className="mt-0.5 h-4 w-4 flex-none text-sugu" />
                {SITE.correo}
              </a>
            </li>
          </ul>
          <p className="mt-5 text-[12px] leading-relaxed text-bone-dim">{SITE.horario}</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="wrap flex flex-col items-center justify-between gap-3 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-bone-dim">
            © 2026 {SITE.nombre}. Todos los derechos reservados.
          </p>
          <p className="text-xs text-bone-dim">
            Hecho con <span className="text-sugu">corazón</span> y mucho maki.
          </p>
        </div>
      </div>
    </footer>
  );
}
