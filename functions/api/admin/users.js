// GET /api/admin/users -> list of users with usage stats (for the PA bot menu)
export async function onRequestGet(context) {
  const { env } = context
  if (!env.REELS_KV) return json({ error: 'no kv' }, 500)

  const list = await env.REELS_KV.list({ prefix: 'user:' })
  const users = []
  for (const key of list.keys) {
    const raw = await env.REELS_KV.get(key.name)
    if (!raw) continue
    const u = JSON.parse(raw)
    users.push({
      username: key.name.slice(5),
      status: u.status,
      analyzeCount: u.analyzeCount || 0,
      approvedAt: u.approvedAt || null,
      lastUsedAt: u.lastUsedAt || null,
    })
  }
  users.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
  return json({ users })
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
