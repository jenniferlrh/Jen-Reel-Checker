// Cloudflare Pages Function: POST /api/ads-research
// Competitor ads research: scrape a brand's Facebook Ad Library ads via Apify,
// then have Claude summarize their advertising playbook.
// Requires env vars: APIFY_TOKEN, ANTHROPIC_API_KEY

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    brand: { type: 'string', description: 'Brand or page name inferred from the ads' },
    overview: { type: 'string', description: '2-3 sentence overview of their ad strategy, in Chinese' },
    patterns: {
      type: 'array',
      items: { type: 'string' },
      description: '4-6 recurring patterns in their ads (hooks, offers, angles, formats), in Chinese',
    },
    hooks: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 actual hook lines or hook styles they use, quoted or paraphrased',
    },
    ctas: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 CTA styles they use, in Chinese',
    },
    stealIdeas: {
      type: 'array',
      items: { type: 'string' },
      description: '4-6 concrete ideas the user can borrow or do better, in Chinese',
    },
  },
  required: ['brand', 'overview', 'patterns', 'hooks', 'ctas', 'stealIdeas'],
  additionalProperties: false,
}

export async function onRequestPost(context) {
  const { request, env } = context

  const missing = ['APIFY_TOKEN', 'ANTHROPIC_API_KEY'].filter((k) => !env[k])
  if (missing.length > 0) {
    return jsonResponse({ error: `还没设置环境变量: ${missing.join(', ')}。` }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const url = (body.url || '').trim()
  if (!/facebook\.com\//.test(url)) {
    return jsonResponse({ error: '请提供品牌的 Facebook 主页链接，例如 https://www.facebook.com/nike' }, 400)
  }

  // ---- Step 1: Scrape the brand's active ads from the Facebook Ad Library ----
  let items
  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/apify~facebook-ads-scraper/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}&timeout=150`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url }],
          resultsLimit: 15,
          activeStatus: 'active',
        }),
      }
    )
    if (!apifyRes.ok) {
      const t = await apifyRes.text()
      return jsonResponse({ error: `抓取广告库失败 (Apify ${apifyRes.status})`, detail: t.slice(0, 500) }, 502)
    }
    items = await apifyRes.json()
  } catch (e) {
    return jsonResponse({ error: `抓取广告库出错: ${e.message}` }, 502)
  }

  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: '抓不到这个品牌的广告。确认它现在有在投 FB/IG 广告，链接是它的公开主页。' }, 404)
  }

  // Extract ad texts (fields vary; grab common ones + fallback deep scan of string fields)
  const ads = items.slice(0, 15).map((it, i) => {
    const text =
      it.adText || it.text || it.body || it.snapshot?.body?.text || it.snapshot?.cards?.[0]?.body ||
      it.creativeBodies?.[0] || ''
    const title = it.title || it.snapshot?.title || it.linkTitle || ''
    const cta = it.ctaText || it.snapshot?.cta_text || it.callToAction || ''
    return `【广告${i + 1}】${title ? `标题: ${title} | ` : ''}${cta ? `CTA: ${cta} | ` : ''}内容: ${String(text).slice(0, 500)}`
  }).filter((s) => s.length > 20)

  if (ads.length === 0) {
    return jsonResponse({ error: '抓到了广告但读不到文案内容，可能都是纯图片/视频广告。' }, 422)
  }

  // ---- Step 2: Claude summarizes the playbook ----
  const prompt = `你是广告策略分析师。以下是某品牌目前在 Facebook/Instagram 投放的 ${ads.length} 条广告的文案，请拆解它们的广告打法。

${ads.join('\n\n')}

请总结：他们的整体策略、反复使用的套路（hook/卖点/角度/格式）、常用 hook、CTA 风格，以及「我可以偷学或做得更好」的具体点子。用中文输出。`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!claudeRes.ok) {
    const t = await claudeRes.text()
    return jsonResponse({ error: `AI 分析失败 (Claude ${claudeRes.status})`, detail: t.slice(0, 500) }, 502)
  }

  const data = await claudeRes.json()
  if (data.stop_reason === 'refusal') {
    return jsonResponse({ error: '这些内容无法分析。' }, 422)
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text')
  let report
  try {
    report = JSON.parse(textBlock.text)
  } catch {
    return jsonResponse({ error: '分析结果解析失败，请重试。' }, 502)
  }

  return jsonResponse({ report, adCount: ads.length, url })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
