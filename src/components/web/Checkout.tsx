'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { tiendaAbierta } from '@/lib/contenido';
import { useAjustes } from '@/lib/useAjustes';
import { adjuntarComprobante, crearPedido, miPerfil, type Perfil } from '@/lib/tienda';
import { campoClase } from './CuentaForms';

/**
 * Cierre del pedido dentro de la web.
 *
 * Exige cuenta: sin ella no hay a quién acreditarle los puntos. Crea el pedido
 * en estado "pendiente" y el cliente paga por fuera (Yape, transferencia o
 * efectivo); el local confirma el pago desde el panel, y ES ESA confirmación
 * la que acredita los puntos.
 */
export function Checkout() {
  const items = useCartStore((s) => s.items);
  const vaciar = useCartStore((s) => s.vaciar);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [listo, setListo] = useState(false);
  const [abierta, setAbierta] = useState<boolean | null>(null);
  const ajustes = useAjustes();
  const [abierto, setAbierto] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ id: string; numero: number } | null>(null);
  const [comprobante, setComprobante] = useState<'falta' | 'subiendo' | 'listo'>('falta');

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

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const { id, numero } = await crearPedido(
        // el id de línea puede llevar sufijo de presentación; se manda el
        // slug real y las piezas por separado
        items.map((i) => ({
          slug: i.slug,
          piezas: i.piezas,
          cantidad: i.cantidad,
          opciones: i.opciones,
        })),
        direccion,
        nota
      );
      setHecho({ id, numero });
      vaciar();
    } catch {
      setError('No se pudo registrar el pedido. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
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
          pagar hasta que le confirmamos el delivery.
        */}
        <div className="mt-4 border-t border-emerald-600/20 pt-4">
          {comprobante === 'listo' ? (
            <p className="font-semibold text-emerald-400">
              Comprobante recibido. Preparamos tu pedido.
            </p>
          ) : (
            <>
              <p className="font-semibold text-white">Adjunta tu Yape para continuar</p>
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

  if (!perfil) {
    return (
      <Link href="/cuenta" className="btn-primary w-full">
        Entra para pedir y ganar puntos
      </Link>
    );
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="btn-primary w-full">
        Hacer el pedido
      </button>
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
