// Admin endpoint for the ads-brain learnings queue (x-admin-key protected by middleware).
// GET  /api/admin/brain            -> { learnings: [...] } (all, newest first)
// POST /api/admin/brain {action:'mark-synced'} -> marks all as synced (after folding into jen-ads-brain.md)

export async function onRequestGet(context) {
  const { env } = context
  if (!env.REELS_KV) return jsonResponse({ error: 'KV 未配置' }, 500)
  const raw = await env.REELS_KV.get('brain:learnings')
  const list = raw ? JSON.parse(raw) : []
  return jsonResponse({ learnings: list, pending: list.filter((l) => !l.synced).length })
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.REELS_KV) return jsonResponse({ error: 'KV 未配置' }, 500)
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  if (body.action !== 'mark-synced') return jsonResponse({ error: 'Unknown action' }, 400)
  const raw = await env.REELS_KV.get('brain:learnings')
  const list = raw ? JSON.parse(raw) : []
  list.forEach((l) => {
    l.synced = true
  })
  await env.REELS_KV.put('brain:learnings', JSON.stringify(list))
  return jsonResponse({ ok: true })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
