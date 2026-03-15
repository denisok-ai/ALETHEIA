'use client';

/**
 * Профессиональные абстрактные SVG-обложки для курсов и медиа.
 * Стиль: geometric abstraction — волны, сетки, морфинг-блобы, как в Dribbble/Behance EdTech.
 */

/* ── Курсы: 5 вариантов ── */
const COURSE_VARIANTS = [
  {
    id: 'indigo',
    c1: '#4F46E5', c2: '#7C3AED', c3: '#818CF8',
    bg: '#EEF2FF', blob1: '#C7D2FE', blob2: '#DDD6FE',
    accent: '#6366F1',
  },
  {
    id: 'violet',
    c1: '#7C3AED', c2: '#9333EA', c3: '#A78BFA',
    bg: '#F5F3FF', blob1: '#DDD6FE', blob2: '#EDE9FE',
    accent: '#8B5CF6',
  },
  {
    id: 'teal',
    c1: '#0D9488', c2: '#0891B2', c3: '#22D3EE',
    bg: '#F0FDFA', blob1: '#99F6E4', blob2: '#A5F3FC',
    accent: '#14B8A6',
  },
  {
    id: 'rose',
    c1: '#E11D48', c2: '#DB2777', c3: '#F472B6',
    bg: '#FFF1F2', blob1: '#FECDD3', blob2: '#FBCFE8',
    accent: '#F43F5E',
  },
  {
    id: 'amber',
    c1: '#D97706', c2: '#EA580C', c3: '#FBBF24',
    bg: '#FFFBEB', blob1: '#FDE68A', blob2: '#FED7AA',
    accent: '#F59E0B',
  },
];

export function CourseCoverPlaceholder({
  title,
  variant = 0,
  className = '',
}: {
  title?: string;
  variant?: number;
  className?: string;
}) {
  const v   = COURSE_VARIANTS[variant % COURSE_VARIANTS.length];
  const uid = `c${variant}`;
  const initials = title
    ? title.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <svg
      viewBox="0 0 320 180"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        {/* Основной градиент фона */}
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={v.bg} />
          <stop offset="100%" stopColor={v.blob1} stopOpacity="0.6" />
        </linearGradient>

        {/* Градиент для крупного блоба */}
        <radialGradient id={`blob-${uid}`} cx="70%" cy="20%" r="60%">
          <stop offset="0%"   stopColor={v.c1} stopOpacity="0.8" />
          <stop offset="50%"  stopColor={v.c2} stopOpacity="0.6" />
          <stop offset="100%" stopColor={v.c3} stopOpacity="0" />
        </radialGradient>

        {/* Градиент для маленького блоба */}
        <radialGradient id={`blob2-${uid}`} cx="20%" cy="80%" r="50%">
          <stop offset="0%"   stopColor={v.c2} stopOpacity="0.5" />
          <stop offset="100%" stopColor={v.c3} stopOpacity="0" />
        </radialGradient>

        {/* Фильтр blur */}
        <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`blur2-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>

        <clipPath id={`clip-${uid}`}>
          <rect width="320" height="180" />
        </clipPath>
      </defs>

      {/* Фон */}
      <rect width="320" height="180" fill={`url(#bg-${uid})`} />

      {/* Blurred orbs (как mesh-gradient) */}
      <g clipPath={`url(#clip-${uid})`}>
        <ellipse cx="260" cy="40"  rx="110" ry="90"
          fill={`url(#blob-${uid})`}  filter={`url(#blur-${uid})`} />
        <ellipse cx="60"  cy="145" rx="80"  ry="70"
          fill={`url(#blob2-${uid})`} filter={`url(#blur2-${uid})`} />
      </g>

      {/* Сетка-паттерн (тонкие линии) */}
      <g opacity="0.08" stroke={v.c1} strokeWidth="0.75">
        {[0,40,80,120,160,200,240,280,320].map((x) => (
          <line key={`vg-${x}`} x1={x} y1="0" x2={x} y2="180" />
        ))}
        {[0,36,72,108,144,180].map((y) => (
          <line key={`hg-${y}`} x1="0" y1={y} x2="320" y2={y} />
        ))}
      </g>

      {/* Декоративные кольца (геометрия) */}
      <circle cx="270" cy="25" r="55"
        fill="none" stroke={v.c1} strokeWidth="1.5" strokeOpacity="0.18"
        strokeDasharray="4 6" />
      <circle cx="270" cy="25" r="35"
        fill="none" stroke={v.c1} strokeWidth="1" strokeOpacity="0.22" />

      {/* Нижняя полоска-градиент */}
      <defs>
        <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={v.c1} stopOpacity="0.9" />
          <stop offset="60%"  stopColor={v.c2} stopOpacity="0.7" />
          <stop offset="100%" stopColor={v.c3} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="168" width="320" height="12" fill={`url(#bar-${uid})`} />

      {/* Крупный инициал — основной графический элемент */}
      <text
        x="24"
        y="148"
        fontFamily="'Outfit', 'Inter', system-ui, sans-serif"
        fontSize="96"
        fontWeight="900"
        fill={v.c1}
        fillOpacity="0.11"
        letterSpacing="-4"
      >
        {initials}
      </text>

      {/* Акцентная полоска + название (маленькое) */}
      <rect x="24" y="130" width="32" height="3" rx="2" fill={v.accent} fillOpacity="0.7" />
      <rect x="24" y="136" width="20" height="3" rx="2" fill={v.accent} fillOpacity="0.4" />
    </svg>
  );
}

/* ── Медиа: обложки по типу контента ── */
const MEDIA_PALETTES: Record<string, { c1: string; c2: string; bg: string; blob: string }> = {
  video: { c1: '#2563EB', c2: '#7C3AED', bg: '#EFF6FF', blob: '#BFDBFE' },
  pdf:   { c1: '#DC2626', c2: '#EA580C', bg: '#FFF5F5', blob: '#FECACA' },
  audio: { c1: '#059669', c2: '#0D9488', bg: '#F0FDF4', blob: '#A7F3D0' },
  image: { c1: '#7C3AED', c2: '#DB2777', bg: '#F5F3FF', blob: '#DDD6FE' },
};

function WavePattern({ color, uid }: { color: string; uid: string }) {
  return (
    <path
      d={`M0,120 C40,100 80,140 120,120 C160,100 200,140 240,120 C280,100 310,130 320,120 L320,180 L0,180 Z`}
      fill={color} fillOpacity="0.12" id={`wave-${uid}`}
    />
  );
}

export function MediaCoverPlaceholder({
  category,
  title,
  className = '',
}: {
  category?: string | null;
  title?: string;
  className?: string;
}) {
  const key = (category ?? 'image').toLowerCase();
  const p   = MEDIA_PALETTES[key] ?? MEDIA_PALETTES.image;
  const uid = `m-${key}`;

  const initials = title
    ? title.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'M';

  return (
    <svg
      viewBox="0 0 320 180"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id={`mbg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.bg} />
          <stop offset="100%" stopColor={p.blob} stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={`morb-${uid}`} cx="75%" cy="25%" r="55%">
          <stop offset="0%"   stopColor={p.c1} stopOpacity="0.6" />
          <stop offset="100%" stopColor={p.c2} stopOpacity="0" />
        </radialGradient>
        <filter id={`mblur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
        <clipPath id={`mclip-${uid}`}><rect width="320" height="180" /></clipPath>
      </defs>

      <rect width="320" height="180" fill={`url(#mbg-${uid})`} />

      <g clipPath={`url(#mclip-${uid})`}>
        <ellipse cx="270" cy="30" rx="120" ry="100"
          fill={`url(#morb-${uid})`} filter={`url(#mblur-${uid})`} />
      </g>

      {/* Сетка */}
      <g opacity="0.06" stroke={p.c1} strokeWidth="0.75">
        {[0,40,80,120,160,200,240,280,320].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="180" />
        ))}
        {[0,36,72,108,144,180].map((y) => (
          <line key={y} x1="0" y1={y} x2="320" y2={y} />
        ))}
      </g>

      <WavePattern color={p.c1} uid={uid} />

      {/* Центральная иконка типа */}
      <g transform="translate(130,52)" opacity="0.75">
        {key === 'video' && (
          <>
            <circle cx="30" cy="38" r="32" fill={p.c1} fillOpacity="0.12" />
            <circle cx="30" cy="38" r="22" fill={p.c1} fillOpacity="0.10" />
            <polygon points="20,24 20,52 48,38"
              fill={p.c1} fillOpacity="0.7" />
          </>
        )}
        {key === 'pdf' && (
          <>
            <rect x="4" y="2" width="44" height="58" rx="6"
              fill="none" stroke={p.c1} strokeWidth="2" strokeOpacity="0.5" />
            <path d="M30 2 L30 18 L48 18" fill="none" stroke={p.c1} strokeWidth="2" strokeOpacity="0.4" />
            <path d="M30 2 L48 18" fill={p.c1} fillOpacity="0.12" />
            {[26, 33, 40, 47].map((y, i) => (
              <rect key={y} x="10" y={y} width={i === 3 ? 18 : 28} height="2.5" rx="1.5"
                fill={p.c1} fillOpacity="0.5" />
            ))}
          </>
        )}
        {key === 'audio' && (
          <>
            <rect x="8" y="10" width="12" height="40" rx="6"
              fill={p.c1} fillOpacity="0.15" />
            {[-16,-8,0,8,16,24].map((dx, i) => {
              const h = [18, 30, 42, 34, 22, 14][i];
              return (
                <rect key={dx} x={24 + dx} y={38 - h / 2} width="6" height={h} rx="3"
                  fill={p.c1} fillOpacity="0.65" />
              );
            })}
          </>
        )}
        {(key === 'image' || !['video','pdf','audio'].includes(key)) && (
          <>
            <rect x="2" y="8" width="58" height="44" rx="6"
              fill="none" stroke={p.c1} strokeWidth="2" strokeOpacity="0.45" />
            <circle cx="18" cy="26" r="8"
              fill="none" stroke={p.c1} strokeWidth="2" strokeOpacity="0.5" />
            <path d="M2 40 L22 24 L38 36 L50 26 L60 36 L60 52 L2 52Z"
              fill={p.c1} fillOpacity="0.15" />
          </>
        )}
      </g>

      {/* Инициал */}
      <text x="22" y="152" fontFamily="system-ui" fontSize="88" fontWeight="900"
        fill={p.c1} fillOpacity="0.10" letterSpacing="-2">
        {initials}
      </text>

      <defs>
        <linearGradient id={`mbar-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={p.c1} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p.c2} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="169" width="320" height="11" fill={`url(#mbar-${uid})`} />
    </svg>
  );
}
