'use client';

import { NIVELES, type Nivel, type Tarjeta } from '@/lib/tienda';

/**
 * Estilo de cada nivel. Se guarda aparte de la lógica para que cambiar el
 * aspecto de una tarjeta no obligue a tocar el cálculo de niveles.
 */
const ESTILO: Record<
  Nivel,
  { fondo: string; texto: string; tenue: string; borde: string; brillo: string }
> = {
  normal: {
    fondo: 'linear-gradient(135deg,#6b482c 0%,#3f2718 55%,#241409 100%)',
    texto: 'text-bone',
    tenue: 'text-bone-dim',
    borde: 'border-white/15',
    brillo: 'rgba(255,255,255,.10)',
  },
  oro: {
    fondo: 'linear-gradient(135deg,#f2c14e 0%,#b8801d 55%,#7a5310 100%)',
    texto: 'text-[#2a1a05]',
    tenue: 'text-[#5a3f0c]',
    borde: 'border-[#f7d98a]/60',
    brillo: 'rgba(255,255,255,.42)',
  },
  platino: {
    fondo: 'linear-gradient(135deg,#e9edf2 0%,#a9b4c2 55%,#6f7b8a 100%)',
    texto: 'text-[#1b2027]',
    tenue: 'text-[#3d4653]',
    borde: 'border-white/70',
    brillo: 'rgba(255,255,255,.55)',
  },
  black: {
    fondo: 'linear-gradient(135deg,#2b2b2f 0%,#131316 55%,#000 100%)',
    texto: 'text-white',
    tenue: 'text-white/55',
    borde: 'border-[#d4af37]/50',
    brillo: 'rgba(212,175,55,.28)',
  },
};

/**
 * Tarjeta de fidelidad del perfil.
 *
 * Muestra dos cifras que la gente confunde y conviene separar bien:
 * el SALDO es lo que puede canjear ahora; los GANADOS son de por vida y son
 * los que suben de nivel. Canjear gasta saldo y nunca baja de categoría.
 */
export function TarjetaSugu({ tarjeta, nombre }: { tarjeta: Tarjeta; nombre: string }) {
  const e = ESTILO[tarjeta.nivel];
  const meta = tarjeta.siguiente ? NIVELES[tarjeta.siguiente].desde : 0;
  const desde = NIVELES[tarjeta.nivel].desde;
  const avance = tarjeta.siguiente
    ? Math.min(100, Math.max(0, ((tarjeta.ganados - desde) / (meta - desde)) * 100))
    : 100;

  return (
    <div className={`overflow-hidden rounded-3xl border ${e.borde} shadow-2xl`}>
      <div className="relative p-7 sm:p-8" style={{ backgroundImage: e.fondo }}>
        {/* destello diagonal: lo que le da el aire de tarjeta física */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1/3 top-0 h-full w-2/3 -skew-x-12"
          style={{
            background: `linear-gradient(90deg,transparent,${e.brillo},transparent)`,
          }}
        />

        <header className="relative flex items-start justify-between gap-4">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${e.tenue}`}>
              Sugu Rolls
            </p>
            <p className={`mt-1 text-2xl font-extrabold tracking-tight ${e.texto}`}>
              {NIVELES[tarjeta.nivel].nombre}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${e.borde} ${e.tenue}`}
          >
            Socio
          </span>
        </header>

        <div className="relative mt-10">
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${e.tenue}`}>
            Puntos disponibles
          </p>
          <p className={`mt-1 text-5xl font-extrabold tabular-nums tracking-tight ${e.texto}`}>
            {tarjeta.saldo.toLocaleString('es')}
          </p>
        </div>

        <footer className={`relative mt-8 text-[13px] font-semibold ${e.texto}`}>
          {nombre}
        </footer>
      </div>

      <div className="bg-night-2 p-6">
        {tarjeta.siguiente ? (
          <>
            <div className="flex items-baseline justify-between gap-4 text-[13px]">
              <span className="text-bone-dim">
                Te faltan <b className="text-white">{tarjeta.faltan.toLocaleString('es')}</b> puntos
                para {NIVELES[tarjeta.siguiente].nombre}
              </span>
              <span className="flex-none tabular-nums text-bone-dim">
                {tarjeta.ganados.toLocaleString('es')} / {meta.toLocaleString('es')}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sugu transition-all duration-700"
                style={{ width: `${avance}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-bone-dim">
            Estás en el nivel más alto. Gracias por ser parte de Sugu Rolls.
          </p>
        )}

        <p className="mt-4 text-[12px] leading-relaxed text-white/40">
          El nivel se calcula con los puntos que has ganado en total, así que canjear nunca te baja
          de categoría.
        </p>
      </div>
    </div>
  );
}
