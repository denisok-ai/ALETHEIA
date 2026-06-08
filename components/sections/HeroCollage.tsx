'use client';

import Image from 'next/image';

/** Единый коллаж героя: крупный кадр «двое / руки» + два детальных кадра (O‑кольцо, работа на руке). */
const HERO_COLLAGE = {
  src: '/images/hero/collage-hero-unified.png',
  alt: 'Практика мышечного тестирования и кинезиологии AVATERRA: сессия, жест O‑кольцо, работа с руками',
} as const;

const SIZES = '(max-width: 640px) 90vw, (max-width: 1024px) 400px, 440px';

export function HeroCollage() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <Image
        src={HERO_COLLAGE.src}
        alt={HERO_COLLAGE.alt}
        fill
        className="object-cover object-center"
        sizes={SIZES}
        priority
      />
    </div>
  );
}
