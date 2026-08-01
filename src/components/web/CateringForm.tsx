'use client';

import { useState, type FormEvent } from 'react';
import { SITE, whatsappUrl } from '@/data/site';
import { Aparecer, TituloSeccion } from './Seccion';

/**
 * Formulario de cotización. Hoy arma un mensaje de WhatsApp;
 * TODO(API): enviarlo también al backend cuando exista el endpoint.
 */
export function CateringForm() {
  const [datos, setDatos] = useState({
    nombre: '',
    telefono: '',
    fecha: '',
    personas: '',
    detalle: '',
  });

  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const mensaje = [
      `¡Hola ${SITE.nombre}! Quisiera cotizar un catering.`,
      '',
      `*Nombre:* ${datos.nombre}`,
      `*Teléfono:* ${datos.telefono}`,
      `*Fecha del evento:* ${datos.fecha || 'por definir'}`,
      `*N.º de personas:* ${datos.personas || 'por definir'}`,
      datos.detalle ? `*Detalle:* ${datos.detalle}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    window.open(whatsappUrl(mensaje), '_blank', 'noopener,noreferrer');
  };

  const campo =
    'w-full rounded-xl border border-white/15 bg-night px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-sugu';

  return (
    <section className="wrap section">
      <TituloSeccion
        etiqueta="Cotización"
        titulo="Cuéntanos de tu"
        manuscrito="evento"
        bajada="Completa el formulario y te respondemos con una propuesta a tu medida."
      />

      <Aparecer delay={0.1}>
        <form onSubmit={enviar} className="card mx-auto mt-12 max-w-2xl p-7 sm:p-9">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="nombre" className="mb-2 block text-[13px] font-medium">
                Nombre <span className="text-sugu">*</span>
              </label>
              <input
                id="nombre"
                required
                value={datos.nombre}
                onChange={cambiar('nombre')}
                placeholder="Tu nombre"
                className={campo}
              />
            </div>

            <div>
              <label htmlFor="telefono" className="mb-2 block text-[13px] font-medium">
                Teléfono <span className="text-sugu">*</span>
              </label>
              <input
                id="telefono"
                required
                type="tel"
                inputMode="tel"
                value={datos.telefono}
                onChange={cambiar('telefono')}
                placeholder="999 123 456"
                className={campo}
              />
            </div>

            <div>
              <label htmlFor="fecha" className="mb-2 block text-[13px] font-medium">
                Fecha del evento
              </label>
              <input
                id="fecha"
                type="date"
                value={datos.fecha}
                onChange={cambiar('fecha')}
                className={`${campo} [color-scheme:dark]`}
              />
            </div>

            <div>
              <label htmlFor="personas" className="mb-2 block text-[13px] font-medium">
                N.º de personas
              </label>
              <input
                id="personas"
                type="number"
                min={1}
                value={datos.personas}
                onChange={cambiar('personas')}
                placeholder="20"
                className={campo}
              />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="detalle" className="mb-2 block text-[13px] font-medium">
              Cuéntanos más
            </label>
            <textarea
              id="detalle"
              rows={4}
              value={datos.detalle}
              onChange={cambiar('detalle')}
              placeholder="Tipo de evento, preferencias, restricciones alimentarias…"
              className={`${campo} resize-none`}
            />
          </div>

          <button type="submit" className="btn-primary mt-7 w-full">
            Enviar por WhatsApp
          </button>

          <p className="mt-3 text-center text-xs text-bone-dim">
            Te responderemos dentro del horario de atención.
          </p>
        </form>
      </Aparecer>
    </section>
  );
}
