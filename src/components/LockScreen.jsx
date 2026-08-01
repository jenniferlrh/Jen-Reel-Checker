import { useState } from 'react'
import './AnalyzeForm.css'

export default function LockScreen({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!pw.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'x-site-key': pw.trim() },
      })
      if (!res.ok) {
        throw new Error('密码不对')
      }
      localStorage.setItem('siteKey', pw.trim())
      onUnlock()
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
      <div className="analyze-modal" style={{ maxWidth: 400, textAlign: 'center' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>🔒 Jen Reel Checker</h2>
        <p className="analyze-hint">这是私人工具。输入密码解锁（这台设备只需输入一次）</p>
        <input
          className="analyze-url-input"
          type="password"
          placeholder="密码"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        {error && <div className="analyze-error">⚠️ {error}</div>}
        <button className="analyze-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? '验证中...' : '🔓 解锁'}
        </button>
      </div>
    </div>
  )
}
