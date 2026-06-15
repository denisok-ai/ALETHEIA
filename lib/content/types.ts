/**
 * Общие типы контент-домена (SMM, Site Radar).
 */

export type BrandKb = {
  brand?: Record<string, unknown>;
  audiences?: Array<Record<string, unknown>>;
  products?: Record<string, unknown>;
  author?: Record<string, unknown>;
  rubrics?: Array<Record<string, unknown>>;
  post_types?: Array<Record<string, unknown>>;
  cta_library?: Record<string, string[]>;
  prohibited_phrases?: string[];
  safe_replacements?: Record<string, string>;
  disclaimer?: Record<string, unknown>;
  theme_bank?: Array<Record<string, unknown>>;
  quick_links?: Record<string, string>;
  text_whitelist?: string[];
  templates?: Array<Record<string, unknown>>;
};

export type BrandProfileData = BrandKb & {
  tone_of_voice?: string;
};
