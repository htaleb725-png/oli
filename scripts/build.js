import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('[Build] Starting unified application build...');

// 1. Update version timestamp in public/version.json
try {
  const updateVersionScript = path.join(rootDir, 'scripts', 'update-version.js');
  if (fs.existsSync(updateVersionScript)) {
    execSync(`node "${updateVersionScript}"`, { stdio: 'inherit', cwd: rootDir });
  }
} catch (e) {
  console.warn('[Build] Version update warning:', e.message);
}

// 2. Build Vite production bundle into dist/
console.log('[Build] Compiling Vite production client bundle...');
try {
  execSync('npx vite build', { stdio: 'inherit', cwd: rootDir });
  console.log('[Build] Vite client build succeeded.');
} catch (e) {
  console.error('[Build] Vite client build failed:', e);
  process.exit(1);
}

// 3. Ensure .nojekyll and 404.html for SPA routing on static hosts (Vercel, GitHub Pages)
const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  try {
    fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf-8');
    const indexHtml = path.join(distDir, 'index.html');
    const notFoundHtml = path.join(distDir, '404.html');
    if (fs.existsSync(indexHtml) && !fs.existsSync(notFoundHtml)) {
      fs.copyFileSync(indexHtml, notFoundHtml);
    }
  } catch (err) {
    console.warn('[Build] SPA files copy note:', err.message);
  }
}

// 4. Bundle backend server.ts for Node / Cloud environments
try {
  console.log('[Build] Bundling Express server.ts with esbuild...');
  execSync('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', { 
    stdio: 'inherit', 
    cwd: rootDir 
  });
  console.log('[Build] Server bundling completed successfully.');
} catch (e) {
  console.warn('[Build] Server bundling warning (non-fatal on static hosts):', e.message);
}

console.log('[Build] Unified build finished successfully!');
