'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { aplanarOpciones, formatoOpciones, soles } from '@/data/productos';
import { SITE, whatsappUrl } from '@/data/site';
import { useCartStore } from '@/store/useCartStore';
import { tiendaAbierta } from '@/lib/contenido';
import { useAjustes } from '@/lib/useAjustes';
import {
  adjuntarComprobante,
  crearPedido,
  miPerfil,
  type MetodoPago,
  type Perfil,
} from '@/lib/tienda';
import { campoClase } from './CuentaForms';

const METODOS: { id: MetodoPago; label: string }[] = [
  { id: 'yape', label: 'Yape' },
  { id: 'plin', label: 'Plin' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta (enlace de pago)',
};

/** Chips de Yape/Plin/Tarjeta, iguales en el checkout con cuenta y sin ella. */
function SelectorMetodoPago({
  metodoPago,
  setMetodoPago,
}: {
  metodoPago: MetodoPago;
  setMetodoPago: (m: MetodoPago) => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-[13px] font-medium">¿Cómo vas a pagar?</span>
      <div className="flex gap-2">
        {METODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetodoPago(m.id)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors ${
              metodoPago === m.id
                ? 'border-sugu bg-sugu/10 text-sugu'
                : 'border-white/15 text-bone-dim hover:border-white/30'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {metodoPago === 'tarjeta' && (
        <p className="mt-2 text-[12px] leading-relaxed text-white/40">
          Te mandamos el enlace de pago por WhatsApp apenas confirmes.
        </p>
      )}
    </div>
  );
}

/**
 * Cierre del pedido dentro de la web.
 *
 * Con cuenta: crea el pedido en estado "pendiente" en la base y el cliente
 * paga por fuera (Yape, Plin o tarjeta); el local confirma el pago desde el
 * panel, y ES ESA confirmación la que acredita los puntos.
 *
 * Sin cuenta: no hay a quién acreditarle puntos ni perfil del que sacar
 * nombre/teléfono, así que se piden ahí mismo y el pedido se cierra
 * directo por WhatsApp, sin fila en `orders`.
 *
 * En los dos casos se abre WhatsApp con el detalle: todo pedido de la web
 * tiene que llegar también por ahí, porque es donde se coordina el delivery
 * y, con tarjeta, el enlace de pago.
 */
export function Checkout({ alConfirmarPedido }: { alConfirmarPedido?: () => void }) {
  const items = useCartStore((s) => s.items);
  const vaciar = useCartStore((s) => s.vaciar);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [listo, setListo] = useState(false);
  const [abierta, setAbierta] = useState<boolean | null>(null);
  const ajustes = useAjustes();
  const [abierto, setAbierto] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [nota, setNota] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('yape');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ id: string; numero: number; metodo: MetodoPago } | null>(
    null
  );
  const [comprobante, setComprobante] = useState<'falta' | 'subiendo' | 'listo'>('falta');

  // solo para quien no tiene cuenta: sin perfil no hay de dónde sacar estos datos
  const [nombreInvitado, setNombreInvitado] = useState('');
  const [telefonoInvitado, setTelefonoInvitado] = useState('');
  const [hechoInvitado, setHechoInvitado] = useState(false);

  useEffect(() => {
    void tiendaAbierta().then(setAbierta);
  }, []);

  useEffect(() => {
    void miPerfil().then((p) => {
      setPerfil(p);
      setDireccion(p?.address ?? '');
      setListo(true);
    });
  }, []);

  /** El detalle de items es igual para el pedido con cuenta y sin ella. */
  const construirMensaje = (saludo: string, datosCliente: (string | false)[]) => {
    const lineas = items
      .map((i) => {
        const detalle = formatoOpciones(i.opciones);
        return `• ${i.cantidad}× ${i.nombre}${detalle ? `\n   ${detalle}` : ''} — ${soles(i.precio * i.cantidad)}`;
      })
      .join('\n');
    const subtotal = items.reduce((t, i) => t + i.precio * i.cantidad, 0);

    return [
      saludo,
      '',
      lineas,
      '',
      `*Subtotal: ${soles(subtotal)}*`,
      '_El delivery se confirma según mi distrito._',
      '',
      ...datosCliente,
      `*Método de pago:* ${ETIQUETA_METODO[metodoPago]}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const { id, numero } = await crearPedido(
        // el id de línea puede llevar sufijo de presentación; se manda el
        // slug real y las piezas por separado. El precio de los extras lo
        // recalcula la base con su propio catálogo: solo se manda qué se eligió.
        items.map((i) => ({
          slug: i.slug,
          piezas: i.piezas,
          cantidad: i.cantidad,
          opciones: aplanarOpciones(i.opciones),
        })),
        direccion,
        nota,
        metodoPago
      );

      const mensaje = construirMensaje(
        `¡Hola ${ajustes?.nombre ?? SITE.nombre}! Acabo de registrar el pedido #${numero} en la web 🍣`,
        [`*Dirección:* ${direccion}`, nota && `*Nota:* ${nota}`]
      );

      window.open(whatsappUrl(mensaje, ajustes?.whatsapp), '_blank', 'noopener,noreferrer');

      setHecho({ id, numero, metodo: metodoPago });
      alConfirmarPedido?.();
      vaciar();
    } catch {
      setError('No se pudo registrar el pedido. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  /*
   * Sin cuenta no hay a quién acreditarle puntos ni un perfil del que sacar
   * nombre/teléfono, así que se piden aquí mismo y el pedido se cierra por
   * WhatsApp directamente —no se crea fila en `orders`, igual que el botón
   * "Pedir por WhatsApp" del carrito, solo que sin dejarle al cliente la
   * tarea de escribir él mismo sus datos dentro del chat.
   */
  const confirmarInvitado = () => {
    if (!nombreInvitado.trim() || !telefonoInvitado.trim() || !direccion.trim()) return;

    const mensaje = construirMensaje(`¡Hola ${ajustes?.nombre ?? SITE.nombre}! Quisiera hacer un pedido 🍣`, [
      `*Nombre:* ${nombreInvitado}`,
      `*Teléfono:* ${telefonoInvitado}`,
      `*Dirección:* ${direccion}`,
      nota && `*Nota:* ${nota}`,
    ]);

    window.open(whatsappUrl(mensaje, ajustes?.whatsapp), '_blank', 'noopener,noreferrer');
    setHechoInvitado(true);
    alConfirmarPedido?.();
    vaciar();
  };

  if (!listo) return null;

  const subirYape = async (archivo: File | undefined) => {
    if (!archivo || !hecho) return;
    setComprobante('subiendo');
    setError(null);
    try {
      await adjuntarComprobante(hecho.id, archivo);
      setComprobante('listo');
    } catch (e) {
      setComprobante('falta');
      setError((e as Error).message);
    }
  };

  if (hecho) {
    return (
      <div className="rounded-2xl border border-emerald-600/40 bg-emerald-600/10 p-5 text-[13px] leading-relaxed">
        <p className="font-bold text-emerald-400">Pedido #{hecho.numero} registrado</p>
        <p className="mt-2 text-bone-dim">
          El <b className="text-white">costo del delivery se evalúa según tu distrito</b> y te lo
          confirmamos por WhatsApp junto con el total a pagar.
        </p>

        {/*
          El comprobante va DESPUÉS de crear el pedido, no antes: hasta que no
          existe el pedido no hay a qué adjuntarlo, y el cliente no sabe cuánto
          pagar hasta que le confirmamos el delivery. Con tarjeta no hay nada
          que subir: el enlace de pago llega por WhatsApp.
        */}
        <div className="mt-4 border-t border-emerald-600/20 pt-4">
          {hecho.metodo === 'tarjeta' ? (
            <p className="font-semibold text-white">
              Te enviamos el enlace de pago con tarjeta por WhatsApp en un momento.
            </p>
          ) : comprobante === 'listo' ? (
            <p className="font-semibold text-emerald-400">
              Comprobante recibido. Preparamos tu pedido.
            </p>
          ) : (
            <>
              <p className="font-semibold text-white">
                Adjunta tu {ETIQUETA_METODO[hecho.metodo]} para continuar
              </p>
              <p className="mt-1 text-bone-dim">
                Sube la captura de la transferencia. Sin ella el pedido queda en espera.
              </p>
              <label className="btn-ghost mt-3 inline-flex cursor-pointer !px-5 !py-2.5 text-[13px]">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={comprobante === 'subiendo'}
                  onChange={(e) => void subirYape(e.target.files?.[0])}
                />
                {comprobante === 'subiendo' ? 'Subiendo…' : 'Adjuntar captura'}
              </label>
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sugu">{error}</p>}

        <Link href="/cuenta" className="mt-3 inline-block text-sugu underline underline-offset-4">
          Ver mis pedidos
        </Link>
      </div>
    );
  }

  /*
   * Tienda cerrada: se puede mirar la carta y llenar el carrito, pero no
   * cerrar el pedido. El aviso es editable desde el panel y la base rechaza
   * el pedido igualmente aunque alguien fuerce el botón.
   */
  if (abierta === false) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-[13px] leading-relaxed">
        <p className="font-bold text-amber-400">Ahora mismo no tomamos pedidos</p>
        <p className="mt-2 text-bone-dim">
          {ajustes?.aviso_cerrado ??
            'Estamos cerrados en este momento. Puedes volver en nuestro horario de atención.'}
        </p>
        {ajustes?.horario && (
          <p className="mt-2 text-bone-dim">
            <b className="text-white">Horario:</b> {ajustes.horario}
          </p>
        )}
      </div>
    );
  }

  // pantalla de "listo" para quien pidió sin cuenta
  if (!perfil && hechoInvitado) {
    return (
      <div className="rounded-2xl border border-emerald-600/40 bg-emerald-600/10 p-5 text-[13px] leading-relaxed">
        <p className="font-bold text-emerald-400">¡Te abrimos WhatsApp!</p>
        <p className="mt-2 text-bone-dim">
          Envía el mensaje para que confirmemos tu pedido y coordinemos el pago y el delivery.
        </p>
        <Link href="/cuenta" className="mt-3 inline-block text-sugu underline underline-offset-4">
          Crea una cuenta para sumar puntos la próxima vez
        </Link>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="btn-primary w-full">
        Hacer el pedido
      </button>
    );
  }

  // sin cuenta: se piden nombre y teléfono aquí mismo, y se cierra por WhatsApp
  if (!perfil) {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium">Nombre</span>
          <input
            value={nombreInvitado}
            onChange={(e) => setNombreInvitado(e.target.value)}
            className={campoClase}
            placeholder="Tu nombre"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[13px] font-medium">Teléfono</span>
          <input
            value={telefonoInvitado}
            onChange={(e) => setTelefonoInvitado(e.target.value)}
            type="tel"
            inputMode="tel"
            className={campoClase}
            placeholder="999 123 456"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[13px] font-medium">Dirección de entrega</span>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className={campoClase}
            placeholder="Calle, número, referencia, distrito"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[13px] font-medium">Nota (opcional)</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={campoClase}
            placeholder="Sin palta, tocar el timbre…"
          />
        </label>

        <SelectorMetodoPago metodoPago={metodoPago} setMetodoPago={setMetodoPago} />

        <button
          onClick={confirmarInvitado}
          disabled={!nombreInvitado.trim() || !telefonoInvitado.trim() || !direccion.trim()}
          className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
        >
          Continuar por WhatsApp
        </button>

        <p className="text-[12px] leading-relaxed text-white/40">
          Sin cuenta no acumulas puntos.{' '}
          <Link href="/cuenta" className="text-sugu underline underline-offset-4">
            ¿Prefieres crear una?
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-2 block text-[13px] font-medium">Dirección de entrega</span>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className={campoClase}
          placeholder="Calle, número, referencia, distrito"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-medium">Nota (opcional)</span>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className={campoClase}
          placeholder="Sin palta, tocar el timbre…"
        />
      </label>

      <SelectorMetodoPago metodoPago={metodoPago} setMetodoPago={setMetodoPago} />

      {error && <p className="text-[13px] text-sugu">{error}</p>}

      <button
        onClick={() => void confirmar()}
        disabled={enviando || !direccion.trim()}
        className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Confirmar pedido'}
      </button>

      <p className="text-[12px] leading-relaxed text-white/40">
        Coordinamos el pago contigo por WhatsApp. Los puntos se acreditan cuando el pago queda
        confirmado.
      </p>
    </div>
  );
}
