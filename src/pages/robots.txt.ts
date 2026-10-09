import type { APIRoute } from 'astro';

/** Generated from astro.config.mjs so the sitemap URL can never drift. */
export const GET: APIRoute = ({ site }) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Confirmation and error pages carry no search value',
    'Disallow: /thanks/',
    '',
    site ? `Sitemap: ${new URL('sitemap-index.xml', site).href}` : '',
  ].join('\n');

  return new Response(body.trim() + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
