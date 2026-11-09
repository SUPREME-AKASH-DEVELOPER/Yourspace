// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import securityHeaders from './src/integrations/security-headers';

// The sitemap, canonical URLs, robots.txt and OG image URLs are all built from
// this. www is the primary domain in Vercel; the bare domain redirects to it.
export const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.yourspacejbp.com').replace(/\/+$/, '');

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
