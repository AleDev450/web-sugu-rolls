'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { getSupabase } from '@/lib/supabase/client';

interface AvisoPedido {
  id: string;
  numero: number;
  total: number;
  nombre: string;
}

interface FilaOrder {
  id: string;
  numero: number;
  total: number | string;
  nombre: string;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Timbre + aviso flotante cuando entra un pedido nuevo, para que cocina se
 * entere sin depender de que el cliente llegue a enviar el WhatsApp (el
 * checkout solo ABRE WhatsApp con el mensaje listo; si el cliente cierra la
 * pestaña sin pulsar enviar, nunca llega).
 *
 * Vive en `AdminShell` —no en /admin/pedidos— para que suene sin importar en
 * qué pantalla del panel esté trabajando el admin.
 *
 * El timbre es un archivo (`/sonidos/aviso-pedido.wav`), no Web Audio
 * sintetizado en vivo: un `<audio>` que ya se "armó" con un gesto del
 * usuario sigue sonando en pestañas en segundo plano —por ejemplo, la
 * tablet de cocina con otra pestaña de YouTube encima— de forma mucho más
 * confiable que un AudioContext, que los navegadores suspenden agresivamente
 * en cuanto la pestaña deja de estar activa.
 */
export function AlertaPedidos() {
  const [avisos, setAvisos] = useState<AvisoPedido[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const armado = useRef(false);
  const tituloOriginal = useRef('');
  const parpadeo = useRef<ReturnType<typeof setInterval> | null>(null);

  /*
   * "Arma" el audio con el primer gesto de la pestaña: los navegadores no
   * dejan reproducir sonido sin que haya habido antes un clic o tecla. Se
   * reproduce mudo un instante y se pausa —no hace falta que se oiga— solo
   * para que el elemento quede desbloqueado y el `.play()` de verdad, cuando
   * llegue un pedido, no dependa de otro gesto (ni de que la pestaña esté al
   * frente).
   */
  useEffect(() => {
    audioRef.current = new Audio('/sonidos/aviso-pedido.wav');
    audioRef.current.preload = 'auto';

    const desbloquear = () => {
      if (armado.current || !audioRef.current) return;
      const a = audioRef.current;
      const volumenOriginal = a.volume;
      a.volume = 0;
      a
        .play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = volumenOriginal;
          armado.current = true;
        })
        .catch(() => {
          // el navegador lo rechazó igual; se reintenta con el próximo gesto
          a.volume = volumenOriginal;
        });
    };
    window.addEventListener('pointerdown', desbloquear);
    window.addEventListener('keydown', desbloquear);
    return () => {
      window.removeEventListener('pointerdown', desbloquear);
      window.removeEventListener('keydown', desbloquear);
    };
  }, []);

  // notificación del sistema operativo cuando la pestaña está en segundo plano
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  const sonar = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {
      // sin gesto previo el navegador puede seguir negándolo; el aviso
      // visual y la notificación del sistema quedan como respaldo
    });
  };

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    tituloOriginal.current = document.title;

    const canal = sb
      .channel('pedidos-nuevos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const fila = payload.new as FilaOrder;
          setAvisos((prev) => [
            ...prev,
            { id: fila.id, numero: fila.numero, total: Number(fila.total), nombre: fila.nombre },
          ]);
          sonar();

          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.visibilityState !== 'visible'
          ) {
            new Notification('Pedido nuevo — Sugu Rolls', {
              body: `#${fila.numero} · ${fila.nombre}`,
              tag: `pedido-${fila.id}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(canal);
    };
  }, []);

  // el título de la pestaña parpadea mientras haya avisos sin cerrar
  useEffect(() => {
    if (avisos.length === 0) {
      if (parpadeo.current) clearInterval(parpadeo.current);
      document.title = tituloOriginal.current || document.title;
      return;
    }
    let mostrarAviso = true;
    parpadeo.current = setInterval(() => {
      document.title = mostrarAviso
        ? `🔴 (${avisos.length}) Pedido nuevo`
        : tituloOriginal.current;
      mostrarAviso = !mostrarAviso;
    }, 1000);
    return () => {
      if (parpadeo.current) clearInterval(parpadeo.current);
    };
  }, [avisos.length]);

  const cerrar = (id: string) => setAvisos((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2.5">
      <AnimatePresence>
        {avisos.map((a) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-sugu/40 bg-night-2 p-4 shadow-2xl shadow-black/40"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sugu/15 text-sugu">
              <Bell className="h-5 w-5" />
            </span>
            <Link
              href="/admin/pedidos"
              onClick={() => cerrar(a.id)}
              className="min-w-0 flex-1"
            >
              <p className="text-sm font-bold">¡Pedido nuevo! #{a.numero}</p>
              <p className="truncate text-[12px] text-bone-dim">
                {a.nombre || 'Cliente'} · {soles(a.total)}
              </p>
            </Link>
            <button
              onClick={() => cerrar(a.id)}
              className="flex-none rounded-full p-1.5 text-bone-dim transition-colors hover:text-sugu"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
