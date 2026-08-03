'use client';

import Image from 'next/image';
import { Crown, Gamepad2, Gift, Sparkles } from 'lucide-react';
import { NIVELES, ORDEN_NIVELES, numeroSocio, type Nivel, type Tarjeta } from '@/lib/tienda';

/**
 * Clase modificadora del acabado metálico. El fondo negro carbón es común a
 * todos los niveles (ver `.sugu-card` en globals.css): solo cambia el metal,
 * así subir de nivel se siente como el mismo carné con otro acabado.
 */
const METAL: Record<Nivel, string> = {
  bronce: '',
  plata: 'sugu-card--plata',
  oro: 'sugu-card--oro',
  platino: 'sugu-card--platino',
  black: 'sugu-card--black',
};

const BENEFICIOS = [
  { icono: Sparkles, texto: 'Acumulas puntos en cada pedido confirmado' },
  { icono: Gift, texto: 'Canjeas descuentos y productos del catálogo' },
  { icono: Gamepad2, texto: 'Códigos para jugar y entrar al ranking' },
];

/**
 * Carné del Sugu Club.
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
  const desde = NIVELES[tarjeta.nivel].desde;
  const meta = tarjeta.siguiente ? NIVELES[tarjeta.siguiente].desde : 0;
  const avance = tarjeta.siguiente
    ? Math.min(100, Math.max(0, ((tarjeta.ganados - desde) / (meta - desde)) * 100))
    : 100;

  return (
    <article
      className={`sugu-card ${METAL[tarjeta.nivel]} flex flex-col justify-between gap-8 p-6 sm:p-8`}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Image
            src="/imagenes/web/logo.webp"
            alt=""
            width={92}
            height={72}
            className="h-auto w-[68px] select-none sm:w-[86px]"
          />
          <span className="sugu-metal-tenue text-[11px] font-bold uppercase tracking-[0.32em] sm:text-[13px]">
            Sugu Club
          </span>
        </div>

        <div className="flex flex-none items-center gap-3">
          <span className="sugu-chip rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
            {NIVELES[tarjeta.nivel].nombre}
          </span>
          <Crown className="sugu-metal h-5 w-5" aria-hidden />
        </div>
      </header>

      <div className="flex items-center gap-5 sm:gap-7">
        {/* filete rojo: el único acento de color de la zona central */}
        <span aria-hidden className="h-16 w-1 flex-none rounded-full bg-sugu sm:h-20" />
        <div className="min-w-0">
          <p className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold leading-none tabular-nums text-bone sm:text-6xl">
              {tarjeta.saldo.toLocaleString('es')}
            </span>
            <span className="sugu-metal-tenue text-[10px] font-bold uppercase tracking-[0.24em] sm:text-[12px]">
              Puntos Sugu
            </span>
          </p>
          <p className="sugu-metal mt-3 truncate text-lg font-bold uppercase tracking-[0.12em] sm:text-xl">
            {nombre}
          </p>
        </div>
      </div>

      <footer className="sugu-hairline border-t pt-5">
        {tarjeta.siguiente ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[13px] text-bone-dim">
                Te faltan{' '}
                <b className="font-bold text-bone">{tarjeta.faltan.toLocaleString('es')}</b> puntos
                para {NIVELES[tarjeta.siguiente].nombre}
              </p>
              <p className="flex-none text-[13px] tabular-nums text-bone-dim">
                <b className="font-bold text-bone">{tarjeta.ganados.toLocaleString('es')}</b> /{' '}
                {meta.toLocaleString('es')}
              </p>
            </div>
            <div className="sugu-barra mt-3" role="presentation">
              <span style={{ width: `${avance}%` }} />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-bone-dim">
            Nivel máximo alcanzado. Gracias por ser parte de Sugu Rolls.
          </p>
        )}

        <p className="sugu-metal-tenue mt-4 text-right font-mono text-[11px] tracking-[0.22em]">
          {numeroSocio(socioId)}
        </p>
      </footer>
    </article>
  );
}

/** Panel compacto: nivel actual, la escalera completa y qué da ser socio. */
export function EstatusSocio({ tarjeta }: { tarjeta: Tarjeta }) {
  const actual = ORDEN_NIVELES.indexOf(tarjeta.nivel);

  return (
    <aside className="card flex h-full flex-col p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-bone-dim">Tu estatus</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-extrabold tracking-tight">{NIVELES[tarjeta.nivel].nombre}</p>
        <Crown className="h-5 w-5 flex-none text-sugu" aria-hidden />
      </div>
      <p className="mt-0.5 text-[12px] text-bone-dim">
        {tarjeta.ganados.toLocaleString('es')} puntos ganados en total
      </p>

      {/* la escalera entera: ver los cinco escalones es lo que da ganas de subir */}
      <ol className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
        {ORDEN_NIVELES.map((n, i) => (
          <li
            key={n}
            className={`flex items-center justify-between gap-3 text-[13px] ${
              i === actual ? 'sugu-nivel-activo font-bold text-bone' : 'text-bone-dim/55'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className="sugu-nivel-punto" />
              {NIVELES[n].nombre}
            </span>
            <span className="flex-none tabular-nums">{NIVELES[n].desde.toLocaleString('es')}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-bone-dim">
          Beneficios de ser socio
        </p>
        <ul className="mt-3 space-y-2.5">
          {BENEFICIOS.map(({ icono: Icono, texto }) => (
            <li key={texto} className="flex items-start gap-3 text-[12.5px] leading-snug text-bone-dim">
              <span className="mt-px grid h-7 w-7 flex-none place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
                <Icono className="h-3.5 w-3.5 text-sugu" aria-hidden />
              </span>
              {texto}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
