'use client';

import Image from 'next/image';
import { useState, useCallback, useId } from 'react';
import { BRAND_LOGO_PATHS, BRAND_SITE_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  className?: string;
  imgClassName?: string;
  /**
   * true — рядом уже есть видимое название или aria-label у ссылки; не дублируем имя в дереве доступности.
   */
  withVisibleBrandText?: boolean;
  /**
   * Убрать светлую/белую подложку у PNG без mix-blend: альфа = 1 − яркость (Rec. 709).
   * Светлые детали самого знака слегка теряют непрозрачность — при идеальном PNG с альфой задайте false.
   */
  knockout?: boolean;
  priority?: boolean;
  /** Высота логотипа в rem (ширина подстраивается, object-contain). */
  heightClass?: string;
};

export function BrandLogo({
  className,
  imgClassName,
  withVisibleBrandText = false,
  knockout = true,
  priority = false,
  heightClass = 'h-[4.4375rem]',
}: BrandLogoProps) {
  const [pathIndex, setPathIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const reactId = useId().replace(/:/g, '');
  const filterId = `brand-logo-knockout-${reactId}`;

  const handleError = useCallback(() => {
    setPathIndex((i) => {
      if (i + 1 < BRAND_LOGO_PATHS.length) return i + 1;
      setFailed(true);
      return i;
    });
  }, []);

  if (failed) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-plum font-heading text-lg font-bold text-white',
          heightClass,
          'aspect-square max-h-[4.4375rem] min-w-[3.25rem]',
          className
        )}
        aria-hidden
      >
        А
      </span>
    );
  }

  const src = BRAND_LOGO_PATHS[pathIndex];

  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      {knockout ? (
        <svg
          width={0}
          height={0}
          className="pointer-events-none absolute overflow-hidden"
          style={{ width: 0, height: 0 }}
          aria-hidden
        >
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB">
              {/* RGB без изменений; A' = A − luminance(R,G,B) → белый фон становится прозрачным, цвета сохраняются лучше, чем при multiply */}
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.2126 -0.7152 -0.0722 1 0"
              />
            </filter>
          </defs>
        </svg>
      ) : null}
      <Image
        key={src}
        src={src}
        alt=""
        width={256}
        height={256}
        priority={priority}
        className={cn(
          heightClass,
          'w-auto max-w-[min(100%,5.75rem)] object-contain object-center sm:max-w-[6rem]',
          imgClassName
        )}
        style={knockout ? { filter: `url(#${filterId})` } : undefined}
        onError={handleError}
      />
      {!withVisibleBrandText ? <span className="sr-only">{BRAND_SITE_NAME}</span> : null}
    </span>
  );
}
