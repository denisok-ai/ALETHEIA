# Генерация изображений для AVATERRA

Промпты для Midjourney / DALL-E 3 / Stable Diffusion.  
Цветовая палитра: **#2D1B4E** (purple), **#0A0E27** (dark blue), **#D4AF37** (gold).

---

## Рекомендации по генерации

| Параметр | Значение |
|----------|----------|
| **Формат** | WebP для веба (конвертировать после генерации) |
| **Hero** | 1920×1080 px |
| **Иконки** | 512×512 px |
| **Декор** | 1024×1024 px |
| **Консистентность** | Использовать одинаковые параметры стиля для всей серии |

---

## 1. Hero Background

**Файл:** `public/images/hero/hero-bg.webp` (или `.png`) · **Разрешение:** 1920×1080

```
Abstract 3D sacred geometry floating in cosmic void, deep purple (#2D1B4E) to midnight blue (#0A0E27) gradient background, golden light rays piercing through, ethereal glowing particles, crystalline icosahedron structures, mystical atmosphere, 8k ultra resolution, cinematic volumetric lighting, octane render, unreal engine 5 quality, --ar 16:9 --style raw --v 6
```

---

## 2. Course Module Icons (серия 4 шт.)

**Папка:** `public/images/icons/` · **Разрешение:** 512×512 каждая

### Иконка «Самопознание» — `icon-self-discovery.webp`

```
Minimalist 3D icon representing self-discovery and consciousness, translucent glass sphere with golden core light inside, soft ambient occlusion shadows, dark gradient background, isometric 45-degree view, product render style, studio lighting, --ar 1:1 --v 6
```

### Иконка «Медитация» — `icon-meditation.webp`

```
Minimalist 3D icon of meditation lotus flower, made of transparent crystal glass with gold edges, ethereal glow effect, floating above dark surface, elegant and sophisticated, product photography style, --ar 1:1 --v 6
```

### Иконка «Трансформация» — `icon-transformation.webp`

```
Minimalist 3D icon representing transformation and growth, abstract spiral made of iridescent glass, gradient from purple to gold, magical particles around, dark luxury background, premium render, --ar 1:1 --v 6
```

### Иконка «Мудрость» — `icon-wisdom.webp`

```
Minimalist 3D icon of ancient wisdom, open book made of light and golden particles, transparent pages, mystical atmosphere, dark background, cinematic lighting, luxury design, --ar 1:1 --v 6
```

---

## 3. Author Section Background

**Файл:** `public/images/author/author-bg.webp` · **Разрешение:** 1920×1080 (или 16:9)

```
Subtle abstract background with flowing waves of light, warm golden (#D4AF37) to deep purple (#2D1B4E) gradient, soft bokeh effect, elegant and calming, professional portrait photography backdrop, shallow depth of field, high-end luxury feel, --ar 16:9 --style raw
```

---

## 4. Testimonial Cards Decorative Elements

**Файл:** `public/images/decor/testimonials-decor.webp` · **Разрешение:** 1024×1024 (или 3:2)

```
Set of elegant abstract 3D shapes for testimonial cards, soft gradients from purple to gold, floating spheres and geometric forms, gentle glow, glass material with refraction, minimalist luxury style, dark background, --ar 3:2 --v 6
```

---

## 5. Pricing Card Backgrounds (3 варианта)

**Папка:** `public/images/pricing/` · **Разрешение:** 2:3 (например 512×768)

### Базовый тариф — `pricing-basic.webp`

```
Abstract background for pricing card, subtle dark blue (#1a1f3a) with soft light particles, minimal and elegant, --ar 2:3 --v 6
```

### Стандартный тариф — `pricing-standard.webp`

```
Abstract background for pricing card, deep purple (#2D1B4E) with golden accents, medium intensity glow, premium feel, --ar 2:3 --v 6
```

### Премиум тариф (популярный) — `pricing-premium.webp`

```
Abstract luxury background for VIP pricing card, rich gold (#D4AF37) gradient with purple undertones, intense magical glow, exclusive premium feeling, most eye-catching, --ar 2:3 --v 6
```

---

## 6. Floating Decorative Elements (Hero)

**Файл:** `public/images/decor/hero-floating.webp` · **Разрешение:** 1024×1024

```
Collection of floating 3D elements for hero section: transparent crystals, iridescent spheres, sacred geometry shapes (Metatron's cube, flower of life), all with glass material, soft volumetric lighting, isolated on transparent background, magical and mystical, --ar 1:1 --v 6
```

---

## 7. Success Page Illustration

**Файл:** `public/images/success/success-illustration.webp` · **Разрешение:** 1920×1080

```
Celebratory illustration, person achieving enlightenment, golden light emanating from within, ethereal atmosphere, cosmic background with stars, uplifting and inspiring mood, digital art style, vibrant but sophisticated colors, --ar 16:9 --v 6
```

---

## 8. FAQ Section Decorative Icon

**Файл:** `public/images/decor/faq-icon.webp` · **Разрешение:** 512×512

```
Minimalist 3D question mark icon made of transparent glass with golden glow inside, floating above dark surface, elegant and helpful feeling, luxury design, --ar 1:1 --v 6
```

---

## Структура папок после генерации

```
public/images/
├── hero/           # hero-bg.webp
├── thematic/       # hero-banner, about-path, program-energy (как раньше)
├── author/         # author-bg.webp
├── icons/          # icon-self-discovery, icon-meditation, icon-transformation, icon-wisdom
├── pricing/        # pricing-basic, pricing-standard, pricing-premium
├── decor/          # testimonials-decor, hero-floating, faq-icon
├── success/        # success-illustration
└── tatiana/        # фото Татьяны (существующие)
```

Конвертация в WebP: [squoosh.app](https://squoosh.app), ImageMagick (`convert input.png -quality 85 output.webp`) или скрипт в проекте.
