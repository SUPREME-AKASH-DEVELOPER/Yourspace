// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import securityHeaders from './src/integrations/security-headers';

// TODO (Akash/Tanishk): set the real domain before launch — the sitemap,
// canonical URLs, robots.txt and OG image URLs are all built from it.
// Either set PUBLIC_SITE_URL in Vercel (Project → Settings → Environment
// Variables) or replace the fallback below. No trailing slash.
export const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://yourspace-jabalpur.example').replace(/\/+$/, '');

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // confirmation and error pages have no business in search results
      filter: (page) => !/\/(thanks|404)\/?$/.test(page),
    }),
    securityHeaders(),
  ],
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
  vite: { build: { cssMinify: 'lightningcss' } },
});
