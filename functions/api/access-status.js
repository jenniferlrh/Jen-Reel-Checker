// GET /api/access-status?token=xxx -> {status: pending|approved|denied|kicked}
export async function onRequestGet(context) {
  const { request, env } = context
  if (!env.REELS_KV) return json({ error: '还没配置存储' }, 500)

  const token = new URL(request.url).searchParams.get('token') || ''
  if (!token) return json({ error: 'missing token' }, 400)

  const tokRaw = await env.REELS_KV.get(`tok:${token}`)
  if (!tokRaw) return json({ status: 'denied' })
  const tok = JSON.parse(tokRaw)

  if (tok.status === 'pending') return json({ status: 'pending' })
  if (tok.status === 'denied') return json({ status: 'denied' })

  const userRaw = await env.REELS_KV.get(`user:${tok.username}`)
  const user = userRaw ? JSON.parse(userRaw) : null
  if (!user || user.status !== 'approved') return json({ status: 'kicked' })

  return json({ status: 'approved', username: tok.username })
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
