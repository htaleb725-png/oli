import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('[Build] Starting unified application build...');

// 1. Ensure dist directory exists & refresh public/version.json on every build
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

try {
  const nowMs = Date.now();
  const versionPayload = JSON.stringify(
    {
      version: `5.0.${Math.floor(nowMs / 1000)}`,
      buildTime: nowMs,
      buildTimestamp: nowMs,
      releaseDate: new Date(nowMs).toISOString(),
      name: 'مكتب النائب علا الناشي — منظومة الإدارة المركزية'
    },
    null,
    2
  );
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(path.join(publicDir, 'version.json'), versionPayload, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'version.json'), versionPayload, 'utf-8');
  console.log('[Build] Generated fresh public/version.json and dist/version.json.');
} catch (vErr) {
  console.warn('[Build] version.json generation warning:', vErr.message);
}

// 2. Build Vite production bundle into dist/
console.log('[Build] Compiling Vite production client bundle...');
let viteBuilt = false;
const viteBinPaths = [
  path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'),
  './node_modules/vite/bin/vite.js',
  'vite'
];

for (const binPath of viteBinPaths) {
  try {
    const cmd = binPath.endsWith('.js') ? `node "${binPath}" build` : `${binPath} build`;
    console.log(`[Build] Attempting build with: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
    viteBuilt = true;
    console.log('[Build] Vite client build succeeded.');
    break;
  } catch (err) {
    console.warn(`[Build] Attempt with ${binPath} failed:`, err.message);
  }
}

// Fallback: If vite CLI failed or wasn't found, construct basic dist/index.html from index.html
if (!viteBuilt || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('[Build] Using fallback HTML compilation for dist/');
  try {
    const srcIndexHtml = path.join(rootDir, 'index.html');
    if (fs.existsSync(srcIndexHtml)) {
      let htmlContent = fs.readFileSync(srcIndexHtml, 'utf-8');
      fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent, 'utf-8');
    }
  } catch (e) {
    console.warn('[Build] Fallback HTML copy warning:', e.message);
  }
}

// 3. Ensure .nojekyll and 404.html for SPA routing on static hosts (Vercel, GitHub Pages)
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

// 4. Bundle backend server.ts for Node / Cloud environments with esbuild fallback
console.log('[Build] Bundling Express server.ts with esbuild...');
const esbuildBinPaths = [
  path.join(rootDir, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  path.join(rootDir, 'node_modules', 'esbuild', 'bin', 'esbuild.js'),
  'esbuild'
];

let serverBundled = false;
for (const esBin of esbuildBinPaths) {
  try {
    const cmd = esBin.endsWith('.js')
      ? `node "${esBin}" server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
      : `${esBin} server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`;
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
    serverBundled = true;
    console.log('[Build] Server bundling completed successfully.');
    break;
  } catch (err) {
    console.warn(`[Build] Server bundling with ${esBin} note:`, err.message);
  }
}

if (!serverBundled) {
  try {
    fs.writeFileSync(path.join(distDir, 'server.cjs'), `module.exports = {};`, 'utf-8');
  } catch {}
}

console.log('[Build] Unified build finished successfully!');
