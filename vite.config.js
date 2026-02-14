/**
 * @file: vite.config.js
 * @description: Конфигурация Vite для сборки статического лендинга ALETHEIA
 * @dependencies: vite
 * @created: 2025-02-14
 */
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
