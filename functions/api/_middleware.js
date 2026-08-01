// Protects all /api/* endpoints with a site password.
// Set SITE_PASSWORD env var in Cloudflare Pages. Clients send it as the x-site-key header.

export async function onRequest(context) {
  const { request, env, next } = context
  if (!env.SITE_PASSWORD) {
    // Not configured yet — allow through so setup isn't bricked.
    return next()
  }
  const key = request.headers.get('x-site-key') || ''
  if (key !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return next()
}
