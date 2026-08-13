'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { crearPedido, miPerfil, type Perfil } from '@/lib/tienda';
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
  const [abierto, setAbierto] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ numero: number } | null>(null);

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
      const { numero } = await crearPedido(
        // el id de línea puede llevar sufijo de presentación; se manda el
        // slug real y las piezas por separado
        items.map((i) => ({ slug: i.slug, piezas: i.piezas, cantidad: i.cantidad })),
        direccion,
        nota
      );
      setHecho({ numero });
      vaciar();
    } catch {
      setError('No se pudo registrar el pedido. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (!listo) return null;

  if (hecho) {
    return (
      <div className="rounded-2xl border border-emerald-600/40 bg-emerald-600/10 p-5 text-[13px] leading-relaxed">
        <p className="font-bold text-emerald-400">Pedido #{hecho.numero} registrado</p>
        <p className="mt-2 text-bone-dim">
          Te escribiremos para coordinar el pago y la entrega. Tus puntos se acreditan en cuanto
          confirmemos el pago.
        </p>
        <Link href="/cuenta" className="mt-3 inline-block text-sugu underline underline-offset-4">
          Ver mis pedidos
        </Link>
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
