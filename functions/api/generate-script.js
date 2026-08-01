// Cloudflare Pages Function: POST /api/generate-script
// Generates new ad scripts in Jennifer's format (multiple Headings + one shared
// Body + one CTA) using the ads-brain knowledge base as style grounding.

import { ADS_BRAIN } from './_brain.js'

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    campaignName: {
      type: 'string',
      description:
        "Suggested campaign name following her convention DDMMYY AREA: TYPE (AUDIENCE), e.g. '020826 BJ: WEBINAR (ENG) - (MSIA/SG)'. Use today's date from the prompt.",
    },
    headings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description:
              "Short label of the hook type in Chinese, e.g. '恐吓型', '列项目名', 'Agent阴谋论', '蹭新闻', '问句型'",
          },
          heading: { type: 'string', description: 'The spoken heading/hook script, short lines, one clause per line' },
          subheading: {
            type: 'string',
            description: 'Optional subheading continuation. Empty string if not needed.',
          },
        },
        required: ['label', 'heading', 'subheading'],
        additionalProperties: false,
      },
      description: 'The heading variants (each = one video version)',
    },
    body: { type: 'string', description: 'ONE shared body used by all heading versions, in her voice, short spoken lines' },
    cta: { type: 'string', description: 'ONE shared CTA, in her style (click below + bonus reveal + scarcity)' },
    adCopy: {
      type: 'string',
      description:
        'Facebook primary text in her emoji-bullet style (like the BJ champion ad: 🚨 hook line, then 📍🏙📊⚠️ bullets, then 🗓 CTA line)',
    },
    tips: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 short production/B-roll tips for shooting these versions, in Chinese',
    },
  },
  required: ['campaignName', 'headings', 'body', 'cta', 'adCopy', 'tips'],
  additionalProperties: false,
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY 还没设置。' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const area = (body.area || '').trim()
  if (!area) return jsonResponse({ error: '请填写区域/主题（例如 Bukit Jalil, KLCC）' }, 400)

  const language = (body.language || 'ENG').trim() // ENG | CHI | MALAY
  const numHeadings = Math.min(Math.max(parseInt(body.numHeadings, 10) || 4, 2), 6)
  const notes = (body.notes || '').trim()

  const langLine =
    language === 'CHI'
      ? '脚本语言：中文（马来西亚华人口语，可夹杂英文词，参考她的 Pavilion Square 中文线风格）'
      : language === 'MALAY'
        ? 'Script language: colloquial Malaysian Malay (santai, boleh campur sikit English, macam batch Malay dia: "Gais, tau tak...")'
        : 'Script language: conversational Malaysian English (short spoken lines, same voice as her winning scripts)'

  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0')
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const yy = String(today.getFullYear()).slice(2)

  const prompt = `You are Jennifer's personal ads copywriter. You have studied her entire ads knowledge base below. Write NEW ad scripts in EXACTLY her format.

=== ADS BRAIN (her style, winners, benchmarks) ===
${ADS_BRAIN}
=== END ADS BRAIN ===

Task: create ONE new ad batch for: ${area}
${langLine}
Number of heading versions: ${numHeadings} — each heading MUST use a DIFFERENT hook type from her Hook Playbook (label each one).
${notes ? `Special requirements from Jennifer: ${notes}` : 'No special requirements — pick the angles you believe will get the lowest cost per lead, based on the winners in the brain.'}
Today's date for campaign naming: ${dd}${mm}${yy}

Rules:
- Format = her template: ${numHeadings} different Headings (subheading optional) + ONE shared Body + ONE shared CTA. Every heading must flow naturally into the SAME body.
- Voice: short spoken lines (subtitle-length beats), one clause per line, numbers everywhere, curiosity gaps (never reveal which project), "agents don't want you to know" energy where fitting.
- Reuse her signature lines where natural, but do NOT copy a winning heading word-for-word — write fresh variants.
- Body must pitch the free live group webinar (interactive, limited slots) unless her special requirements say otherwise.
- adCopy = the Facebook primary text in her emoji-bullet champion style, in the same language as the script.
- tips: concrete B-roll/shooting ideas matching her production style (drone, project-name pop-ups, censor effect, etc).`

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
      output_config: { format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!apiRes.ok) {
    const errText = await apiRes.text()
    return jsonResponse({ error: `Claude API error (${apiRes.status})`, detail: errText }, 502)
  }

  const data = await apiRes.json()
  if (data.stop_reason === 'refusal') {
    return jsonResponse({ error: '这个主题无法生成，请换个说法试试。' }, 422)
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text')
  if (!textBlock) return jsonResponse({ error: 'AI 没有返回结果，请重试。' }, 502)

  let script
  try {
    script = JSON.parse(textBlock.text)
  } catch {
    return jsonResponse({ error: '结果解析失败，请重试。' }, 502)
  }

  return jsonResponse({ script })
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
