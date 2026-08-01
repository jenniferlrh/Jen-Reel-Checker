// Cloudflare Pages Function: /api/library
// Cloud storage for analyzed reels, keyed by a user-chosen sync code.
// Requires a KV namespace bound as REELS_KV in Cloudflare Pages settings.

const CODE_RE = /^[a-zA-Z0-9_-]{4,32}$/

export async function onRequestGet(context) {
  const { request, env } = context
  if (!env.REELS_KV) {
    return jsonResponse({ error: 'KV 还没绑定。去 Cloudflare Pages → Settings → Bindings 添加 REELS_KV。' }, 500)
  }
  const code = new URL(request.url).searchParams.get('code') || ''
  if (!CODE_RE.test(code)) {
    return jsonResponse({ error: '同步码需要 4-32 位字母/数字/横线' }, 400)
  }
  const raw = await env.REELS_KV.get(`library:${code}`)
  return jsonResponse({ data: raw ? JSON.parse(raw) : null })
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.REELS_KV) {
    return jsonResponse({ error: 'KV 还没绑定。去 Cloudflare Pages → Settings → Bindings 添加 REELS_KV。' }, 500)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const code = body.code || ''
  if (!CODE_RE.test(code)) {
    return jsonResponse({ error: '同步码需要 4-32 位字母/数字/横线' }, 400)
  }
  const reels = Array.isArray(body.reels) ? body.reels : []
  const savedReelIds = Array.isArray(body.savedReelIds) ? body.savedReelIds : []
  const payload = JSON.stringify({ reels, savedReelIds, updatedAt: Date.now() })
  if (payload.length > 20 * 1024 * 1024) {
    return jsonResponse({ error: '数据太大，存不下了' }, 413)
  }
  await env.REELS_KV.put(`library:${code}`, payload)
  return jsonResponse({ ok: true })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
