import { useState } from 'react'
import './ReelDetail.css'
import { apiFetch } from '../lib/api'

function buildMarkdown(reel) {
  const lines = [
    `# ${reel.title}`,
    '',
    `- 创作者: ${reel.creator}`,
    `- 点赞: ${reel.likes}`,
    `- Hook 评分: ${reel.hookScore}/10`,
    `- 分类: ${reel.category}`,
  ]
  if (reel.sourceUrl) {
    lines.push(`- 原视频: ${reel.sourceUrl}`)
  }
  lines.push('', '## 文字稿', '', reel.transcript || '(无)', '')
  if (reel.summary) {
    lines.push('## 总结', '', reel.summary, '')
  }
  if (reel.insights?.length) {
    lines.push('## 分析洞察', '', ...reel.insights.map((i) => `- ${i}`), '')
  }
  if (reel.editingInsights?.length) {
    lines.push(
      `## 🎬 剪辑分析${typeof reel.editingScore === 'number' ? `（${reel.editingScore}/10）` : ''}`,
      '',
      ...reel.editingInsights.map((e) => `- ${e}`),
      ''
    )
  }
  if (reel.coverTexts?.length) {
    lines.push('## 🖼 封面文字方案', '')
    reel.coverTexts.forEach((c, i) => {
      lines.push(`### 方案 ${i + 1}（${c.formula}）`, '', '```', c.text, '```', '', `> ${c.why}`, '')
    })
    if (reel.coverFrame) {
      lines.push(`**用第 ${reel.coverFrame.seconds} 秒的画面**：${reel.coverFrame.reason}`, '')
    }
    if (reel.coverVisual) {
      lines.push('**封面美术指导**', '', reel.coverVisual, '')
    }
  }
  if (reel.suggestions?.length) {
    lines.push('## 改进建议', '', ...reel.suggestions.map((s) => `- ${s}`), '')
  }
  if (reel.improvedHooks?.length) {
    lines.push('## 更好的开头 Hook', '', ...reel.improvedHooks.map((h) => `- "${h}"`), '')
  }
  return lines.join('\n')
}

export default function ReelDetail({ reel, onBack, isSaved, onToggleSave }) {
  const [copied, setCopied] = useState(false)
  const [brainState, setBrainState] = useState('idle') // idle | saving | saved | error

  const handleBrainSave = async () => {
    if (brainState === 'saving' || brainState === 'saved') return
    setBrainState('saving')
    try {
      const res = await apiFetch('/api/brain-learn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          note: buildMarkdown(reel),
          source: reel.sourceUrl || reel.creator || 'manual',
        }),
      })
      if (!res.ok) throw new Error('failed')
      setBrainState('saved')
    } catch {
      setBrainState('error')
      setTimeout(() => setBrainState('idle'), 2500)
    }
  }

  const handleSave = () => {
    const blob = new Blob([buildMarkdown(reel)], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(reel.creator || 'reel').replace(/[@/\\:*?"<>|]/g, '')}-analysis.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown(reel))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('复制失败，请用 Save as .md 下载')
    }
  }

  return (
    <div className="detail-section">
      <div className="detail-container">
        <button className="back-button" onClick={onBack}>← Back</button>

        <div className="detail-card">
          <div className="detail-header">
            <div className="detail-avatar"></div>
            <div className="detail-info">
              <h2>{reel.creator}</h2>
              <p>Content Creator</p>
            </div>
          </div>

          {reel.sourceUrl ? (
            <a
              className="detail-video detail-video-link"
              href={reel.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ▶ 观看原视频{reel.platform ? `（${reel.platform}）` : ''}
            </a>
          ) : (
            <div className="detail-video">🎬 手动分析（无视频链接）</div>
          )}

          <div className="detail-title">{reel.title}</div>

          <div className="detail-stats">
            <div className="stat-box">
              <div className="stat-label">Engagement</div>
              <div className="stat-value">♥ {reel.likes.toLocaleString()}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Hook Score</div>
              <div className="stat-value">{reel.hookScore}/10</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Category</div>
              <div className="stat-value">{reel.category}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Status</div>
              <div className="stat-value">Analyzed</div>
            </div>
          </div>

          <div className="detail-section-title">Transcription</div>
          <div className="detail-transcript">
            {reel.transcript}
          </div>

          <div className="detail-section-title">Analysis Insights</div>
          <div className="insights-list">
            {(reel.insights && reel.insights.length > 0 ? reel.insights : [
              'Strong hook within first 3 seconds',
              'High engagement rate for content type',
              'Clear call-to-action or narrative flow',
              'Resonates with target audience demographics'
            ]).map((insight, i) => (
              <div className="insight-item" key={i}>
                <span className="insight-icon">{['✨', '📊', '🎯', '👥', '💡'][i % 5]}</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>

          {reel.editingInsights && reel.editingInsights.length > 0 && (
            <>
              <div className="detail-section-title">🎬 剪辑分析{typeof reel.editingScore === 'number' ? `（${reel.editingScore}/10)` : ''}</div>
              <div className="insights-list">
                {reel.editingInsights.map((e, i) => (
                  <div className="insight-item" key={i}>
                    <span className="insight-icon">🎞️</span>
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {reel.coverTexts && reel.coverTexts.length > 0 && (
            <>
              <div className="detail-section-title">🖼 封面文字方案</div>
              <div className="insights-list">
                {reel.coverTexts.map((c, i) => (
                  <div className="insight-item" key={i} style={{ alignItems: 'flex-start' }}>
                    <span className="insight-icon">{i + 1}️⃣</span>
                    <span>
                      <strong style={{ whiteSpace: 'pre-wrap', display: 'block', fontSize: '1.05em' }}>{c.text}</strong>
                      <span style={{ opacity: 0.7, fontSize: '0.9em' }}>（{c.formula}）{c.why}</span>
                    </span>
                  </div>
                ))}
                {reel.coverFrame && (
                  <div className="insight-item" style={{ alignItems: 'flex-start' }}>
                    <span className="insight-icon">🎯</span>
                    <span><strong>用第 {reel.coverFrame.seconds} 秒的画面</strong> — {reel.coverFrame.reason}</span>
                  </div>
                )}
                {reel.coverVisual && (
                  <div className="insight-item" style={{ alignItems: 'flex-start' }}>
                    <span className="insight-icon">🎨</span>
                    <span>{reel.coverVisual}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {reel.suggestions && reel.suggestions.length > 0 && (
            <>
              <div className="detail-section-title">💪 改进建议</div>
              <div className="insights-list">
                {reel.suggestions.map((s, i) => (
                  <div className="insight-item" key={i}>
                    <span className="insight-icon">🔧</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {reel.improvedHooks && reel.improvedHooks.length > 0 && (
            <>
              <div className="detail-section-title">🚀 更好的开头 Hook</div>
              <div className="insights-list">
                {reel.improvedHooks.map((h, i) => (
                  <div className="insight-item" key={i}>
                    <span className="insight-icon">✍️</span>
                    <span>"{h}"</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="detail-buttons">
            <button className="btn btn-secondary" onClick={onBack}>Close</button>
            <button className="btn btn-save" onClick={() => onToggleSave()}>
              {isSaved ? '❤️ Saved' : '🤍 Save'}
            </button>
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? '✅ 已复制!' : '📋 Copy'}
            </button>
            <button className="btn btn-secondary" onClick={handleBrainSave}>
              {brainState === 'saved'
                ? '✅ 已存进 Ads Brain'
                : brainState === 'saving'
                  ? '🧠 存入中...'
                  : brainState === 'error'
                    ? '⚠️ 失败，再试'
                    : '🧠 存进 Ads Brain'}
            </button>
            <button className="btn btn-primary" onClick={handleSave}>Save as .md</button>
          </div>
        </div>
      </div>
    </div>
  )
}
