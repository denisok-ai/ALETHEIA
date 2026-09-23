import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Next 16: `next lint` удалён, конфиг — flat. Прежний .eslintrc: next/core-web-vitals
// + plugin:jsx-a11y/recommended — перенесено один в один. Плагин jsx-a11y берём
// из конфига Next: второй экземпляр того же плагина ESLint 9 не принимает.
const jsxA11y = nextVitals.find((c) => c.plugins?.['jsx-a11y'])?.plugins['jsx-a11y'];
if (!jsxA11y) throw new Error('eslint-config-next больше не регистрирует jsx-a11y — поправьте eslint.config.mjs');

export default defineConfig([
  ...nextVitals,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    rules: {
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/heading-has-content': 'warn',
      'jsx-a11y/anchor-is-valid': 'off',
      // Правила React Compiler (react-hooks v7). React Compiler в сборке НЕ включён,
      // поэтому оставшиеся выключенные — рекомендации на будущее, а не баги:
      // set-state-in-effect (~60, загрузка данных в эффектах), preserve-manual-
      // memoization (компилятор пропустил бы оптимизацию). Включены реально
      // полезные: refs (чтение ref во время рендера → устаревший интерфейс), purity
      // (Date.now/Math.random при рендере → расхождение гидратации), immutability.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'DenisBot1/**',
    '.vitest-db/**',
    'public/**',
    '.playwright-mcp/**',
  ]),
]);
