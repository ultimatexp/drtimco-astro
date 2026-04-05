// ============================================================
// Astro Middleware — Legacy WordPress URL Redirects
// ============================================================
// Deployed as Vercel Edge Function via edgeMiddleware: true
// Handles redirects for old WordPress URLs that Google has cached.
// ============================================================

// Known top-level routes in the Astro site (should NOT be redirected)
const KNOWN_ROUTES = new Set([
  '', 'blog', 'category', 'cgm', 'vip-coaching', 'diabetes-guide', 'privacy-policy',
  'admin', 'api', 'sitemap-index.xml', 'sitemap-0.xml', 'robots.txt',
  'llms.txt', 'favicon.ico', 'favicon.svg', 'og-default.jpg',
  '_astro', 'images', 'wp-content',
]);

export function onRequest({ request, redirect, cookies }, next) {
  const url = new URL(request.url);

  // ── Admin Auth Guard ──────────────────────────────────────
  // Must run BEFORE any page rendering to avoid ResponseSentError
  const adminPath = url.pathname.replace(/\/$/, '') || '/';
  if (adminPath.startsWith('/admin') && adminPath !== '/admin/login') {
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    const sessionCookie = cookies.get('adminSession')?.value;
    if (sessionCookie !== adminPassword) {
      return redirect('/admin/login');
    }
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = url.pathname;
  }

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
    return redirect('/blog/', 301);
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
    return redirect(`/blog/${encodeURIComponent(firstSegment)}/`, 301);
  }

  return next();
}
