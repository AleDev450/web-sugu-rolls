'use client';

import { Crown, Gift, Sparkles, Ticket } from 'lucide-react';
import { NIVELES, ORDEN_NIVELES, numeroSocio, type Nivel, type Tarjeta } from '@/lib/tienda';

/**
 * Aspecto de cada nivel, separado de la lógica para que retocar el diseño no
 * obligue a tocar el cálculo.
 *
 * La progresión es cromática y se lee sin explicaciones: cobre -> acero ->
 * oro -> platino helado -> negro. Plata y platino se distinguen por
 * temperatura (gris cálido contra blanco azulado), que es lo que evita que
 * parezcan el mismo nivel.
 */
const ESTILO: Record<
  Nivel,
  { fondo: string; texto: string; tenue: string; linea: string; sello: string; brillo: string }
> = {
  bronce: {
    fondo: 'linear-gradient(135deg,#a9703f 0%,#6d4423 52%,#3a2313 100%)',
    texto: 'text-[#fdf1e3]',
    tenue: 'text-[#f0d5b8]/70',
    linea: 'border-[#e0a468]/40',
    sello: '#e8b177',
    brillo: 'rgba(255,226,190,.30)',
  },
  plata: {
    fondo: 'linear-gradient(135deg,#dfe5ec 0%,#98a3b0 52%,#5f6975 100%)',
    texto: 'text-[#1b2027]',
    tenue: 'text-[#39424e]',
    linea: 'border-white/60',
    sello: '#2b333d',
    brillo: 'rgba(255,255,255,.55)',
  },
  oro: {
    fondo: 'linear-gradient(135deg,#f7dc94 0%,#d3a12b 52%,#7d5711 100%)',
    texto: 'text-[#2b1c04]',
    tenue: 'text-[#5b4110]',
    linea: 'border-[#fff0bd]/70',
    sello: '#4a3308',
    brillo: 'rgba(255,255,255,.5)',
  },
  platino: {
    fondo: 'linear-gradient(135deg,#ffffff 0%,#dbe6f2 48%,#9db2c9 100%)',
    texto: 'text-[#141b24]',
    tenue: 'text-[#33414f]',
    linea: 'border-white',
    sello: '#22303d',
    brillo: 'rgba(255,255,255,.85)',
  },
  black: {
    fondo: 'linear-gradient(135deg,#33333a 0%,#141418 52%,#000000 100%)',
    texto: 'text-white',
    tenue: 'text-white/55',
    linea: 'border-[#d4af37]/50',
    sello: '#d4af37',
    brillo: 'rgba(212,175,55,.30)',
  },
};

const BENEFICIOS = [
  { icono: Sparkles, texto: 'Acumulas puntos en cada pedido confirmado' },
  { icono: Gift, texto: 'Canjeas descuentos y productos del catálogo' },
  { icono: Ticket, texto: 'Códigos para jugar y entrar al ranking' },
];

/**
 * Tarjeta del Sugu Club.
 *
 * Muestra dos cifras que la gente confunde y conviene separar: el SALDO es lo
 * que puede canjear ahora; los GANADOS son de por vida y son los que suben de
 * nivel. Canjear gasta saldo y nunca baja de categoría.
 */
export function TarjetaSugu({
  tarjeta,
  nombre,
  socioId,
}: {
  tarjeta: Tarjeta;
  nombre: string;
  socioId: string;
}) {
  const e = ESTILO[tarjeta.nivel];
  const desde = NIVELES[tarjeta.nivel].desde;
  const meta = tarjeta.siguiente ? NIVELES[tarjeta.siguiente].desde : 0;
  const avance = tarjeta.siguiente
    ? Math.min(100, Math.max(0, ((tarjeta.ganados - desde) / (meta - desde)) * 100))
    : 100;

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border ${e.linea} p-7 shadow-2xl sm:p-8`}
      style={{ backgroundImage: e.fondo, aspectRatio: '1.62 / 1' }}
    >
      {/* destello diagonal: lo que le da el aire de tarjeta física */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-0 h-full w-1/2 -skew-x-12"
        style={{ background: `linear-gradient(90deg,transparent,${e.brillo},transparent)` }}
      />

      <div className="relative flex h-full flex-col justify-between">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.3em] ${e.tenue}`}>
              Sugu Club
            </p>
            <p className={`mt-1.5 text-3xl font-extrabold tracking-tight ${e.texto}`}>
              {NIVELES[tarjeta.nivel].nombre}
            </p>
          </div>
          <Crown className="h-7 w-7 flex-none" style={{ color: e.sello }} />
        </header>

        <div>
          <div className="flex items-end gap-3">
            <p className={`text-5xl font-extrabold leading-none tabular-nums ${e.texto}`}>
              {tarjeta.saldo.toLocaleString('es')}
            </p>
            <p className={`pb-1 text-[11px] font-bold uppercase tracking-[0.2em] ${e.tenue}`}>
              Puntos
            </p>
          </div>

          <div className={`mt-5 border-t pt-4 ${e.linea}`}>
            {tarjeta.siguiente ? (
              <>
                <div className={`flex items-baseline justify-between gap-3 text-[12px] ${e.tenue}`}>
                  <span>
                    Te faltan{' '}
                    <b className={e.texto}>{tarjeta.faltan.toLocaleString('es')}</b> para{' '}
                    {NIVELES[tarjeta.siguiente].nombre}
                  </span>
                  <span className="flex-none tabular-nums">
                    {tarjeta.ganados.toLocaleString('es')}/{meta.toLocaleString('es')}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${avance}%`, background: e.sello }}
                  />
                </div>
              </>
            ) : (
              <p className={`text-[12px] ${e.tenue}`}>
                Nivel máximo alcanzado. Gracias por ser parte de Sugu Rolls.
              </p>
            )}
          </div>

          <footer className="mt-4 flex items-end justify-between gap-4">
            <p className={`truncate text-[13px] font-bold uppercase tracking-wide ${e.texto}`}>
              {nombre}
            </p>
            <p className={`flex-none font-mono text-[11px] tracking-widest ${e.tenue}`}>
              {numeroSocio(socioId)}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

/** Panel lateral: nivel actual, escalera completa y qué da ser socio. */
export function EstatusSocio({ tarjeta }: { tarjeta: Tarjeta }) {
  const actual = ORDEN_NIVELES.indexOf(tarjeta.nivel);

  return (
    <div className="card flex h-full flex-col p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-bone-dim">Tu estatus</p>

      <p className="mt-3 text-3xl font-extrabold tracking-tight">
        {NIVELES[tarjeta.nivel].nombre}
      </p>
      <p className="mt-1 text-[13px] text-bone-dim">
        {tarjeta.ganados.toLocaleString('es')} puntos ganados en total
      </p>

      {/* la escalera completa: ver los cinco niveles es lo que da ganas de subir */}
      <ol className="mt-6 space-y-2.5">
        {ORDEN_NIVELES.map((n, i) => {
          const alcanzado = i <= actual;
          return (
            <li
              key={n}
              className={`flex items-center justify-between gap-3 text-[13px] ${
                alcanzado ? 'text-white' : 'text-bone-dim/60'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: alcanzado ? ESTILO[n].sello : 'rgba(255,255,255,.18)' }}
                />
                <span className={i === actual ? 'font-bold' : ''}>{NIVELES[n].nombre}</span>
              </span>
              <span className="flex-none tabular-nums">
                {NIVELES[n].desde.toLocaleString('es')}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 border-t border-white/10 pt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-bone-dim">
          Beneficios de ser socio
        </p>
        <ul className="mt-4 space-y-3">
          {BENEFICIOS.map(({ icono: Icono, texto }) => (
            <li key={texto} className="flex items-start gap-3 text-[13px] text-bone-dim">
              <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg bg-sugu/10">
                <Icono className="h-3.5 w-3.5 text-sugu" />
              </span>
              {texto}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-white/35">
        El nivel se calcula con los puntos que has ganado en total, así que canjear nunca te baja
        de categoría.
      </p>
    </div>
  );
}
