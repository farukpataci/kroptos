#!/usr/bin/env node
/**
 * Every t('…') a page asks for must actually resolve at runtime.
 *
 * "Resolve" is the important word, and it is not the same as "is in the locale
 * file". I18nProvider hands next-intl a merged dictionary:
 *
 *     deepMerge(deepMerge(tr, enUS), messagesMap[activeLocale])
 *
 * so `tr` is the base layer for EVERY locale, `en-US` sits on top of it, and the
 * active locale only overrides what it happens to define. Comparing each locale
 * file in isolation therefore reports thousands of keys that render perfectly
 * well — only `tr` is fully populated, and that is by design.
 *
 * This script models the real merge, and separates the two things that actually
 * matter and have completely different urgency:
 *
 *   KIRIK (broken)        the key resolves in NO layer. next-intl renders the
 *                         key path as visible text — `products.table.columns.sku`
 *                         sitting in a table header in production. A bug.
 *   CEVRILMEMIS           resolves, but only through the tr/en-US base. The user
 *   (untranslated)        sees Turkish or English on a Polish screen. Debt, not
 *                         a bug — and the normal state of this repo today.
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
  //
  // Scoped by position, not file-wide. One file may redeclare the SAME alias for
  // several namespaces — src/app/[locale]/industry/[slug]/page.tsx declares
  // `const t` five times, once per mockup component. Scanning the whole file per
  // declaration attributes every key to all five namespaces and manufactures
  // four false gaps for each real one, which buries the genuine ones.
  const aliases = [...src.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*'([^']+)'\s*\)/g)];

  for (let i = 0; i < aliases.length; i++) {
    const [, alias, ns] = aliases[i];
    const start = aliases[i].index;
    // Up to the next redeclaration of this same alias; other aliases don't end it.
    const next = aliases.slice(i + 1).find((a) => a[1] === alias);
    const region = src.slice(start, next ? next.index : src.length);

    const call = new RegExp(`\\b${alias}\\(\\s*(['\`])([^'\`]*)\\1`, 'g');
    for (const m of region.matchAll(call)) {
      if (m[1] === '`' && m[2].includes('${')) dynamic.push({ file, ns, raw: m[2] });
      else pairs.push({ file, ns, key: m[2] });
    }
    // Template keys with interpolation, e.g. t(`level.${k}`) — record the prefix.
    const tpl = new RegExp(`\\b${alias}\\(\\s*\`([^\`]*\\$\\{[^\`]*)\``, 'g');
    for (const m of region.matchAll(tpl)) dynamic.push({ file, ns, raw: m[1] });
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

/** The two base layers I18nProvider merges under every locale, in its order. */
const BASE_LAYERS = ['tr.json', 'en-US.json'];

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

const resolves = (locale, dotted) => {
  for (const layer of [locale, ...BASE_LAYERS]) {
    const value = get(parsed[layer], dotted);
    if (typeof value === 'string') return layer;
  }
  return null;
};

const broken = [];
const untranslated = [];
for (const { file, ns, key } of scoped) {
  const dotted = `${ns}.${key}`;
  for (const locale of locales) {
    const via = resolves(locale, dotted);
    const where = `${locale}  ${dotted}   (${path.relative(ROOT, file)})`;
    if (via === null) broken.push(where);
    else if (via !== locale) untranslated.push(`${locale}  ${dotted}  -> ${via}`);
  }
}

const uniq = [...new Set(broken)].sort();
const uniqUntranslated = [...new Set(untranslated)];
const checked = new Set(scoped.map((p) => `${p.ns}.${p.key}`)).size;

console.log(`locale dosyasi : ${locales.length}`);
console.log(`kontrol edilen anahtar: ${checked}`);
console.log(`toplam kontrol : ${checked * locales.length}`);
console.log(`cevrilmemis (tr/en-US tabanindan cozuluyor): ${uniqUntranslated.length}`);

const dyn = allDynamic.filter((d) => !only.length || only.includes(d.ns));
if (dyn.length) {
  console.log(`\ndinamik anahtar (elle dogrulanmali): ${dyn.length}`);
  for (const d of [...new Set(dyn.map((d) => `${d.ns}.${d.raw}`))].sort()) console.log('  ' + d);
}

if (uniq.length) {
  console.log(`\nKIRIK (hicbir katmanda cozulmuyor): ${uniq.length}`);
  for (const p of uniq) console.log('  ' + p);
  process.exit(1);
}
console.log('\nKIRIK ANAHTAR YOK');
