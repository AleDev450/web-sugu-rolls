'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Piezas compartidas por las pantallas del panel. */

export function Encabezado({
  titulo,
  bajada,
  accion,
}: {
  titulo: string;
  bajada?: string;
  accion?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        {bajada && <p className="mt-1.5 text-sm text-bone-dim">{bajada}</p>}
      </div>
      {accion}
    </header>
  );
}

export const claseCampo =
  'w-full rounded-xl border border-white/15 bg-night px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-sugu';

export function Campo({
  etiqueta,
  children,
  ancho = 'normal',
}: {
  etiqueta: string;
  children: ReactNode;
  ancho?: 'normal' | 'completo';
}) {
  return (
    <label className={`block ${ancho === 'completo' ? 'sm:col-span-2' : ''}`}>
      <span className="mb-2 block text-[13px] font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

export function Interruptor({
  activo,
  alCambiar,
  etiqueta,
}: {
  activo: boolean;
  alCambiar: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      onClick={() => alCambiar(!activo)}
      className="flex items-center gap-3"
      aria-pressed={activo}
    >
      <span
        className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
          activo ? 'bg-sugu' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
            activo ? 'left-6' : 'left-1'
          }`}
        />
      </span>
      <span className="text-[13px]">{etiqueta}</span>
    </button>
  );
}

/** Ventana modal para los formularios de alta y edición. */
export function Modal({
  abierto,
  titulo,
  alCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTecla);
      document.body.style.overflow = '';
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8">
      <div
        className="my-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-night-2 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <header className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button
            onClick={alCerrar}
            className="rounded-full border border-white/15 p-2 transition-colors hover:border-white/40"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/**
 * Confirmación para acciones que no se pueden deshacer. Obliga a teclear una
 * palabra: un "¿seguro?" con un solo clic se acepta sin leerlo, y aquí lo que
 * se borra no vuelve.
 */
export function ConfirmarPeligro({
  abierto,
  titulo,
  descripcion,
  palabra = 'BORRAR',
  textoBoton,
  trabajando = false,
  alCerrar,
  alConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion: ReactNode;
  palabra?: string;
  textoBoton: string;
  trabajando?: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (!abierto) setTexto('');
  }, [abierto]);

  return (
    <Modal abierto={abierto} titulo={titulo} alCerrar={alCerrar}>
      <div className="space-y-5 text-sm">
        <div className="rounded-xl border border-sugu/40 bg-sugu/10 p-4 leading-relaxed">
          {descripcion}
        </div>

        <label className="block">
          <span className="mb-2 block text-[13px]">
            Escribe <span className="font-mono font-bold text-sugu">{palabra}</span> para
            confirmar
          </span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={`${claseCampo} font-mono tracking-widest`}
            autoComplete="off"
          />
        </label>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={alCerrar} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={alConfirmar}
            disabled={texto.trim().toUpperCase() !== palabra || trabajando}
            className="btn-primary disabled:pointer-events-none disabled:opacity-40"
          >
            {trabajando ? 'Borrando…' : textoBoton}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Aviso({ tipo, texto }: { tipo: 'ok' | 'error'; texto: string }) {
  return (
    <p
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-[13px] ${
        tipo === 'ok'
          ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-400'
          : 'border-sugu/40 bg-sugu/10 text-sugu'
      }`}
    >
      {texto}
    </p>
  );
}

export function Cargando() {
  return <p className="py-16 text-center text-sm text-bone-dim">Cargando…</p>;
}
