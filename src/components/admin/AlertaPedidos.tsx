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
 * El timbre se sintetiza con Web Audio (dos tonos), sin archivo de audio: así
 * no depende de un asset que alguien puede borrar sin darse cuenta.
 */
export function AlertaPedidos() {
  const [avisos, setAvisos] = useState<AvisoPedido[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tituloOriginal = useRef('');
  const parpadeo = useRef<ReturnType<typeof setInterval> | null>(null);

  /*
   * Los navegadores bloquean el audio hasta que hay un gesto del usuario. El
   * admin ya hizo clic para entrar al panel, pero por si esta es la primera
   * interacción de la pestaña, se deja el contexto listo (o se reanuda) con
   * el primer clic o tecla que llegue.
   */
  useEffect(() => {
    const desbloquear = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      } else if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }
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
    const ctx = audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());
    if (ctx.state === 'suspended') void ctx.resume();

    // dos tonos ascendentes tipo timbre — nada de reproducir un archivo
    for (const [i, freq] of [880, 1318.5].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.35, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.35);
    }
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
