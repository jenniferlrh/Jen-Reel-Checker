import { useState } from 'react'
import './AnalyzeForm.css'

export default function AnalyzeForm({ onClose, onAnalyzed, initialUrl = '' }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState(initialUrl)
  const [creator, setCreator] = useState('')
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (mode === 'url') {
      if (!url.trim()) {
        setError('请贴上视频链接（IG / TikTok / 小红书 / FB）')
        return
      }
      setLoading(true)
      try {
        const res = await fetch('/api/analyze-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `分析失败 (${res.status})`)
        onAnalyzed({
          creator: data.meta.creator,
          title: data.meta.caption || data.analysis.summary,
          likes: data.meta.likes,
          transcript: data.transcript,
          analysis: data.analysis,
          sourceUrl: data.meta.url,
          platform: data.meta.platform,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    } else {
      if (!transcript.trim()) {
        setError('请贴上 reel 的文字稿')
        return
      }
      setLoading(true)
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ creator, title, transcript }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `分析失败 (${res.status})`)
        onAnalyzed({ creator, title, transcript, analysis: data.analysis })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="analyze-overlay" onClick={onClose}>
      <div className="analyze-modal" onClick={(e) => e.stopPropagation()}>
        <button className="analyze-close" onClick={onClose}>✕</button>
        <h2>🎬 AI 分析 Reel</h2>

        <div className="analyze-tabs">
          <button
            className={mode === 'url' ? 'tab active' : 'tab'}
            onClick={() => setMode('url')}
          >
            🔗 贴链接（全自动）
          </button>
          <button
            className={mode === 'transcript' ? 'tab active' : 'tab'}
            onClick={() => setMode('transcript')}
          >
            📝 贴文字稿
          </button>
        </div>

        {mode === 'url' ? (
          <>
            <p className="analyze-hint">支持 Instagram / TikTok / 小红书 / Facebook 视频链接，自动抓取 → 转文字 → AI 分析（约 1-2 分钟）</p>
            <input
              className="analyze-url-input"
              type="text"
              placeholder="贴上 IG / TikTok / 小红书 / FB 视频链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </>
        ) : (
          <>
            <p className="analyze-hint">把 reel 里说的话（文字稿）贴进来，AI 帮你评分和给建议</p>
            <div className="analyze-row">
              <input
                type="text"
                placeholder="@创作者 (可选)"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
              />
              <input
                type="text"
                placeholder="标题 (可选)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <textarea
              placeholder="贴上 reel 的文字稿... 例如：Most people follow the same path, but..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
            />
          </>
        )}

        {error && <div className="analyze-error">⚠️ {error}</div>}

        <button className="analyze-submit" onClick={handleSubmit} disabled={loading}>
          {loading
            ? mode === 'url'
              ? '🎥 抓取 → 转文字 → AI 分析中... (约1-2分钟)'
              : '🧠 AI 分析中... (约10-30秒)'
            : '✨ 开始分析'}
        </button>
      </div>
    </div>
  )
}
