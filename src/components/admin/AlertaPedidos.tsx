'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing } from 'lucide-react';
import { getSupabase } from '@/lib/supabase/client';
import { useAvisosStore } from '@/store/useAvisosStore';

/** cada cuánto insiste el timbre mientras haya un pedido sin marcar "Recibido" */
const REPETIR_MS = 6000;

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
 * El timbre INSISTE cada pocos segundos mientras haya un pedido sin marcar
 * "Recibido" —antes sonaba una sola vez y era fácil que se perdiera entre el
 * ruido de la cocina—. Ese botón vive tanto en el aviso flotante como en la
 * tarjeta del pedido en /admin/pedidos (ver `useAvisosStore`), así que da
 * igual desde dónde lo confirme el admin: en cuanto lo hace, deja de sonar.
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
  const avisos = useAvisosStore((s) => s.avisos);
  const agregar = useAvisosStore((s) => s.agregar);
  const recibido = useAvisosStore((s) => s.recibido);
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
          agregar({
            id: fila.id,
            numero: fila.numero,
            total: Number(fila.total),
            nombre: fila.nombre,
          });
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

  /*
   * Insiste cada REPETIR_MS mientras quede al menos un pedido sin "Recibido".
   * Se apaga solo cuando `avisos` llega a cero, que es justo lo que hace ese
   * botón (acá o desde la tarjeta del pedido en /admin/pedidos).
   */
  useEffect(() => {
    if (avisos.length === 0) return;
    const t = setInterval(sonar, REPETIR_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisos.length]);

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
            <span className="flex h-10 w-10 flex-none animate-pulse items-center justify-center rounded-full bg-sugu/15 text-sugu">
              <BellRing className="h-5 w-5" />
            </span>
            {/*
              A propósito NO cierra el aviso: entrar a ver el pedido no es lo
              mismo que confirmar que ya se atendió, y el timbre debe seguir
              sonando hasta que se presione "Recibido" a propósito.
            */}
            <Link href="/admin/pedidos" className="min-w-0 flex-1">
              <p className="text-sm font-bold">¡Pedido nuevo! #{a.numero}</p>
              <p className="truncate text-[12px] text-bone-dim">
                {a.nombre || 'Cliente'} · {soles(a.total)}
              </p>
            </Link>
            <button
              onClick={() => recibido(a.id)}
              className="flex-none rounded-full border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-[12px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-600/20"
            >
              Recibido
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
