/**
 * Версия продукта (SemVer) — единый источник для серверного кода и RSC.
 * Для клиентских компонентов по-прежнему NEXT_PUBLIC_APP_VERSION из next.config.mjs (тот же package.json).
 */
import packageJson from '../package.json';

export const APP_VERSION: string = packageJson.version ?? '0.0.0';
