import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Writes `_headers` (Netlify / Cloudflare Pages) after the build.
 *
 * The Content-Security-Policy is generated from what was actually built: every
 * inline <script> in the output is hashed and allowed by hash, so the policy
 * never needs `'unsafe-inline'` for scripts and never goes stale when the
 * structured data changes.
 */
async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (extname(entry.name) === '.html') out.push(full);
  }
  return out;
}

export default function securityHeaders(): AstroIntegration {
  return {
    name: 'yourspace:security-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = dir.pathname;
        const hashes = new Set<string>();

        for (const file of await htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
            const body = m[1];
            if (!body.trim()) continue;
            hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
          }
        }

        const csp = [
          "default-src 'self'",
          `script-src 'self' ${[...hashes].join(' ')}`.trim(),
          // style attributes in the markup still need unsafe-inline for styles
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self'",
          "img-src 'self' data:",
          "connect-src 'self'",
          "form-action 'self' https://wa.me https://api.whatsapp.com https://docs.google.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
          'upgrade-insecure-requests',
        ].join('; ');

        const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  X-DNS-Prefetch-Control: off

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=604800

/*.svg
  Cache-Control: public, max-age=604800
`;
        await writeFile(join(root, '_headers'), headers, 'utf8');
        logger.info(`wrote _headers (CSP allows ${hashes.size} inline script hash${hashes.size === 1 ? '' : 'es'})`);
      },
    },
  };
}
