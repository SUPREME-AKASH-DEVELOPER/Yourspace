// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import securityHeaders from './src/integrations/security-headers';

// TODO (Akash/Tanishk): set this to the real domain before launch —
// the sitemap, canonical URLs and OG image URLs are all built from it.
export const SITE_URL = 'https://yourspace-jabalpur.example';

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
