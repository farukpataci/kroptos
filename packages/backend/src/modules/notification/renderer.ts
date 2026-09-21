import Handlebars from 'handlebars';
import { NotificationEvent } from '@prisma/client';
import { ITEM_FIELDS, variablesFor } from './variables';

/**
 * Şablon motoru. Kendi Handlebars örneği: global kayıt yok, yalnız izinli
 * helper'lar (formatCurrency, formatDate, upper; if/each/unless yerleşik).
 * HTML escape Handlebars'ın varsayılanı; `{{{ }}}` üçlü bıyık kullanıcıya
 * kapalı (doğrulamada reddedilir) — kullanıcı kodu çalışmaz.
 */
const hb = Handlebars.create();

hb.registerHelper('formatCurrency', (value: unknown, currency?: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const cur = typeof currency === 'string' && currency.length === 3 ? currency : 'TRY';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
});
hb.registerHelper('formatDate', (value: unknown) => {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' }).format(d);
});
hb.registerHelper('upper', (value: unknown) => String(value ?? '').toLocaleUpperCase('tr-TR'));

const ALLOWED_HELPERS = new Set(['formatCurrency', 'formatDate', 'upper', 'if', 'unless', 'each', 'with']);
const HELPER_NAMES = new Set(['formatCurrency', 'formatDate', 'upper']);

export interface TemplateIssue {
  line: number;
  message: string;
  variable?: string;
}

/**
 * Sözdizimi + bilinmeyen değişken doğrulaması. AST üzerinden yürür; `#each order.items`
 * içinde kalem alanları (`name`, `quantity`…) ve `../` ile üst bağlam serbesttir.
 */
export function validateTemplate(source: string, event: NotificationEvent): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  let ast: any;
  try {
    ast = hb.parse(source);
  } catch (e: any) {
    const m = /Parse error on line (\d+)/.exec(e?.message ?? '');
    issues.push({ line: m ? Number(m[1]) : 1, message: (e?.message ?? 'Syntax error').split('\n')[0] });
    return issues;
  }

  const known = new Set(variablesFor(event).map((v) => v.path));
  const roots = new Set([...known].map((p) => p.split('.')[0]));

  // Bağlam yığını: her `#each` girişinde o listenin alan kümesi eklenir.
  const walk = (node: any, scopes: Set<string>[]) => {
    if (!node) return;
    switch (node.type) {
      case 'Program':
        node.body.forEach((n: any) => walk(n, scopes));
        return;
      case 'ContentStatement':
      case 'CommentStatement':
        return;
      case 'MustacheStatement':
      case 'SubExpression':
      case 'BlockStatement':
      case 'PartialStatement':
      case 'PartialBlockStatement': {
        const line = node.loc?.start?.line ?? 1;
        if (node.type === 'PartialStatement' || node.type === 'PartialBlockStatement') {
          issues.push({ line, message: 'Partial kullanımı kapalı.' });
          return;
        }
        if (node.type === 'MustacheStatement' && node.escaped === false) {
          issues.push({ line, message: 'Üçlü bıyık {{{ }}} kapalı; HTML kaçışı zorunlu.' });
        }
        const isHelperCall = node.params?.length > 0 || node.hash || node.type === 'BlockStatement';
        const head = node.path?.original as string | undefined;
        if (isHelperCall && head && !ALLOWED_HELPERS.has(head)) {
          // `{{#order.items}}` gibi yol-blokları da buraya düşer; sadece each/if/unless/with kabul.
          issues.push({ line, message: `'${head}' helper'ı izinli değil.`, variable: head });
        } else if (!isHelperCall && head && HELPER_NAMES.has(head)) {
          // `{{upper}}` parametresiz helper — anlamsız ama zararsız; atla.
        } else if (!isHelperCall && node.path) {
          checkPath(node.path, scopes, line);
        }
        (node.params ?? []).forEach((p: any) => {
          if (p.type === 'PathExpression') checkPath(p, scopes, line);
          else if (p.type === 'SubExpression') walk(p, scopes);
        });
        (node.hash?.pairs ?? []).forEach((pair: any) => {
          if (pair.value?.type === 'PathExpression') checkPath(pair.value, scopes, line);
        });
        if (node.type === 'BlockStatement') {
          let inner = scopes;
          if (head === 'each' || head === 'with') {
            const target = node.params?.[0]?.original as string | undefined;
            const fields = target && target.replace(/^\.\.\//g, '').endsWith('order.items') ? ITEM_FIELDS : [];
            inner = [...scopes, new Set(fields)];
          }
          walk(node.program, inner);
          walk(node.inverse, scopes);
        }
        return;
      }
      default:
        return;
    }
  };

  const checkPath = (path: any, scopes: Set<string>[], line: number) => {
    const original: string = path.original;
    if (original === 'this' || original.startsWith('@')) return;
    let depth = 0;
    let rest = original;
    while (rest.startsWith('../')) {
      depth++;
      rest = rest.slice(3);
    }
    if (rest.startsWith('this.')) rest = rest.slice(5);
    const level = scopes.length - 1 - depth;
    if (level > 0) {
      // Bir blok bağlamı içindeyiz: alan o bloğun kümesinde olmalı.
      if (scopes[level].has(rest.split('.')[0])) return;
    }
    // Kök bağlam (veya `../` ile köke çıkılmış).
    if (known.has(rest)) return;
    if (roots.has(rest.split('.')[0]) && [...known].some((k) => k.startsWith(rest + '.'))) return; // {{#if shipment}}
    issues.push({ line, message: `Bilinmeyen değişken: ${original}`, variable: original });
  };

  walk(ast, [new Set<string>()]);
  return issues;
}

export function render(source: string, context: Record<string, unknown>): string {
  return hb.compile(source, { noEscape: false, strict: false })(context);
}

/** Basit düz metin: bloklar satır sonu, etiketler atılır, entity'ler çözülür. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Ortak e-posta layout'u; CSS inline (juice yok — tek tablo, tek stil).
 * Marka logosu/adı ve destek bilgisi bağlamdan gelir.
 */
export function wrapEmailLayout(bodyHtml: string, ctx: { store?: { name?: string; logoUrl?: string; supportEmail?: string; supportPhone?: string }; brand?: { name?: string } }) {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  const title = esc(ctx.brand?.name || ctx.store?.name || '');
  const logo = ctx.store?.logoUrl
    ? `<img src="${esc(ctx.store.logoUrl)}" alt="${title}" style="max-height:48px;display:block;margin:0 auto 8px;" />`
    : '';
  const support = [ctx.store?.supportEmail, ctx.store?.supportPhone].filter(Boolean).map(esc).join(' · ');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:24px;text-align:center;border-bottom:1px solid #e5e7eb;">${logo}<div style="font-size:18px;font-weight:bold;">${title}</div></td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;">${support}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * SMS segment hesabı. GSM-7 alfabesindeki metin 160/153; dışına çıkan tek
 * karakter (ç, ğ, ı, ş, İ dahil) UCS-2'ye düşürür: 70/67. ö, ü GSM-7'de vardır.
 */
const GSM7 = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'.split(''),
);
const GSM7_EXT = new Set('^{}\\[~]|€'.split(''));

export function smsSegments(text: string): { charCount: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  let ucs2 = false;
  let units = 0;
  for (const ch of text) {
    if (GSM7.has(ch)) units += 1;
    else if (GSM7_EXT.has(ch)) units += 2;
    else {
      ucs2 = true;
      break;
    }
  }
  if (ucs2) {
    const len = [...text].length;
    return { charCount: len, segments: len === 0 ? 0 : len <= 70 ? 1 : Math.ceil(len / 67), encoding: 'UCS-2' };
  }
  return { charCount: units, segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153), encoding: 'GSM-7' };
}
