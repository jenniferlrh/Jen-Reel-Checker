import { useState } from 'react'
import './AnalyzeForm.css'
import { apiFetch } from '../lib/api'

const AREA_CHIPS = ['Bukit Jalil', 'KLCC']

export default function ScriptGenerator({ onClose }) {
  const [area, setArea] = useState('')
  const [language, setLanguage] = useState('ENG')
  const [numHeadings, setNumHeadings] = useState(4)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [script, setScript] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async () => {
    if (!area.trim()) {
      setError('先填区域/主题（例如 Bukit Jalil）')
      return
    }
    setLoading(true)
    setError('')
    setScript(null)
    try {
      const res = await apiFetch('/api/generate-script', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ area, language, numHeadings, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `生成失败 (${res.status})`)
      setScript(data.script)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buildMd = () => {
    const s = script
    return [
      `# ${s.campaignName}`,
      '',
      ...s.headings.flatMap((h, i) => [
        `## Heading ${i + 1}（${h.label}）`,
        '',
        h.heading,
        ...(h.subheading ? ['', `**Subheading:**`, '', h.subheading] : []),
        '',
      ]),
      '## Body（全部版本共用）',
      '',
      s.body,
      '',
      '## CTA（全部版本共用）',
      '',
      s.cta,
      '',
      '## FB 文案 (Primary Text)',
      '',
      s.adCopy,
      '',
      '## 拍摄建议',
      '',
      ...s.tips.map((t) => `- ${t}`),
      '',
    ].join('\n')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildMd())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('复制失败')
    }
  }

  return (
    <div className="analyze-overlay" onClick={onClose}>
      <div className="analyze-modal ads-research-modal" onClick={(e) => e.stopPropagation()}>
        <button className="analyze-close" onClick={onClose}>✕</button>
        <h2>✍️ 新 Ads Script</h2>

        {!script && (
          <>
            <p className="analyze-hint">
              按你的格式生成：几个不同 Heading + 同一个 Body + CTA。AI 会用你的 Ads Brain（赢家风格 + hook 套路）来写。
            </p>

            <label className="input-label" style={{ marginTop: '0.5rem' }}>区域 / 主题</label>
            <input
              className="analyze-url-input"
              type="text"
              placeholder="例如 Bukit Jalil / KLCC / 其他主题"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
            <div className="analyze-tabs" style={{ flexWrap: 'wrap', margin: '0 0 0.75rem' }}>
              {AREA_CHIPS.map((c) => (
                <button
                  key={c}
                  className={`tab${area === c ? ' active' : ''}`}
                  style={{ flex: 'none', padding: '0.4rem 0.8rem' }}
                  onClick={() => setArea(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label className="input-label">语言</label>
                <select
                  className="analyze-url-input"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="ENG">English (ENG)</option>
                  <option value="CHI">中文 (CHI)</option>
                  <option value="MALAY">Malay</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label className="input-label">几个 Heading 版本</label>
                <select
                  className="analyze-url-input"
                  value={numHeadings}
                  onChange={(e) => setNumHeadings(Number(e.target.value))}
                >
                  <option value={3}>3 个</option>
                  <option value={4}>4 个</option>
                  <option value={5}>5 个</option>
                </select>
              </div>
            </div>

            <label className="input-label">特别要求（可留空）</label>
            <textarea
              rows={3}
              placeholder="例如：要蹭最近的新闻 / 要针对 SG 买家 / 不要恐吓型..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {error && <div className="analyze-error">⚠️ {error}</div>}
            <button className="analyze-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? '✍️ AI 用你的风格写 script 中... (约1分钟)' : '✨ 生成 Script'}
            </button>
          </>
        )}

        {script && (
          <div className="ads-report">
            <h3>📁 {script.campaignName}</h3>

            {script.headings.map((h, i) => (
              <div key={i} style={{ marginBottom: '0.75rem' }}>
                <h4>🪝 Heading {i + 1} <span style={{ fontWeight: 400, fontSize: '0.85em', opacity: 0.7 }}>（{h.label}）</span></h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{h.heading}</p>
                {h.subheading && (
                  <p style={{ whiteSpace: 'pre-wrap', opacity: 0.85 }}><strong>Subheading:</strong> {h.subheading}</p>
                )}
              </div>
            ))}

            <h4>📄 Body（全部版本共用）</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>{script.body}</p>

            <h4>👆 CTA（全部版本共用）</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>{script.cta}</p>

            <h4>📱 FB 文案 (Primary Text)</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>{script.adCopy}</p>

            <h4>🎬 拍摄建议</h4>
            <ul>{script.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="analyze-submit" style={{ flex: 1 }} onClick={handleCopy}>
                {copied ? '✅ 已复制!' : '📋 Copy 全部'}
              </button>
              <button
                className="analyze-submit"
                style={{ flex: 1, background: '#f0f0f0', color: '#666', boxShadow: 'none' }}
                onClick={() => setScript(null)}
              >
                🔄 再生成一版
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
