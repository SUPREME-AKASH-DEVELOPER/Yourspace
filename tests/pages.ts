export const PAGES = [
  '/', '/programme/', '/room/', '/tickets/', '/book/', '/about/',
  '/contact/', '/faq/', '/prebook/', '/terms/', '/privacy/', '/refunds/',
  '/thanks/', '/404/',
] as const;

/** Pages that must never be indexed. */
export const NOINDEX = new Set(['/thanks/', '/404/']);
