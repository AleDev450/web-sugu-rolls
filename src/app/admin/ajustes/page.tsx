'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { guardarAjustes, traerAjustesAdmin } from '@/lib/admin';
import { Aviso, Campo, Cargando, Encabezado, claseCampo } from '@/components/admin/ui';

const CAMPOS: { clave: string; etiqueta: string; ayuda?: string; ancho?: 'completo' }[] = [
  { clave: 'nombre', etiqueta: 'Nombre del negocio' },
  { clave: 'eslogan', etiqueta: 'Eslogan' },
  { clave: 'descripcion', etiqueta: 'Descripción corta', ancho: 'completo' },
  { clave: 'telefono', etiqueta: 'Teléfono' },
  {
    clave: 'whatsapp',
    etiqueta: 'WhatsApp',
    ayuda: 'Solo dígitos con código de país, p. ej. 51999123456',
  },
  { clave: 'correo', etiqueta: 'Correo' },
  { clave: 'direccion', etiqueta: 'Dirección' },
  { clave: 'horario', etiqueta: 'Horario de atención', ancho: 'completo' },
  { clave: 'instagram', etiqueta: 'Instagram' },
  { clave: 'facebook', etiqueta: 'Facebook' },
  { clave: 'tiktok', etiqueta: 'TikTok' },
];

/**
 * Coordenadas del local y tarifa de delivery, para estimar el costo por
 * distancia cuando el cliente elige su dirección con Google Maps en el
 * checkout. Van aparte porque son números, no texto, y porque sin
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` esta sección no sirve de nada.
 */
const CAMPOS_DELIVERY: { clave: string; etiqueta: string; ayuda?: string }[] = [
  {
    clave: 'tienda_lat',
    etiqueta: 'Latitud del local',
    ayuda: 'En Google Maps: clic derecho sobre el local → copia el primer número de las coordenadas.',
  },
  { clave: 'tienda_lng', etiqueta: 'Longitud del local', ayuda: 'El segundo número de esas coordenadas.' },
  { clave: 'delivery_tarifa_base', etiqueta: 'Tarifa base (S/)', ayuda: 'Costo fijo, antes de sumar la distancia.' },
  { clave: 'delivery_tarifa_km', etiqueta: 'S/ por kilómetro', ayuda: 'Se suma a la tarifa base según la distancia.' },
];

export default function AjustesAdmin() {
  const [datos, setDatos] = useState<Record<string, string> | null>(null);
  const [delivery, setDelivery] = useState<Record<string, string> | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardandoDelivery, setGuardandoDelivery] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fila = await traerAjustesAdmin();
        const limpio: Record<string, string> = {};
        for (const { clave } of CAMPOS) limpio[clave] = (fila as never)[clave] ?? '';
        setDatos(limpio);

        const limpioDelivery: Record<string, string> = {};
        for (const { clave } of CAMPOS_DELIVERY) {
          const v = (fila as never as Record<string, unknown>)[clave];
          limpioDelivery[clave] = v == null ? '' : String(v);
        }
        setDelivery(limpioDelivery);
      } catch (e) {
        setDatos({});
        setDelivery({});
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    })();
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!datos) return;
    setGuardando(true);
    try {
      await guardarAjustes(datos);
      setAviso({ tipo: 'ok', texto: 'Ajustes guardados. La web ya muestra los cambios.' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const enviarDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!delivery) return;
    setGuardandoDelivery(true);
    try {
      // vacío = NULL (sin coordenadas no se calcula el estimado)
      const campos: Record<string, number | null> = {};
      for (const { clave } of CAMPOS_DELIVERY) {
        const v = delivery[clave]?.trim();
        campos[clave] = v ? Number(v) : null;
      }
      await guardarAjustes(campos);
      setAviso({ tipo: 'ok', texto: 'Delivery guardado. La web ya muestra los cambios.' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setGuardandoDelivery(false);
    }
  };

  if (!datos || !delivery) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Ajustes del sitio"
        bajada="Datos de contacto y redes que aparecen en toda la web."
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <form onSubmit={enviar} className="card max-w-3xl p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {CAMPOS.map(({ clave, etiqueta, ayuda, ancho }) => (
            <Campo key={clave} etiqueta={etiqueta} ancho={ancho ?? 'normal'}>
              <input
                value={datos[clave] ?? ''}
                onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })}
                className={claseCampo}
              />
              {ayuda && <span className="mt-1.5 block text-[11px] text-white/40">{ayuda}</span>}
            </Campo>
          ))}
        </div>

        <button type="submit" disabled={guardando} className="btn-primary mt-8">
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <form onSubmit={enviarDelivery} className="card mt-8 max-w-3xl p-8">
        <h2 className="font-bold">Delivery por distancia (Google Maps)</h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-bone-dim">
          Con esto configurado, el checkout muestra un estimado de delivery apenas el cliente
          elige su dirección. Sigue siendo referencial: el costo real se confirma por WhatsApp.
          Necesita <code className="text-sugu">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> en las
          variables de entorno.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {CAMPOS_DELIVERY.map(({ clave, etiqueta, ayuda }) => (
            <Campo key={clave} etiqueta={etiqueta}>
              <input
                type="number"
                step="any"
                value={delivery[clave] ?? ''}
                onChange={(e) => setDelivery({ ...delivery, [clave]: e.target.value })}
                className={claseCampo}
                placeholder="Vacío = no calcula"
              />
              {ayuda && <span className="mt-1.5 block text-[11px] text-white/40">{ayuda}</span>}
            </Campo>
          ))}
        </div>

        <button type="submit" disabled={guardandoDelivery} className="btn-primary mt-8">
          {guardandoDelivery ? 'Guardando…' : 'Guardar delivery'}
        </button>
      </form>
    </>
  );
}
