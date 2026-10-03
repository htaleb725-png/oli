import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFilePath = path.join(__dirname, '..', 'public', 'version.json');

const buildTimestamp = Date.now();
const dateStr = new Date().toISOString();
const versionData = {
  version: `4.3.${Math.floor(buildTimestamp / 1000)}`,
  buildTimestamp,
  releaseDate: dateStr,
  name: "Iraqi MP Executive Office Management System"
};

try {
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2), 'utf-8');
  console.log(`[Version Build] Updated public/version.json with timestamp: ${buildTimestamp}`);
} catch (e) {
  console.warn('Could not update version.json automatically:', e);
}
