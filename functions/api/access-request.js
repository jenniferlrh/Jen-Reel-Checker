// POST /api/access-request {username, label}
// Creates a device access request. "jenniferlee" is auto-approved (owner).
// Everyone else triggers a Telegram approval message to Jennifer.

const OWNER = 'jenniferlee'
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.REELS_KV) {
    return json({ error: '还没配置存储' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const username = String(body.username || '').trim().toLowerCase()
  if (!USERNAME_RE.test(username)) {
    return json({ error: 'Username 需要 3-20 位，只能用字母、数字、横线' }, 400)
  }
  const label = String(body.label || '').slice(0, 60)
  const token = crypto.randomUUID()
  const now = Date.now()

  if (username === OWNER) {
    await env.REELS_KV.put(`tok:${token}`, JSON.stringify({ username, status: 'approved', label, createdAt: now }))
    const userRaw = await env.REELS_KV.get(`user:${username}`)
    const user = userRaw ? JSON.parse(userRaw) : {}
    await env.REELS_KV.put(`user:${username}`, JSON.stringify({
      ...user, status: 'approved', approvedAt: user.approvedAt || now,
    }))
    return json({ token, status: 'approved' })
  }

  await env.REELS_KV.put(`tok:${token}`, JSON.stringify({ username, status: 'pending', label, createdAt: now }))

  // Notify Jennifer on Telegram with approve/deny buttons
  if (env.TG_BOT_TOKEN && env.TG_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TG_CHAT_ID,
          text: `🎬 Jen Reel Checker — Access Request\n\n👤 Username: ${username}\n📱 Device: ${label || 'unknown'}\n\nAllow this user?`,
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Allow', callback_data: `jrc:ok:${token}` },
              { text: '❌ Deny', callback_data: `jrc:no:${token}` },
            ]],
          },
        }),
      })
    } catch {
      // notification failure shouldn't break the request; Jennifer can still see it in the menu later
    }
  }

  return json({ token, status: 'pending' })
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
