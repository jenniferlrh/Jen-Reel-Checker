// Access control for all /api/* endpoints.
// - /api/access-request and /api/access-status are public (the request/wait flow)
// - /api/admin/* requires x-admin-key === env.ADMIN_KEY (used by the PA Telegram bot)
// - everything else requires an approved device token (x-user-token) whose
//   username is still approved (not kicked).

const PUBLIC_PATHS = ['/api/access-request', '/api/access-status']
const COUNTED_PATHS = ['/api/analyze', '/api/analyze-url', '/api/ads-research']

export async function onRequest(context) {
  const { request, env, next } = context
  const path = new URL(request.url).pathname

  if (PUBLIC_PATHS.includes(path)) {
    return next()
  }

  if (path.startsWith('/api/admin/')) {
    if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
      return deny()
    }
    return next()
  }

  if (!env.REELS_KV) {
    return next() // not configured yet
  }

  const token = request.headers.get('x-user-token') || ''
  if (!token) return deny()

  const tokRaw = await env.REELS_KV.get(`tok:${token}`)
  if (!tokRaw) return deny()
  const tok = JSON.parse(tokRaw)
  if (tok.status !== 'approved') return deny()

  const userRaw = await env.REELS_KV.get(`user:${tok.username}`)
  const user = userRaw ? JSON.parse(userRaw) : null
  if (!user || user.status !== 'approved') return deny()

  const resp = await next()

  // Count expensive analyses per user
  if (resp.ok && request.method === 'POST' && COUNTED_PATHS.includes(path)) {
    try {
      user.analyzeCount = (user.analyzeCount || 0) + 1
      user.lastUsedAt = Date.now()
      await env.REELS_KV.put(`user:${tok.username}`, JSON.stringify(user))
    } catch {
      // counting failure should never break the response
    }
  }
  return resp
}

function deny() {
  return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}
