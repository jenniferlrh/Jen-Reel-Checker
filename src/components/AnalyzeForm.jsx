import { useState } from 'react'
import './AnalyzeForm.css'
import { apiFetch } from '../lib/api'

export default function AnalyzeForm({ onClose, onAnalyzed, initialUrl = '' }) {
  const [mode, setMode] = useState('url')
  const [analysisType, setAnalysisType] = useState('content')
  const [url, setUrl] = useState(initialUrl)
  const [creator, setCreator] = useState('')
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [videoFile, setVideoFile] = useState(null)
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
        const res = await apiFetch('/api/analyze-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, mode: analysisType === 'ads' ? 'ads' : 'content' }),
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
    } else if (mode === 'video') {
      if (!videoFile) {
        setError('请选择你的视频文件')
        return
      }
      if (videoFile.size > 50 * 1024 * 1024) {
        setError(`视频 ${(videoFile.size / 1024 / 1024).toFixed(0)}MB，超过 50MB 了。先压缩或剪短一点再上传。`)
        return
      }
      setLoading(true)
      try {
        const res = await apiFetch('/api/analyze-video', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: videoFile,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `分析失败 (${res.status})`)
        onAnalyzed({
          creator: creator || '@我的视频',
          title: title || data.analysis.summary,
          transcript: data.transcript,
          analysis: data.analysis,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    } else if (mode === 'image') {
      if (!imageFile) {
        setError('请选择一张截图')
        return
      }
      setLoading(true)
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
        const [meta, b64] = String(dataUrl).split(',')
        const mediaType = (meta.match(/data:(.*?);/) || [])[1] || 'image/png'
        const res = await apiFetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64, mediaType, mode: analysisType === 'ads' ? 'ads' : 'content' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `分析失败 (${res.status})`)
        onAnalyzed({
          creator: data.analysis.creator || '@unknown',
          title: data.analysis.summary,
          transcript: data.analysis.visibleText || '(截图分析)',
          analysis: data.analysis,
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
        const res = await apiFetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ creator, title, transcript, mode: analysisType === 'ads' ? 'ads' : 'content' }),
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
        <h2>🎬 AI 分析视频</h2>

        <div className="analyze-tabs analyze-type-tabs">
          <button
            className={analysisType === 'content' ? 'tab active' : 'tab'}
            onClick={() => setAnalysisType('content')}
          >
            📈 内容分析
          </button>
          <button
            className={analysisType === 'ads' ? 'tab active' : 'tab'}
            onClick={() => setAnalysisType('ads')}
          >
            📢 广告拆解
          </button>
        </div>

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
            📝 文字稿
          </button>
          <button
            className={mode === 'image' ? 'tab active' : 'tab'}
            onClick={() => setMode('image')}
          >
            📸 截图
          </button>
          <button
            className={mode === 'video' ? 'tab active' : 'tab'}
            onClick={() => setMode('video')}
          >
            📹 我的视频
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
        ) : mode === 'video' ? (
          <>
            <p className="analyze-hint">
              上传你自己拍好的视频（mp4 / mov，50MB 以内）。AI 会转文字 + 分析 + 告诉你<strong>封面该放什么字</strong>、用第几秒的画面。
            </p>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              onChange={(e) => {
                setVideoFile(e.target.files?.[0] || null)
                setError('')
              }}
              style={{ marginBottom: '1rem' }}
            />
            {videoFile && (
              <p className="analyze-hint" style={{ marginBottom: '1rem' }}>
                已选：{videoFile.name}（{(videoFile.size / 1024 / 1024).toFixed(1)}MB）
              </p>
            )}
            <div className="analyze-row">
              <input
                type="text"
                placeholder="标记一下是哪条 (可选)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </>
        ) : mode === 'image' ? (
          <>
            <p className="analyze-hint">看到广告/帖子但找不到链接？截图上传，AI 直接看图分析（选上面的「广告拆解」用广告标准评）</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setImageFile(f || null)
                setImagePreview(f ? URL.createObjectURL(f) : '')
              }}
              style={{ marginBottom: '1rem' }}
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="preview"
                style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, marginBottom: '1rem', display: 'block' }}
              />
            )}
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
              : mode === 'video'
                ? '📤 上传 → 转文字 → 想封面中... (约1-2分钟)'
                : mode === 'image'
                  ? '👀 AI 看图分析中... (约20-40秒)'
                  : '🧠 AI 分析中... (约10-30秒)'
            : '✨ 开始分析'}
        </button>
      </div>
    </div>
  )
}
