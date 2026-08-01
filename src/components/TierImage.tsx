'use client';

import { useEffect, useState } from 'react';
import { TIERS } from '@/game/config/tiers';
import { renderTierCanvas } from '@/game/art/procedural';
import { assetUrl } from '@/game/assets/manifest';

/**
 * Miniatura de un tier para la UI de React (no Pixi).
 * Intenta el PNG real y, si no existe, cae al placeholder procedural.
 */
export function TierImage({
  tier,
  size = 44,
  className,
}: {
  tier: number;
  size?: number;
  className?: string;
}) {
  const t = TIERS[tier];
  const [src, setSrc] = useState(assetUrl('sushi', t.sprite));

  useEffect(() => {
    setSrc(assetUrl('sushi', TIERS[tier].sprite));
  }, [tier]);

  return (
    <img
      className={className}
      src={src}
      alt={t.name}
      width={size}
      height={size}
      draggable={false}
      onError={() => {
        const fallback = renderTierCanvas(tier, 90).toDataURL();
        setSrc((cur) => (cur === fallback ? cur : fallback));
      }}
    />
  );
}
