'use client';

import { useState, type CSSProperties } from 'react';
import { BT21, bt21ById, type Bt21Id } from '@/game/config/bt21';
import { VIP } from '@/game/config/vip';
import { assetUrl } from '@/game/assets/manifest';
import { useVipStore, type VipEffects } from '@/store/useVipStore';
import { TierImage } from './TierImage';

/**
 * Capa DOM de los clientes VIP: cliente que entra caminando con su pedido,
 * fila de colección (los 7 BT21), chips de poderes activos, toast del poder
 * y banner del BTS Festival. Todo es `pointer-events: none` — el dedo sigue
 * apuntando al tablero aunque pase por encima.
 *
 * La lógica vive en VipDirector; aquí SOLO se dibuja useVipStore.
 */

function Bt21Face({
  id,
  size,
  className,
}: {
  id: Bt21Id;
  size: number;
  className?: string;
}) {
  const c = bt21ById(id);
  const [broken, setBroken] = useState(false);

  if (broken) {
    // sin imagen: moneda del color del personaje con su inicial
    return (
      <span
        className={`bt21-fallback ${className ?? ''}`}
        style={{ width: size, height: size, background: c.color }}
      >
        {c.name[0]}
      </span>
    );
  }
  return (
    <img
      className={className}
      src={assetUrl('bt21', c.sprite)}
      alt={c.name}
      width={size}
      height={size}
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

/** Cliente actual: entra, espera con su globo de pedido y se va feliz/triste. */
function Walker() {
  const visit = useVipStore((s) => s.visit);
  if (!visit) return null;

  const char = bt21ById(visit.charId);
  const pct = Math.max(0, Math.min(100, (visit.remainingMs / visit.waitMs) * 100));
  const low = visit.remainingMs < visit.waitMs * 0.25;
  const vars = {
    '--enter-ms': `${VIP.enterMs}ms`,
    '--leave-ms': `${VIP.leaveMs}ms`,
  } as CSSProperties;

  return (
    <div key={visit.seq} className={`vip-walker ${visit.phase}`} style={vars}>
      {(visit.phase === 'enter' || visit.phase === 'waiting') && (
        <div className="vip-bubble">
          <TierImage tier={visit.tier} size={30} className="vip-bubble-food" />
          <div className="vip-timer">
            <div
              className={`vip-timer-fill${low ? ' low' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      {visit.phase === 'happy' && <div className="vip-emote">💜</div>}
      {visit.phase === 'sad' && <div className="vip-emote">💧</div>}
      <Bt21Face id={visit.charId} size={72} className="vip-face" />
      <div className="vip-name">{char.name}</div>
    </div>
  );
}

/** Fila de colección: los 7, en gris hasta ser atendidos. */
function Collection() {
  const served = useVipStore((s) => s.served);
  const festival = useVipStore((s) => s.festivalActive);

  return (
    <div className={`vip-collection${festival ? ' festival' : ''}`}>
      {BT21.map((c) => {
        const ok = served.includes(c.id);
        return (
          <div key={c.id} className={`vip-coin${ok ? ' served' : ''}`} title={c.name}>
            <Bt21Face id={c.id} size={28} />
            {ok && <span className="vip-check">✓</span>}
          </div>
        );
      })}
    </div>
  );
}

const EFFECT_CHIPS: { key: keyof VipEffects; charId: Bt21Id; label: string }[] = [
  { key: 'koya', charId: 'koya', label: 'LENTO' },
  { key: 'rj', charId: 'rj', label: '×2' },
  { key: 'fever', charId: 'tata', label: 'FEVER' },
  { key: 'van', charId: 'van', label: 'PULSO' },
];

/** Chips con la cuenta atrás de los poderes temporales. */
function Chips() {
  const effects = useVipStore((s) => s.effects);
  const active = EFFECT_CHIPS.filter((e) => effects[e.key] > 0);
  if (active.length === 0) return null;

  return (
    <div className="vip-chips">
      {active.map((e) => (
        <div key={e.key} className="vip-chip">
          <Bt21Face id={e.charId} size={22} />
          <span>
            {e.label} · {effects[e.key]}s
          </span>
        </div>
      ))}
    </div>
  );
}

/** Toast del poder recién activado (se desvanece solo por CSS). */
function PowerToast() {
  const toast = useVipStore((s) => s.powerToast);
  if (!toast) return null;
  const char = bt21ById(toast.charId);

  return (
    <div key={toast.at} className="power-toast" style={{ borderColor: char.color }}>
      <Bt21Face id={toast.charId} size={64} className="power-toast-face" />
      <div className="power-toast-text">
        <span className="power-toast-char">{char.name}</span>
        <span className="power-toast-name">{toast.text}</span>
      </div>
    </div>
  );
}

/** Banner + cuenta atrás del BTS Festival. */
function FestivalBanner() {
  const active = useVipStore((s) => s.festivalActive);
  const ms = useVipStore((s) => s.festivalRemainingMs);
  if (!active) return null;

  return (
    <div className="festival-banner">
      <span className="festival-title">💜 BTS FESTIVAL 💜</span>
      <span className="festival-count">PUNTOS ×2 · {Math.ceil(ms / 1000)}s</span>
    </div>
  );
}

export function VipBar() {
  return (
    <>
      <div className="vip-bar">
        <Walker />
        <Collection />
      </div>
      <Chips />
      <PowerToast />
      <FestivalBanner />
    </>
  );
}
