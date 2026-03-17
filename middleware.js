// ============================================================
// Vercel Edge Middleware — Legacy WordPress URL Redirects
// ============================================================
// Handles redirects for old WordPress URLs that Google has cached:
//   1. Blog post slugs without /blog/ prefix → /blog/:slug/
//   2. Numeric WP post IDs → /blog/
//   3. WP admin/plugin paths → 410 Gone
// ============================================================

import { next } from '@vercel/edge';

// Known top-level routes in the Astro site (should NOT be redirected)
const KNOWN_ROUTES = new Set([
  '', 'blog', 'category', 'cgm', 'vip-coaching', 'privacy-policy',
  'admin', 'api', 'sitemap-index.xml', 'sitemap-0.xml', 'robots.txt',
  'llms.txt', 'favicon.ico', 'favicon.svg', 'og-default.jpg',
  '_astro', 'images', 'wp-content',
]);

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);

  // Strip leading/trailing slashes to get the first path segment
  const segments = pathname.replace(/^\/|\/$/g, '').split('/');
  const firstSegment = segments[0];

  // 1. Block WP admin/plugin paths with 410 Gone
  if (firstSegment === 'farmx' || firstSegment === 'wp-admin') {
    return new Response('Gone', { status: 410, headers: { 'Content-Type': 'text/plain' } });
  }
  if (segments[0] === 'wp-content' && segments[1] === 'plugins') {
    return new Response('Gone', { status: 410, headers: { 'Content-Type': 'text/plain' } });
  }

  // 2. Redirect numeric-only paths (old WP post IDs like /20/, /36/)
  if (/^\d+$/.test(firstSegment)) {
    return Response.redirect(new URL('/blog/', request.url), 301);
  }

  // 3. Skip known routes — let them serve normally
  if (KNOWN_ROUTES.has(firstSegment)) {
    return next();
  }

  // 4. Skip file extensions (assets like .js, .css, .webp, etc.)
  if (/\.\w{2,5}$/.test(firstSegment)) {
    return next();
  }

  // 5. Any other top-level slug → redirect to /blog/:slug/
  //    This catches old WordPress post URLs like /fast-อย่างไรให้ได้นานๆ/
  if (segments.length === 1 && firstSegment.length > 0) {
    const destination = new URL(`/blog/${firstSegment}/`, request.url);
    return Response.redirect(destination, 301);
  }

  return next();
}

export const config = {
  matcher: [
    // Match all paths except static assets (_astro, images, wp-content/uploads)
    '/((?!_astro|images|wp-content/uploads).*)',
  ],
};
