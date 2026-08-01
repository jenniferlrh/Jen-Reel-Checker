// Cloudflare Pages Function: POST /api/analyze
// Analyzes an Instagram reel transcript with the Claude API.
// Requires ANTHROPIC_API_KEY set as an environment variable in Cloudflare Pages.

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    hookScore: { type: 'number', description: 'Hook strength score from 0 to 10, one decimal allowed' },
    category: { type: 'string', description: 'Short content category in Chinese, e.g. 个人成长, 金融, 房产' },
    summary: { type: 'string', description: 'One-sentence summary of the reel in Chinese' },
    insights: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 analysis insights about why this reel works or not, in Chinese',
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 concrete improvement suggestions, in Chinese',
    },
    improvedHooks: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 rewritten opening hook lines that would perform better, same language as the transcript',
    },
  },
  required: ['hookScore', 'category', 'summary', 'insights', 'suggestions', 'improvedHooks'],
  additionalProperties: false,
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY 还没设置。去 Cloudflare Pages → Settings → Environment variables 添加。' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const transcript = (body.transcript || '').trim()
  if (!transcript) {
    return jsonResponse({ error: '请提供 transcript（文字稿）' }, 400)
  }

  const title = (body.title || '').trim()
  const creator = (body.creator || '').trim()

  const isAds = body.mode === 'ads'
  const prompt = isAds
    ? `你是广告投放与转化专家。以下是一条广告视频的文字稿，用广告标准拆解它。

${creator ? `创作者/品牌: ${creator}\n` : ''}${title ? `标题: ${title}\n` : ''}文字稿:
"""
${transcript}
"""

评分标准（广告专用）：前3秒 hook 是否让目标受众停下、痛点/欲望是否明确、卖点与差异化是否清晰、信任元素（证据/权威/社会认同）、CTA 强度与行动门槛、落地引导是否顺畅。insights 讲这条广告为什么有效/无效，suggestions 给具体投放和文案优化建议，improvedHooks 重写更强的广告开头。用中文输出。`
    : `你是 Instagram Reel 内容策略专家。分析以下 reel 的文字稿，评估它的 hook（开头吸引力）、内容结构和传播潜力。

${creator ? `创作者: ${creator}\n` : ''}${title ? `标题: ${title}\n` : ''}文字稿:
"""
${transcript}
"""

评分标准：hook 前3秒是否抓人（悬念、冲突、反常识、数字）、叙事节奏、是否有明确的价值点或情绪点、结尾是否有行动引导。用中文输出分析。`

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!apiRes.ok) {
    const errText = await apiRes.text()
    return jsonResponse({ error: `Claude API error (${apiRes.status})`, detail: errText }, 502)
  }

  const data = await apiRes.json()

  if (data.stop_reason === 'refusal') {
    return jsonResponse({ error: '这段内容无法分析，请换一段文字稿试试。' }, 422)
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text')
  if (!textBlock) {
    return jsonResponse({ error: 'AI 没有返回分析结果，请重试。' }, 502)
  }

  let analysis
  try {
    analysis = JSON.parse(textBlock.text)
  } catch {
    return jsonResponse({ error: '分析结果解析失败，请重试。' }, 502)
  }

  return jsonResponse({ analysis })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
