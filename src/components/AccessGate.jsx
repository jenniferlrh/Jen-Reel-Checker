import { useState, useEffect, useRef } from 'react'
import './AnalyzeForm.css'

export default function AccessGate({ onUnlock }) {
  const [username, setUsername] = useState('')
  const [stage, setStage] = useState('input') // input | pending | denied | kicked
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  const startPolling = (token) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/access-status?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (data.status === 'approved') {
          clearInterval(pollRef.current)
          localStorage.setItem('accessToken', token)
          localStorage.setItem('accessUser', data.username || username)
          onUnlock()
        } else if (data.status === 'denied') {
          clearInterval(pollRef.current)
          setStage('denied')
        } else if (data.status === 'kicked') {
          clearInterval(pollRef.current)
          setStage('kicked')
        }
      } catch {
        // keep polling
      }
    }, 3000)
  }

  const handleSubmit = async () => {
    const name = username.trim().toLowerCase()
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(name)) {
      setError('Username 需要 3-20 位，只能用字母、数字、横线')
      return
    }
    setLoading(true)
    setError('')
    try {
      const label = /iPhone|Android|Mobile/i.test(navigator.userAgent) ? 'Phone' : 'Computer'
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: name, label }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
      if (data.status === 'approved') {
        localStorage.setItem('accessToken', data.token)
        localStorage.setItem('accessUser', name)
        onUnlock()
      } else {
        setStage('pending')
        startPolling(data.token)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #5e4fa2 0%, #3d2c6d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div className="analyze-modal" style={{ maxWidth: 420, textAlign: 'center' }}>
        {stage === 'input' && (
          <>
            <h2 style={{ marginBottom: '0.5rem' }}>🎬 Jen Reel Checker</h2>
            <p className="analyze-hint">输入你的 username。第一次使用需要 Jennifer 批准（这台设备只需申请一次）</p>
            <input
              className="analyze-url-input"
              type="text"
              placeholder="你的 username，例如 amylee"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            {error && <div className="analyze-error">⚠️ {error}</div>}
            <button className="analyze-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? '发送请求中...' : '🚀 请求使用'}
            </button>
          </>
        )}

        {stage === 'pending' && (
          <>
            <h2 style={{ marginBottom: '0.5rem' }}>⏳ 等待批准中...</h2>
            <p className="analyze-hint">
              已通知 Jennifer 的 Telegram。她按下 ✅ Allow 后，这个页面会自动进入。
              请保持页面打开。
            </p>
            <div style={{ fontSize: 40, margin: '1rem 0' }}>📲</div>
          </>
        )}

        {stage === 'denied' && (
          <>
            <h2 style={{ marginBottom: '0.5rem' }}>❌ 请求被拒绝</h2>
            <p className="analyze-hint">Jennifer 拒绝了这次请求。</p>
            <button className="analyze-submit" onClick={() => { setStage('input'); setUsername('') }}>
              重新申请
            </button>
          </>
        )}

        {stage === 'kicked' && (
          <>
            <h2 style={{ marginBottom: '0.5rem' }}>🚫 权限已被移除</h2>
            <p className="analyze-hint">你的使用权限已被移除。如需继续使用请联系 Jennifer。</p>
            <button className="analyze-submit" onClick={() => { setStage('input'); setUsername('') }}>
              重新申请
            </button>
          </>
        )}
      </div>
    </div>
  )
}
