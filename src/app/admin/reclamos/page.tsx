'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Mail, Phone } from 'lucide-react';
import {
  listarReclamos,
  responderReclamo,
  type EstadoReclamo,
  type ReclamoAdmin,
} from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';

const FILTROS: { valor: EstadoReclamo | 'todos'; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'respondido', texto: 'Respondidos' },
  { valor: 'cerrado', texto: 'Cerrados' },
];

const COLOR_ESTADO: Record<EstadoReclamo, string> = {
  pendiente: 'bg-amber-500/20 text-amber-400',
  respondido: 'bg-emerald-500/20 text-emerald-400',
  cerrado: 'bg-white/10 text-bone-dim',
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { dateStyle: 'medium' }) : '—';

/** Días que faltan para el vencimiento legal. Negativo = ya se pasó. */
function diasRestantes(vence: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${vence}T00:00:00`).getTime() - hoy.getTime()) / 86_400_000);
}

/**
 * Libro de Reclamaciones.
 *
 * Los reclamos no se pueden editar ni borrar: la ley obliga a conservarlos
 * íntegros. Aquí solo se leen y se les añade la respuesta del proveedor.
 *
 * El plazo legal es de 30 días calendario, así que la lista avisa cuando uno
 * está a punto de vencer — que es el error caro de verdad.
 */
export default function ReclamosAdmin() {
  const [items, setItems] = useState<ReclamoAdmin[] | null>(null);
  const [filtro, setFiltro] = useState<EstadoReclamo | 'todos'>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      setItems(await listarReclamos());
    } catch (e) {
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const visibles = useMemo(
    () => (items ?? []).filter((r) => filtro === 'todos' || r.estado === filtro),
    [items, filtro]
  );

  const pendientes = (items ?? []).filter((r) => r.estado === 'pendiente').length;

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Libro de Reclamaciones"
        bajada={
          pendientes > 0
            ? `${pendientes} sin responder. El plazo legal es de 30 días calendario desde el registro.`
            : 'Todo respondido. Los reclamos se conservan y no se pueden borrar.'
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const n =
            f.valor === 'todos'
              ? items.length
              : items.filter((r) => r.estado === f.valor).length;
          return (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                filtro === f.valor
                  ? 'bg-sugu text-white'
                  : 'border border-white/12 text-bone-dim hover:border-white/30'
              }`}
            >
              {f.texto} <span className="opacity-60">({n})</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="card p-16 text-center text-sm text-bone-dim">
          {items.length === 0
            ? 'Todavía no hay reclamos registrados.'
            : 'No hay reclamos con ese estado.'}
        </p>
      ) : (
        <div className="grid gap-4">
          {visibles.map((r) => (
            <Hoja
              key={r.id}
              reclamo={r}
              abierta={abierto === r.id}
              alAbrir={() => setAbierto(abierto === r.id ? null : r.id)}
              alGuardar={async (respuesta, estado) => {
                try {
                  await responderReclamo(r.id, respuesta, estado);
                  setAviso({ tipo: 'ok', texto: `Hoja ${r.numero} actualizada.` });
                  await cargar();
                } catch (e) {
                  setAviso({ tipo: 'error', texto: (e as Error).message });
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Hoja({
  reclamo: r,
  abierta,
  alAbrir,
  alGuardar,
}: {
  reclamo: ReclamoAdmin;
  abierta: boolean;
  alAbrir: () => void;
  alGuardar: (respuesta: string, estado: EstadoReclamo) => Promise<void>;
}) {
  const [respuesta, setRespuesta] = useState(r.respuesta ?? '');
  const [guardando, setGuardando] = useState(false);

  const dias = diasRestantes(r.vence);
  const urge = r.estado === 'pendiente' && dias <= 7;

  const guardar = async (estado: EstadoReclamo) => {
    setGuardando(true);
    await alGuardar(respuesta, estado);
    setGuardando(false);
  };

  return (
    <article className="card overflow-hidden">
      <button
        onClick={alAbrir}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sugu/10">
          <BookOpen className="h-4 w-4 text-sugu" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-bone-dim">
              #{String(r.numero).padStart(6, '0')}
            </span>
            <span className="font-bold">{r.nombre}</span>
          </p>
          <p className="mt-1 line-clamp-1 text-[13px] text-bone-dim">{r.detalle}</p>

          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase">
            <span className={`rounded-full px-2.5 py-1 ${COLOR_ESTADO[r.estado]}`}>{r.estado}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-bone-dim">{r.tipo}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-bone-dim">
              {fecha(r.creado)}
            </span>
            {urge && (
              <span className="rounded-full bg-sugu/20 px-2.5 py-1 text-sugu">
                {dias < 0
                  ? `Vencido hace ${Math.abs(dias)} d.`
                  : dias === 0
                    ? 'Vence hoy'
                    : `Vence en ${dias} d.`}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 flex-none text-bone-dim transition-transform ${abierta ? 'rotate-180' : ''}`}
        />
      </button>

      {abierta && (
        <div className="border-t border-white/10 p-5 sm:p-7">
          <Grupo titulo="Consumidor">
            <Dato etiqueta="Nombre" valor={r.nombre} />
            <Dato etiqueta="Documento" valor={`${r.tipo_documento} ${r.documento}`} />
            <Dato etiqueta="Domicilio" valor={r.domicilio} />
            <Dato etiqueta="Correo" valor={r.correo} enlace={`mailto:${r.correo}`} icono={Mail} />
            <Dato
              etiqueta="Teléfono"
              valor={r.telefono}
              enlace={`tel:${r.telefono.replace(/\s/g, '')}`}
              icono={Phone}
            />
            {r.menor_edad && <Dato etiqueta="Apoderado" valor={r.apoderado ?? '—'} />}
          </Grupo>

          <Grupo titulo="Bien contratado">
            <Dato etiqueta="Tipo" valor={r.tipo_bien} />
            <Dato
              etiqueta="Monto reclamado"
              valor={
                r.monto === null
                  ? 'No indicado'
                  : `${r.moneda === 'USD' ? 'US$' : 'S/'} ${Number(r.monto).toFixed(2)}`
              }
            />
            <Dato etiqueta="Local" valor={r.local} />
            <Dato etiqueta="Canal" valor={r.canal} />
            <Dato etiqueta="Descripción" valor={r.bien_detalle} ancho="completo" />
          </Grupo>

          <Grupo titulo={r.tipo === 'queja' ? 'Queja' : 'Reclamo'}>
            <Dato etiqueta="Fecha del pedido" valor={fecha(r.fecha_pedido)} />
            <Dato etiqueta="Número de pedido" valor={r.numero_pedido || '—'} />
            <Dato etiqueta="Detalle" valor={r.detalle} ancho="completo" />
            <Dato etiqueta="Pedido del consumidor" valor={r.pedido_cliente} ancho="completo" />
          </Grupo>

          <div className="mt-7 border-t border-white/10 pt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-bold">Respuesta</h3>
              <span className={`text-[12px] ${dias < 0 ? 'text-sugu' : 'text-bone-dim'}`}>
                Plazo legal: {fecha(r.vence)}
                {r.respondido_at && ` · respondido el ${fecha(r.respondido_at)}`}
              </span>
            </div>

            <textarea
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={6}
              placeholder="Escribe la respuesta que le vas a dar al consumidor y envíasela por correo."
              className="w-full rounded-xl border border-white/10 bg-night px-4 py-3 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-white/25 focus:border-sugu"
            />

            {/*
              Guardar aquí NO le avisa al consumidor: deja constancia interna.
              El correo se manda a mano, por eso el botón abre el cliente ya
              relleno con el número de hoja.
            */}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => void guardar('respondido')}
                disabled={guardando || !respuesta.trim()}
                className="btn-primary disabled:pointer-events-none disabled:opacity-40"
              >
                {guardando ? 'Guardando…' : 'Guardar como respondido'}
              </button>

              <a
                href={`mailto:${r.correo}?subject=${encodeURIComponent(
                  `Respuesta a tu reclamo #${String(r.numero).padStart(6, '0')} · Sugu Rolls`
                )}&body=${encodeURIComponent(
                  `Hola ${r.nombre}:\n\n${respuesta}\n\nSugu Rolls`
                )}`}
                className="btn-ghost"
              >
                <Mail className="h-4 w-4" />
                Enviar por correo
              </a>

              {r.estado !== 'cerrado' && (
                <button
                  onClick={() => void guardar('cerrado')}
                  disabled={guardando}
                  className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
                >
                  Cerrar caso
                </button>
              )}
            </div>

            <p className="mt-3 text-[11px] text-white/35">
              Guardar deja constancia en el libro, pero no le escribe al consumidor. Usa el botón
              de correo para responderle.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
        {titulo}
      </h3>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Dato({
  etiqueta,
  valor,
  ancho = 'medio',
  enlace,
  icono: Icono,
}: {
  etiqueta: string;
  valor: string;
  ancho?: 'medio' | 'completo';
  enlace?: string;
  icono?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={ancho === 'completo' ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-widest text-white/35">{etiqueta}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">
        {enlace ? (
          <a
            href={enlace}
            className="inline-flex items-center gap-2 transition-colors hover:text-sugu"
          >
            {Icono && <Icono className="h-3.5 w-3.5" />}
            {valor}
          </a>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}
