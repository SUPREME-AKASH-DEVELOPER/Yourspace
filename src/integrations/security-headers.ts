import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { formOrigin } from '../data/site';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Writes `_headers` (Netlify / Cloudflare Pages) after the build, and puts the
 * same Content-Security-Policy into every page as a <meta> tag. The site is
 * hosted on Vercel, which ignores `_headers`, so before 22 Nov 2026 the live
 * site had no policy at all. A <meta> policy cannot carry frame-ancestors; the
 * X-Frame-Options: DENY header in vercel.json covers that.
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

        const directives = [
          "default-src 'self'",
          // Razorpay Checkout: its script, its payment window, and its calls home.
          // Razorpay serves these from several of its own subdomains.
          `script-src 'self' https://checkout.razorpay.com https://*.razorpay.com ${[...hashes].join(' ')}`.trim(),
          'frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com',
          // style attributes in the markup still need unsafe-inline for styles
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self'",
          "img-src 'self' data: https://cdn.razorpay.com https://*.razorpay.com",
          "media-src 'self'",
          `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://*.razorpay.com${formOrigin ? ' ' + formOrigin : ''}`.trim(),
          ['form-action', "'self'", formOrigin].filter(Boolean).join(' '),
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
          'upgrade-insecure-requests',
        ];
        const csp = directives.join('; ');
        // the same policy in every page, minus what a <meta> policy may not carry
        // upgrade-insecure-requests stays in _headers only: in a page, WebKit applies it
        // even on http://localhost and breaks every script in testing. On the live
        // site HSTS already keeps everything on https.
        const metaCsp = directives
          .filter((d) => !d.startsWith('frame-ancestors') && d !== 'upgrade-insecure-requests')
          .join('; ');
        const tag = `<meta http-equiv="Content-Security-Policy" content="${metaCsp.replace(/"/g, '&quot;')}">`;
        let pages = 0;
        for (const file of await htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          if (html.includes('http-equiv="Content-Security-Policy"')) continue;
          // straight after the charset, so it governs every script that follows
          const withCsp = html.replace(/(<meta charset="[^"]*">)/i, `$1${tag}`);
          if (withCsp === html) { logger.warn(`no <meta charset> in ${file}, CSP not added`); continue; }
          await writeFile(file, withCsp, 'utf8');
          pages++;
        }
        logger.info(`added the Content-Security-Policy to ${pages} pages`);

        const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com"), usb=(), interest-cohort=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin-allow-popups
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
