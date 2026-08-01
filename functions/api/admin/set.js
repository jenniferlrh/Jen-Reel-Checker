// POST /api/admin/set — approve/deny a device token, or kick/unkick a username.
// Called by the PA Telegram bot. Protected by x-admin-key (checked in middleware).
// {action: 'approve'|'deny', token} or {action: 'kick'|'unkick', username}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.REELS_KV) return json({ error: 'no kv' }, 500)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const action = body.action
  const now = Date.now()

  if (action === 'approve' || action === 'deny') {
    const token = body.token || ''
    const tokRaw = await env.REELS_KV.get(`tok:${token}`)
    if (!tokRaw) return json({ error: 'token not found' }, 404)
    const tok = JSON.parse(tokRaw)
    tok.status = action === 'approve' ? 'approved' : 'denied'
    await env.REELS_KV.put(`tok:${token}`, JSON.stringify(tok))

    if (action === 'approve') {
      const userRaw = await env.REELS_KV.get(`user:${tok.username}`)
      const user = userRaw ? JSON.parse(userRaw) : {}
      await env.REELS_KV.put(`user:${tok.username}`, JSON.stringify({
        ...user, status: 'approved', approvedAt: user.approvedAt || now,
      }))
    }
    return json({ ok: true, username: tok.username })
  }

  if (action === 'kick' || action === 'unkick') {
    const username = String(body.username || '').toLowerCase()
    const userRaw = await env.REELS_KV.get(`user:${username}`)
    if (!userRaw) return json({ error: 'user not found' }, 404)
    const user = JSON.parse(userRaw)
    user.status = action === 'kick' ? 'kicked' : 'approved'
    await env.REELS_KV.put(`user:${username}`, JSON.stringify(user))
    return json({ ok: true, username })
  }

  return json({ error: 'unknown action' }, 400)
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
