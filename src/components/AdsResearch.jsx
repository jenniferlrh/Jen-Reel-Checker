import { useState } from 'react'
import './AnalyzeForm.css'
import { apiFetch } from '../lib/api'

export default function AdsResearch({ onClose }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [adCount, setAdCount] = useState(0)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async () => {
    if (!url.trim()) {
      setError('请贴上品牌的 Facebook 主页链接')
      return
    }
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const res = await apiFetch('/api/ads-research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `研究失败 (${res.status})`)
      setReport(data.report)
      setAdCount(data.adCount)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buildMd = () => {
    const r = report
    return [
      `# 竞品广告研究: ${r.brand}`,
      '',
      `分析了 ${adCount} 条正在投放的广告`,
      '',
      '## 整体策略',
      '',
      r.overview,
      '',
      '## 反复使用的套路',
      '',
      ...r.patterns.map((p) => `- ${p}`),
      '',
      '## 常用 Hook',
      '',
      ...r.hooks.map((h) => `- ${h}`),
      '',
      '## CTA 风格',
      '',
      ...r.ctas.map((c) => `- ${c}`),
      '',
      '## 可以偷学的点子',
      '',
      ...r.stealIdeas.map((s) => `- ${s}`),
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
        <h2>🕵️ 竞品广告研究</h2>

        {!report && (
          <>
            <p className="analyze-hint">
              贴上品牌的 Facebook 主页链接，自动抓取它正在投放的广告，AI 拆解它的打法（约 1-2 分钟）
            </p>
            <input
              className="analyze-url-input"
              type="text"
              placeholder="https://www.facebook.com/品牌主页"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {error && <div className="analyze-error">⚠️ {error}</div>}
            <button className="analyze-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? '🕵️ 抓取广告 → AI 拆解中... (约1-2分钟)' : '✨ 开始研究'}
            </button>
          </>
        )}

        {report && (
          <div className="ads-report">
            <p className="analyze-hint">分析了 {adCount} 条正在投放的广告</p>
            <h3>🏷️ {report.brand}</h3>
            <p className="ads-overview">{report.overview}</p>

            <h4>🔁 反复使用的套路</h4>
            <ul>{report.patterns.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h4>🪝 常用 Hook</h4>
            <ul>{report.hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>

            <h4>👆 CTA 风格</h4>
            <ul>{report.ctas.map((c, i) => <li key={i}>{c}</li>)}</ul>

            <h4>💡 可以偷学的点子</h4>
            <ul>{report.stealIdeas.map((s, i) => <li key={i}>{s}</li>)}</ul>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="analyze-submit" style={{ flex: 1 }} onClick={handleCopy}>
                {copied ? '✅ 已复制!' : '📋 Copy 报告'}
              </button>
              <button
                className="analyze-submit"
                style={{ flex: 1, background: '#f0f0f0', color: '#666', boxShadow: 'none' }}
                onClick={() => { setReport(null); setUrl('') }}
              >
                🔄 研究另一个品牌
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
