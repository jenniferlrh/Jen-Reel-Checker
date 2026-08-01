// Cloudflare Pages Function: POST /api/analyze-url
// Multi-platform pipeline: video URL (IG / TikTok / XHS / Facebook)
//   -> Apify scrape -> Whisper transcription -> Claude analysis
// Requires env vars: APIFY_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    hookScore: { type: 'number', description: 'Hook strength score from 0 to 10, one decimal allowed' },
    category: { type: 'string', description: 'Short content category in Chinese, e.g. 个人成长, 金融, 房产' },
    summary: { type: 'string', description: 'One-sentence summary of the video in Chinese' },
    insights: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 analysis insights about why this video works or not, in Chinese',
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

const PLATFORMS = [
  {
    name: 'instagram',
    match: (u) => /instagram\.com\/(reel|reels|p)\//.test(u),
    actor: 'apify~instagram-scraper',
    input: (u) => ({ directUrls: [u], resultsType: 'posts', resultsLimit: 1, addParentData: false }),
  },
  {
    name: 'tiktok',
    match: (u) => /tiktok\.com\//.test(u) || /vt\.tiktok\.com\//.test(u),
    actor: 'clockworks~tiktok-video-scraper',
    input: (u) => ({ postURLs: [u], resultsPerPage: 1 }),
  },
  {
    name: 'xiaohongshu',
    match: (u) => /xiaohongshu\.com\//.test(u) || /xhslink\.com\//.test(u),
    actor: 'easyapi~rednote-xiaohongshu-video-downloader',
    input: (u) => ({ links: [u] }),
  },
  {
    name: 'facebook',
    match: (u) => /facebook\.com\//.test(u) || /fb\.watch\//.test(u),
    actor: 'solid-scraper~facebook-video-downloader',
    input: (u) => ({ video_urls: [u], requested_resolution: 'SD' }),
  },
]

function deepFindVideoUrl(obj, depth = 0) {
  if (depth > 6 || obj == null) return null
  if (typeof obj === 'string') {
    if (/^https?:\/\//.test(obj) && (/\.mp4/i.test(obj) || /mime_type=video/i.test(obj))) return obj
    return null
  }
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const found = deepFindVideoUrl(v, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof obj === 'object') {
    // Prefer well-known fields first
    const preferred = [
      'videoUrl', 'video_url', 'videoUrlBackup', 'downloadUrl', 'download_url',
      'downloadAddr', 'playAddr', 'videoDownloadUrl', 'hd_url', 'sd_url', 'url_hd', 'url_sd',
    ]
    for (const key of preferred) {
      const v = obj[key]
      if (typeof v === 'string' && /^https?:\/\//.test(v)) return v
    }
    for (const v of Object.values(obj)) {
      const found = deepFindVideoUrl(v, depth + 1)
      if (found) return found
    }
  }
  return null
}

function pickMeta(item) {
  const creator =
    item.ownerUsername ||
    item.authorMeta?.name ||
    item.author?.nickname ||
    item.author?.name ||
    item.authorName ||
    item.nickname ||
    item.username ||
    item.uploader ||
    null
  const caption =
    item.caption || item.text || item.desc || item.description || item.title || ''
  const likes =
    item.likesCount ?? item.diggCount ?? item.likes ?? item.like_count ?? item.likedCount ?? 0
  return {
    creator: creator ? `@${String(creator).replace(/^@/, '')}` : '@unknown',
    caption: String(caption).slice(0, 200),
    likes: Number(likes) || 0,
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  const missing = ['APIFY_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].filter((k) => !env[k])
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
  const platform = PLATFORMS.find((p) => p.match(url))
  if (!platform) {
    return jsonResponse(
      { error: '暂不支持这个链接。支持：Instagram、TikTok、小红书、Facebook 的视频链接。' },
      400
    )
  }

  // ---- Step 1: Scrape video metadata + direct video URL via Apify ----
  let item
  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${platform.actor}/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}&timeout=150`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(platform.input(url)),
      }
    )
    if (!apifyRes.ok) {
      const t = await apifyRes.text()
      return jsonResponse(
        { error: `抓取 ${platform.name} 数据失败 (Apify ${apifyRes.status})`, detail: t.slice(0, 500) },
        502
      )
    }
    const items = await apifyRes.json()
    item = Array.isArray(items) ? items[0] : null
  } catch (e) {
    return jsonResponse({ error: `抓取数据出错: ${e.message}` }, 502)
  }

  if (!item) {
    return jsonResponse({ error: '抓不到这条视频的数据。确认链接是公开的，或稍后重试。' }, 404)
  }

  const videoUrl = deepFindVideoUrl(item)
  const meta = pickMeta(item)

  if (!videoUrl) {
    return jsonResponse({ error: '这条帖子里找不到视频（可能是图片帖），无法转录。' }, 422)
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
      return jsonResponse({ error: '视频超过 24MB，太长了无法转录（先支持短视频）。' }, 422)
    }

    const form = new FormData()
    form.append('file', videoBlob, 'video.mp4')
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
    transcript = '(这条视频没有语音内容，仅有画面/音乐)'
  }

  // ---- Step 3: Analyze with Claude ----
  const isAds = body.mode === 'ads'
  const prompt = isAds
    ? `你是广告投放与转化专家。以下是一条${platform.name}广告视频的文字稿，用广告标准拆解它。

平台: ${platform.name}
创作者/品牌: ${meta.creator}
${meta.caption ? `广告文案: ${meta.caption}\n` : ''}点赞数: ${meta.likes}
文字稿:
"""
${transcript}
"""

评分标准（广告专用）：前3秒 hook 是否让目标受众停下、痛点/欲望是否明确、卖点与差异化是否清晰、信任元素（证据/权威/社会认同）、CTA 强度与行动门槛、落地引导是否顺畅。insights 讲这条广告为什么有效/无效，suggestions 给具体投放和文案优化建议，improvedHooks 重写更强的广告开头。用中文输出。`
    : `你是短视频内容策略专家（Instagram Reels / TikTok / 小红书 / Facebook Reels）。分析以下视频的文字稿，评估它的 hook（开头吸引力）、内容结构和传播潜力。

平台: ${platform.name}
创作者: ${meta.creator}
${meta.caption ? `帖子文案: ${meta.caption}\n` : ''}点赞数: ${meta.likes}
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
    return jsonResponse({ error: '这段内容无法分析，请换一条视频。' }, 422)
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
    meta: { ...meta, url, platform: platform.name },
  })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
