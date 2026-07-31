import { useState } from 'react'
import './AnalyzeForm.css'

export default function AnalyzeForm({ onClose, onAnalyzed }) {
  const [creator, setCreator] = useState('')
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      setError('请贴上 reel 的文字稿')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator, title, transcript }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `分析失败 (${res.status})`)
      }
      onAnalyzed({ creator, title, transcript, analysis: data.analysis })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="analyze-overlay" onClick={onClose}>
      <div className="analyze-modal" onClick={(e) => e.stopPropagation()}>
        <button className="analyze-close" onClick={onClose}>✕</button>
        <h2>🎬 AI 分析 Reel</h2>
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

        {error && <div className="analyze-error">⚠️ {error}</div>}

        <button className="analyze-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? '🧠 AI 分析中... (约10-30秒)' : '✨ 开始分析'}
        </button>
      </div>
    </div>
  )
}
