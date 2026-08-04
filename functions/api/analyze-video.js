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

  if (isJson) {
    let body
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }
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

  content.push({
    type: 'text',
    text: `这是 Jennifer 自己拍的视频（她是马来西亚房产投资 webinar 的广告主）。上面 ${frames.length} 张图是按时间顺序抽出来的画面，对应的秒数分别是：${timestamps.join(', ')} 秒。视频总长 ${media.duration} 秒。

${transcript ? `视频里说的话（自动转录，可能有错字）：\n"""\n${transcript}\n"""` : '（这条视频没有人声/转录失败，只能看画面判断）'}

=== 她的广告风格与历史数据 ===
${ADS_BRAIN}
=== 结束 ===

=== 封面标题研究（必须遵守）===
${COVER_RULES}
=== 结束 ===

任务：
1. 用广告标准分析这条视频（hook 强不强、结构、说服力），insights/suggestions 要具体、能执行。
2. 看画面判断剪辑质量 editingScore 和 editingInsights（节奏、画面、字幕、B-roll）。
3. 最重要：给 5 个**封面文字**方案（coverTexts）。每个用不同的公式，必须符合上面的封面研究规则，语言跟视频一致（中文视频给中文，英文视频给英文，可中英混）。要贴合这条视频真正讲的内容，不要泛泛而谈。
4. coverFrame：从上面给的秒数里挑一个最适合当封面的画面，讲清楚为什么（要有视觉冲击、有主体、不糊）。
5. coverVisual：具体的封面美术指导 — 文字放哪里、多大、什么颜色、要不要加箭头/圈/贴纸、要不要裁切。

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
