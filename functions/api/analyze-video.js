// Cloudflare Pages Function: POST /api/analyze-video
// Body = raw video bytes (her own upload). Pipeline:
//   droplet /upload (frames + normalized mp3) -> Whisper transcript
//   -> Claude (vision on frames + transcript) -> analysis + cover suggestions
// Requires env vars: ADMIN_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY

import { ADS_BRAIN } from './_brain.js'
import { COVER_RULES } from './_cover-rules.js'

const MEDIA_URL = 'http://167-71-220-201.sslip.io:2052/upload'
const MAX_BYTES = 50 * 1024 * 1024

const VIDEO_SCHEMA = {
  type: 'object',
  properties: {
    hookScore: { type: 'number', description: 'Hook strength 0-10, one decimal' },
    category: { type: 'string', description: 'Short content category in Chinese' },
    summary: { type: 'string', description: 'One-sentence summary in Chinese' },
    insights: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 insights about why this video works or not, in Chinese',
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 concrete improvement suggestions, in Chinese',
    },
    improvedHooks: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 stronger opening lines, same language as the video',
    },
    editingScore: { type: 'number', description: 'Editing quality 0-10 judged from the frames' },
    editingInsights: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 observations about pacing, visuals, text overlays, in Chinese',
    },
    coverTexts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The cover text exactly as it should appear, line breaks with \\n. Main line short.' },
          formula: { type: 'string', description: 'Which formula/hook type this uses, in Chinese e.g. 数字型, 避坑型, 悬念型' },
          why: { type: 'string', description: 'Why this would stop the scroll, in Chinese, one sentence' },
        },
        required: ['text', 'formula', 'why'],
        additionalProperties: false,
      },
      description: '5 cover text options, each using a DIFFERENT formula',
    },
    coverFrame: {
      type: 'object',
      properties: {
        seconds: { type: 'number', description: 'Timestamp in seconds of the best frame to use as the cover' },
        reason: { type: 'string', description: 'Why that frame, in Chinese' },
      },
      required: ['seconds', 'reason'],
      additionalProperties: false,
    },
    coverVisual: {
      type: 'string',
      description: 'Concrete art direction for the cover in Chinese: text placement, colour, size, what to add or crop',
    },
  },
  required: ['hookScore', 'category', 'summary', 'insights', 'suggestions', 'improvedHooks',
    'editingScore', 'editingInsights', 'coverTexts', 'coverFrame', 'coverVisual'],
  additionalProperties: false,
}

export async function onRequestPost(context) {
  const { request, env } = context

  const missing = ['ADMIN_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].filter((k) => !env[k])
  if (missing.length) {
    return jsonResponse({ error: `还没设置：${missing.join(', ')}` }, 500)
  }

  // Two ways in:
  //  A) JSON — the browser already pulled out frames + a small WAV (no size limit)
  //  B) raw video bytes — fallback when the browser can't decode the file
  const isJson = (request.headers.get('content-type') || '').includes('application/json')
  let media
  // Optional context the UI passes along so the model doesn't have to guess.
  let note = (request.headers.get('x-video-note') || '').slice(0, 300)
  try {
    note = note ? decodeURIComponent(note) : ''
  } catch {
    // header wasn't encoded; use as-is
  }
  const isAds = (request.headers.get('x-analysis-mode') || '') === 'ads'
  let business = (request.headers.get('x-video-business') || 'auto').toLowerCase()

  if (isJson) {
    let body
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }
    if (body.note) note = String(body.note).slice(0, 300)
    if (body.business) business = String(body.business).toLowerCase()
    media = {
      frames: Array.isArray(body.frames) ? body.frames : [],
      timestamps: Array.isArray(body.timestamps) ? body.timestamps : [],
      duration: body.duration || null,
      audio: body.audioWav || null,
      audioType: 'wav',
    }
  } else {
    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > MAX_BYTES) {
      return jsonResponse({ error: '这个视频太大了（浏览器也读不出来）。用 CapCut 导出成 mp4 再试。' }, 413)
    }
    const bytes = await request.arrayBuffer()
    if (!bytes || bytes.byteLength < 1000) {
      return jsonResponse({ error: '没有收到视频文件。' }, 400)
    }
    if (bytes.byteLength > MAX_BYTES) {
      return jsonResponse({ error: '这个视频太大了（浏览器也读不出来）。用 CapCut 导出成 mp4 再试。' }, 413)
    }
    try {
      const mr = await fetch(MEDIA_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream', 'x-jrc-key': env.ADMIN_KEY },
        body: bytes,
      })
      if (!mr.ok) {
        const detail = await mr.text().catch(() => '')
        return jsonResponse({ error: `处理视频失败 (${mr.status}) ${detail.slice(0, 200)}` }, 502)
      }
      media = await mr.json()
      media.audioType = 'mp3'
    } catch (e) {
      return jsonResponse({ error: `处理视频失败：${String(e.message || e)}` }, 502)
    }
  }

  const frames = Array.isArray(media.frames) ? media.frames.slice(0, 16) : []
  const timestamps = Array.isArray(media.timestamps) ? media.timestamps : []
  if (!frames.length) {
    return jsonResponse({ error: '这个视频读不出画面，换个格式（mp4）再试。' }, 422)
  }

  // ---- Step 2: transcribe ----
  let transcript = ''
  if (media.audio) {
    try {
      const raw = Uint8Array.from(atob(media.audio), (c) => c.charCodeAt(0))
      const isWav = media.audioType === 'wav'
      const form = new FormData()
      form.append(
        'file',
        new Blob([raw], { type: isWav ? 'audio/wav' : 'audio/mpeg' }),
        isWav ? 'audio.wav' : 'audio.mp3'
      )
      form.append('model', 'whisper-1')
      const wr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form,
      })
      if (wr.ok) {
        const wd = await wr.json()
        transcript = (wd.text || '').trim()
      }
    } catch {
      // transcription is best-effort; a silent video still gets a cover
    }
  }

  // ---- Step 3: Claude — analysis + cover suggestions ----
  const content = frames.map((b64) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
  }))

  const noteLine = note ? `\nJennifer 给这条视频的备注：「${note}」（以她的备注为准）\n` : ''
  const businessLine =
    business === 'homestay'
      ? '\n📌 Jennifer 已经指明：**这条视频是 4Balance Homestay（民宿/短租管理）的内容**，跟房产投资 webinar 完全无关。分析、建议、封面文字全部只能围绕 homestay 这门生意（招 owner 托管、招住客、展示单位、装修改造等，看视频实际内容而定）。绝对不要出现 Bukit Jalil / KLCC / 项目对比 / webinar 报名。\n'
      : business === 'property'
        ? '\n📌 Jennifer 已经指明：**这条视频是房产投资 webinar 那条线的内容**，可以套用下面的广告风格档案（hook 套路、卖点、CPL 标准）。\n'
        : '\n📌 Jennifer 没有指定主题，你要自己从转录和画面判断这条视频属于哪门生意，然后就事论事分析。\n'
  const lens = isAds
    ? '用广告/转化标准评（hook 有没有让人停、痛点清不清楚、卖点差异化、信任元素、CTA 强度）'
    : '用内容/留存标准评（前3秒抓不抓人、叙事节奏、有没有价值点或情绪点、结尾行动引导）'

  content.push({
    type: 'text',
    text: `这是 Jennifer 自己拍的视频。上面 ${frames.length} 张图是按时间顺序抽出来的画面，对应的秒数分别是：${timestamps.join(', ')} 秒。视频总长 ${media.duration} 秒。
${businessLine}${noteLine}
${transcript ? `视频里说的话（自动转录，可能有错字）：\n"""\n${transcript}\n"""` : '（这条视频没有人声/转录失败，只能看画面判断）'}

⚠️ 第一步最重要：先从转录和画面判断**这条视频到底在讲什么、在卖什么、给谁看**，然后就事论事地分析它。

Jennifer 有不只一门生意（房产投资 webinar 是其中一门，另外还有 homestay / 短租管理等）。下面那份「广告资料」只是她**过去房产 webinar 广告**的风格档案和历史数据——只能用来参考她的表达风格和质量标准。

绝对不要做的事：
- 不要假设这条视频是房产 webinar 广告。
- 如果这条视频的主题不是房产 webinar（例如是 homestay、单位导览、装修、其他业务），**绝对不要**把 Bukit Jalil / KLCC / 项目对比 / webinar 报名 这些内容塞进 insights、suggestions、improvedHooks 或封面文字里。
- 封面文字必须是这条视频**自己**的主题和卖点，讲给**这条视频的目标观众**听。

=== 参考：她过去房产 webinar 广告的风格档案（只作风格参考）===
${ADS_BRAIN}
=== 结束 ===

=== 封面标题研究（无论什么主题都要遵守）===
${COVER_RULES}
=== 结束 ===

任务：
1. category 要写这条视频真正的类别（例如 民宿/短租、房产、装修…）。summary 一句话讲清楚它在讲什么、给谁看。
2. ${lens}。insights/suggestions 要针对这条视频的真实主题，具体、能执行。
3. 看画面判断剪辑质量 editingScore 和 editingInsights（节奏、画面、字幕、B-roll）。
4. 最重要：给 5 个**封面文字**方案（coverTexts），每个用不同公式，符合上面的封面研究规则，语言跟视频一致（中文视频给中文，可中英混）。必须贴合这条视频真正的内容。
5. coverFrame：从上面给的秒数里挑一个最适合当封面的画面（要有视觉冲击、有主体、不糊），讲清楚为什么。
6. coverVisual：具体封面美术指导 — 文字放哪、多大、什么颜色、要不要加箭头/圈、要不要裁切。

全部分析用中文写。`,
  })

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: 8192,
      output_config: { format: { type: 'json_schema', schema: VIDEO_SCHEMA } },
      messages: [{ role: 'user', content }],
    }),
  })

  if (!apiRes.ok) {
    const errText = await apiRes.text()
    return jsonResponse({ error: `Claude API error (${apiRes.status})`, detail: errText.slice(0, 300) }, 502)
  }

  const data = await apiRes.json()
  if (data.stop_reason === 'refusal') {
    return jsonResponse({ error: '这条视频无法分析，换一条试试。' }, 422)
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text')
  if (!textBlock) return jsonResponse({ error: 'AI 没有返回结果，请重试。' }, 502)

  let analysis
  try {
    analysis = JSON.parse(textBlock.text)
  } catch {
    return jsonResponse({ error: '结果解析失败，请重试。' }, 502)
  }

  return jsonResponse({
    analysis,
    transcript: transcript || '(这条视频没有人声)',
    duration: media.duration,
  })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
