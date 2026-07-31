// Cloudflare Pages Function: POST /api/analyze-url
// Full pipeline: Instagram reel URL -> Apify scrape -> Whisper transcription -> Claude analysis
// Requires env vars: APIFY_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY

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

  const missing = ['APIFY_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].filter((k) => !env[k])
  if (missing.length > 0) {
    return jsonResponse({ error: `还没设置环境变量: ${missing.join(', ')}。去 Cloudflare Pages → Settings → Variables and secrets 添加。` }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const url = (body.url || '').trim()
  if (!/instagram\.com\/(reel|reels|p)\//.test(url)) {
    return jsonResponse({ error: '请提供有效的 Instagram reel 链接，例如 https://www.instagram.com/reel/xxxx/' }, 400)
  }

  // ---- Step 1: Scrape reel metadata + video URL via Apify ----
  let item
  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}&timeout=120`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          directUrls: [url],
          resultsType: 'posts',
          resultsLimit: 1,
          addParentData: false,
        }),
      }
    )
    if (!apifyRes.ok) {
      const t = await apifyRes.text()
      return jsonResponse({ error: `抓取 Instagram 数据失败 (Apify ${apifyRes.status})`, detail: t.slice(0, 500) }, 502)
    }
    const items = await apifyRes.json()
    item = Array.isArray(items) ? items[0] : null
  } catch (e) {
    return jsonResponse({ error: `抓取 Instagram 数据出错: ${e.message}` }, 502)
  }

  if (!item) {
    return jsonResponse({ error: '抓不到这条 reel 的数据。确认链接是公开的 reel，或稍后重试。' }, 404)
  }

  const videoUrl = item.videoUrl || item.videoUrlBackup || null
  const creator = item.ownerUsername ? `@${item.ownerUsername}` : '@unknown'
  const caption = (item.caption || '').slice(0, 200)
  const likes = item.likesCount ?? 0

  if (!videoUrl) {
    return jsonResponse({ error: '这条帖子没有视频（可能是图片帖），无法转录。' }, 422)
  }

  // ---- Step 2: Download video and transcribe with OpenAI Whisper ----
  let transcript
  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      return jsonResponse({ error: `下载视频失败 (${videoRes.status})` }, 502)
    }
    const videoBlob = await videoRes.blob()
    if (videoBlob.size > 24 * 1024 * 1024) {
      return jsonResponse({ error: '视频超过 24MB，太长了无法转录（先支持短 reel）。' }, 422)
    }

    const form = new FormData()
    form.append('file', videoBlob, 'reel.mp4')
    form.append('model', 'whisper-1')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    })
    if (!whisperRes.ok) {
      const t = await whisperRes.text()
      return jsonResponse({ error: `语音转文字失败 (OpenAI ${whisperRes.status})`, detail: t.slice(0, 500) }, 502)
    }
    const whisperData = await whisperRes.json()
    transcript = (whisperData.text || '').trim()
  } catch (e) {
    return jsonResponse({ error: `转录出错: ${e.message}` }, 502)
  }

  if (!transcript) {
    transcript = '(这条 reel 没有语音内容，仅有画面/音乐)'
  }

  // ---- Step 3: Analyze with Claude ----
  const prompt = `你是 Instagram Reel 内容策略专家。分析以下 reel 的文字稿，评估它的 hook（开头吸引力）、内容结构和传播潜力。

创作者: ${creator}
${caption ? `帖子文案: ${caption}\n` : ''}点赞数: ${likes}
文字稿:
"""
${transcript}
"""

评分标准：hook 前3秒是否抓人（悬念、冲突、反常识、数字）、叙事节奏、是否有明确的价值点或情绪点、结尾是否有行动引导。用中文输出分析。`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!claudeRes.ok) {
    const t = await claudeRes.text()
    return jsonResponse({ error: `AI 分析失败 (Claude ${claudeRes.status})`, detail: t.slice(0, 500) }, 502)
  }

  const data = await claudeRes.json()
  if (data.stop_reason === 'refusal') {
    return jsonResponse({ error: '这段内容无法分析，请换一条 reel。' }, 422)
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text')
  let analysis
  try {
    analysis = JSON.parse(textBlock.text)
  } catch {
    return jsonResponse({ error: '分析结果解析失败，请重试。' }, 502)
  }

  return jsonResponse({
    analysis,
    transcript,
    meta: { creator, caption, likes, url },
  })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
