import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Automatically writes a fresh version.json to both public/ and dist/ on every build
 * so deployed clients detect updates within 15 seconds and launch the 60s update overlay.
 */
function autoVersionJsonPlugin(): Plugin {
  const buildNow = Date.now();
  const iso = new Date(buildNow).toISOString();
  const payload = JSON.stringify(
    {
      version: `5.0.${Math.floor(buildNow / 1000)}`,
      buildTime: buildNow,
      buildTimestamp: buildNow,
      releaseDate: iso,
      name: 'مكتب النائب علا الناشي — منظومة الإدارة المركزية'
    },
    null,
    2
  );

  return {
    name: 'auto-version-json-plugin',
    apply: 'build',
    buildStart() {
      try {
        const publicDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(publicDir, 'version.json'), payload, 'utf-8');
      } catch (err) {
        console.warn('[autoVersionJsonPlugin] Failed to update public/version.json:', err);
      }
    },
    writeBundle(options) {
      try {
        const outDir = options.dir ? path.resolve(options.dir) : path.resolve(__dirname, 'dist');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(path.join(outDir, 'version.json'), payload, 'utf-8');
      } catch (err) {
        console.warn('[autoVersionJsonPlugin] Failed to write dist/version.json:', err);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), autoVersionJsonPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
