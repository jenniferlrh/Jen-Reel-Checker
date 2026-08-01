// Cloudflare Pages Function: POST /api/brain-learn
// Saves a learning note into KV so it can later be folded into jen-ads-brain.md.
// Notes pile up under brain:learnings (a JSON array, newest first).

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.REELS_KV) return jsonResponse({ error: 'KV 未配置' }, 500)

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const note = (body.note || '').trim()
  if (!note) return jsonResponse({ error: '没有内容可以存' }, 400)
  if (note.length > 8000) return jsonResponse({ error: '内容太长' }, 400)

  const raw = await env.REELS_KV.get('brain:learnings')
  const list = raw ? JSON.parse(raw) : []
  list.unshift({
    note,
    source: (body.source || '').slice(0, 200) || null,
    savedAt: Date.now(),
    synced: false,
  })
  // keep the newest 200 to bound the KV value size
  await env.REELS_KV.put('brain:learnings', JSON.stringify(list.slice(0, 200)))

  return jsonResponse({ ok: true, pending: list.filter((l) => !l.synced).length })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
