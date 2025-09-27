#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const aiDir = path.join(root, 'docs', 'ai');
const indexPath = path.join(aiDir, 'index.json');

function fail(msg) { console.error(`AI-INDEX ERROR: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`AI-INDEX: ${msg}`); }

function fileExists(p) { try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; } }

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

try {
  if (!fileExists(indexPath)) {
    fail(`Missing ${path.relative(root, indexPath)}`);
    process.exit(1);
  }
  const index = loadJson(indexPath);
  const requiredTop = ['version', 'updated', 'project', 'tags'];
  for (const k of requiredTop) if (!(k in index)) fail(`Missing top-level key: ${k}`);

  // Validate entryPoints files exist
  const ep = index.entryPoints || {};
  const epFiles = [];
  for (const [key, val] of Object.entries(ep)) {
    if (Array.isArray(val)) epFiles.push(...val);
    else if (typeof val === 'string') epFiles.push(val);
  }
  for (const f of epFiles) {
    const p = path.join(root, f);
    if (!fileExists(p)) fail(`Entry point not found: ${f}`);
  }

  // Validate anchors: files exist and contain tokens
  let anchorCount = 0, missingTokens = 0;
  for (const tag of (index.tags || [])) {
    for (const a of (tag.anchors || [])) {
      const f = a.file;
      const contains = a.contains;
      const abs = path.join(root, f);
      if (!fileExists(abs)) { fail(`Anchor file missing: ${f}`); continue; }
      const text = fs.readFileSync(abs, 'utf8');
      const tokens = Array.isArray(contains) ? contains : [contains];
      for (const t of tokens) {
        if (typeof t !== 'string' || !t.length) continue;
        anchorCount++;
        if (!text.includes(t)) {
          missingTokens++;
          console.warn(`AI-INDEX WARN: token not found in ${f}: ${t}`);
        }
      }
    }
  }

  if (process.exitCode) {
    console.error('AI-INDEX: validation failed.');
  } else {
    ok(`validation passed (anchors checked: ${anchorCount}, missing: ${missingTokens})`);
  }
} catch (e) {
  fail(`Exception: ${e?.message || e}`);
}
