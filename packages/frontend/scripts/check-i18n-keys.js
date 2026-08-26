#!/usr/bin/env node
/**
 * Every t('…') a page asks for must exist in every locale file.
 *
 * next-intl does not fail the build on a missing key — it renders the key path
 * as visible text, so the gap only shows up as `productStock.columns.sku` sitting
 * in a table header in production. This is the check that catches it first.
 *
 * Usage: node scripts/check-i18n-keys.js [namespace ...]
 *        no arguments = check every namespace referenced in src/
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MESSAGES = path.join(ROOT, 'messages');
const SRC = path.join(ROOT, 'src');

const only = process.argv.slice(2);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Collect (namespace, key) pairs per file. Only literal `t('a.b')` calls are
 * resolvable — a template literal key is reported separately rather than
 * silently passed, because that is exactly where a gap hides.
 */
function collect(file) {
  const src = fs.readFileSync(file, 'utf8');
  const namespaces = [...src.matchAll(/useTranslations\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  if (namespaces.length === 0) return { pairs: [], dynamic: [] };

  const pairs = [];
  const dynamic = [];
  // Which alias maps to which namespace: `const t = useTranslations('x')`.
  const aliases = [...src.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*'([^']+)'\s*\)/g)];
  for (const [, alias, ns] of aliases) {
    const call = new RegExp(`\\b${alias}\\(\\s*(['\`])([^'\`]*)\\1`, 'g');
    for (const m of src.matchAll(call)) {
      if (m[1] === '`' && m[2].includes('${')) dynamic.push({ file, ns, raw: m[2] });
      else pairs.push({ file, ns, key: m[2] });
    }
    // Template keys with interpolation, e.g. t(`level.${k}`) — record the prefix.
    const tpl = new RegExp(`\\b${alias}\\(\\s*\`([^\`]*\\$\\{[^\`]*)\``, 'g');
    for (const m of src.matchAll(tpl)) dynamic.push({ file, ns, raw: m[1] });
  }
  return { pairs, dynamic };
}

function get(obj, dotted) {
  return dotted.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

const locales = fs.readdirSync(MESSAGES).filter((f) => f.endsWith('.json'));
const parsed = Object.fromEntries(
  locales.map((f) => [f, JSON.parse(fs.readFileSync(path.join(MESSAGES, f), 'utf8'))]),
);

const allPairs = [];
const allDynamic = [];
for (const file of walk(SRC)) {
  const { pairs, dynamic } = collect(file);
  allPairs.push(...pairs);
  allDynamic.push(...dynamic);
}

const scoped = only.length
  ? allPairs.filter((p) => only.includes(p.ns))
  : allPairs;

const problems = [];
for (const { file, ns, key } of scoped) {
  const dotted = `${ns}.${key}`;
  for (const locale of locales) {
    const value = get(parsed[locale], dotted);
    if (value === undefined || typeof value === 'object') {
      problems.push(`${locale}  ${dotted}   (${path.relative(ROOT, file)})`);
    }
  }
}

const uniq = [...new Set(problems)].sort();
const checked = new Set(scoped.map((p) => `${p.ns}.${p.key}`)).size;

console.log(`locale dosyasi : ${locales.length}`);
console.log(`kontrol edilen anahtar: ${checked}`);
console.log(`toplam kontrol : ${checked * locales.length}`);

const dyn = allDynamic.filter((d) => !only.length || only.includes(d.ns));
if (dyn.length) {
  console.log(`\ndinamik anahtar (elle dogrulanmali): ${dyn.length}`);
  for (const d of [...new Set(dyn.map((d) => `${d.ns}.${d.raw}`))].sort()) console.log('  ' + d);
}

if (uniq.length) {
  console.log(`\nEKSIK: ${uniq.length}`);
  for (const p of uniq) console.log('  ' + p);
  process.exit(1);
}
console.log('\nEKSIK ANAHTAR YOK');
