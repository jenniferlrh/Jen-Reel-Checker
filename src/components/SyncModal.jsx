import { useState } from 'react'
import './AnalyzeForm.css'

export default function SyncModal({ currentCode, onClose, onConnect, onDisconnect }) {
  const [code, setCode] = useState(currentCode || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    const trimmed = code.trim()
    if (!/^[a-zA-Z0-9_-]{4,32}$/.test(trimmed)) {
      setError('同步码需要 4-32 位，只能用字母、数字、横线')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onConnect(trimmed)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="analyze-overlay" onClick={onClose}>
      <div className="analyze-modal" onClick={(e) => e.stopPropagation()}>
        <button className="analyze-close" onClick={onClose}>✕</button>
        <h2>☁️ 云端同步</h2>
        <p className="analyze-hint">
          设一个同步码（像密码），在手机和电脑输入同一个码，分析结果就会互通。
          码越独特越安全，别用太简单的。
        </p>

        <input
          className="analyze-url-input"
          type="text"
          placeholder="例如 jen-reel-2026"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        {error && <div className="analyze-error">⚠️ {error}</div>}

        <button className="analyze-submit" onClick={handleConnect} disabled={loading}>
          {loading ? '☁️ 连接中...' : currentCode ? '🔄 更换同步码' : '✨ 开启同步'}
        </button>

        {currentCode && (
          <button
            className="analyze-submit"
            style={{ marginTop: '0.75rem', background: '#f0f0f0', color: '#666', boxShadow: 'none' }}
            onClick={onDisconnect}
          >
            关闭同步（数据留在本机）
          </button>
        )}
      </div>
    </div>
  )
}
