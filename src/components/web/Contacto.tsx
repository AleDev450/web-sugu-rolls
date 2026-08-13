'use client';

import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { SITE, whatsappUrl } from '@/data/site';
import { useAjustes } from '@/lib/useAjustes';
import { Aparecer, TituloSeccion } from './Seccion';
import { RedesSociales } from './RedesSociales';
import { useSeccion } from './useSeccion';

export function Contacto() {
  const s = useSeccion('contacto');
  // los datos salen del panel; SITE es solo el respaldo mientras cargan
  const a = useAjustes() ?? SITE;
  const datos = [
    { icono: MapPin, titulo: 'Dirección', valor: a.direccion, href: undefined },
    { icono: Phone, titulo: 'Teléfono', valor: a.telefono, href: `tel:${a.telefono.replace(/\s/g, '')}` },
    {
      icono: MessageCircle,
      titulo: 'WhatsApp',
      valor: a.telefono,
      href: whatsappUrl(`¡Hola ${a.nombre}! Tengo una consulta.`, a.whatsapp),
    },
    { icono: Mail, titulo: 'Correo', valor: a.correo, href: `mailto:${a.correo}` },
  ];

  return (
    <section id="contacto" className="wrap section scroll-mt-24">
      <TituloSeccion
        etiqueta={s.etiqueta}
        titulo={s.titulo}
        manuscrito={s.manuscrito}
        bajada={s.bajada}
      />

      <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {datos.map((d, i) => {
          const Contenido = (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-sugu/25 bg-sugu/10">
                <d.icono className="h-5 w-5 text-sugu" />
              </span>
              <h3 className="mt-7 text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
                {d.titulo}
              </h3>
              <p className="mt-2.5 text-[15px] font-medium">{d.valor}</p>
            </>
          );

          return (
            <Aparecer key={d.titulo} delay={i * 0.06}>
              {d.href ? (
                <a
                  href={d.href}
                  target={d.href.startsWith('http') ? '_blank' : undefined}
                  rel={d.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="card card-hover flex h-full flex-col p-9"
                >
                  {Contenido}
                </a>
              ) : (
                <div className="card flex h-full flex-col p-9">{Contenido}</div>
              )}
            </Aparecer>
          );
        })}
      </div>

      <Aparecer delay={0.2}>
        <div className="card mt-5 flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-sugu/25 bg-sugu/10">
              <Clock className="h-4.5 w-4.5 text-sugu" />
            </span>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-bone-dim">
                Horario de atención
              </h3>
              <p className="mt-1.5 text-sm font-medium">{a.horario}</p>
            </div>
          </div>

          <RedesSociales />
        </div>
      </Aparecer>
    </section>
  );
}
