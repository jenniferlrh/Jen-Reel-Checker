// Cloudflare Pages Function: POST /api/analyze-image
// Analyze a screenshot of an ad/post with Claude vision.
// Body: {imageBase64, mediaType, mode: 'ads'|'content'}

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    creator: { type: 'string', description: 'Creator/brand handle visible in the screenshot, e.g. @nike. Use "@unknown" if not visible.' },
    visibleText: { type: 'string', description: 'All meaningful text visible in the screenshot (caption, subtitles, overlay text), transcribed' },
    hookScore: { type: 'number', description: 'Hook strength score from 0 to 10, one decimal allowed' },
    category: { type: 'string', description: 'Short content category in Chinese' },
    summary: { type: 'string', description: 'One-sentence summary in Chinese of what this ad/post is' },
    insights: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 insights about why this works or not, in Chinese',
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 concrete improvement or borrow-this ideas, in Chinese',
    },
    improvedHooks: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 rewritten hook/opening lines that would perform better',
    },
  },
  required: ['creator', 'visibleText', 'hookScore', 'category', 'summary', 'insights', 'suggestions', 'improvedHooks'],
  additionalProperties: false,
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY 还没设置' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const imageBase64 = body.imageBase64 || ''
  const mediaType = body.mediaType || 'image/png'
  if (!imageBase64) {
    return json({ error: '请上传截图' }, 400)
  }
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mediaType)) {
    return json({ error: '只支持 PNG / JPG / WebP / GIF 图片' }, 400)
  }
  if (imageBase64.length > 10 * 1024 * 1024) {
    return json({ error: '图片太大（超过约7MB），请截小一点或压缩' }, 413)
  }

  const isAds = body.mode === 'ads'
  const prompt = isAds
    ? `你是广告投放与转化专家。这是一张广告的截图（可能来自 FB/IG/TikTok/小红书）。请先把截图里所有有意义的文字读出来（文案、字幕、按钮文字），认出创作者/品牌 handle，然后用广告标准拆解它：前3秒/首屏 hook 是否让目标受众停下、痛点/欲望是否明确、卖点与差异化、信任元素、CTA 强度、视觉排版是否助攻。insights 讲这条广告为什么有效/无效，suggestions 给具体可抄可改的点子，improvedHooks 重写更强的开头/首屏大字。用中文输出。`
    : `你是短视频/社媒内容策略专家。这是一张帖子或视频的截图。请先把截图里所有有意义的文字读出来（文案、字幕、覆盖文字），认出创作者 handle，然后分析它的 hook、内容结构和传播潜力，给出改进建议和更强的开头写法。用中文输出。`

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
      output_config: { format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!claudeRes.ok) {
    const t = await claudeRes.text()
    return json({ error: `AI 分析失败 (Claude ${claudeRes.status})`, detail: t.slice(0, 500) }, 502)
  }

  const data = await claudeRes.json()
  if (data.stop_reason === 'refusal') {
    return json({ error: '这张图无法分析，请换一张。' }, 422)
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text')
  let analysis
  try {
    analysis = JSON.parse(textBlock.text)
  } catch {
    return json({ error: '分析结果解析失败，请重试。' }, 502)
  }

  return json({ analysis })
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
