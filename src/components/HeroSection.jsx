import { useState } from 'react'
import './HeroSection.css'

export default function HeroSection({ onAnalyzeReel, reelCount, onViewSaved, onOpenSync, syncOn }) {
  const [inputValue, setInputValue] = useState('')

  const handleAnalyze = () => {
    onAnalyzeReel(inputValue)
    setInputValue('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAnalyze()
    }
  }

  return (
    <div className="hero-section">
      <div className="hero-bg">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
        <div className="shape shape-5"></div>
      </div>

      <div className="nav">
        <div className="nav-logo">🎬 Jen Reel Checker</div>
        <div className="nav-links">
          <a href="#analyze" onClick={(e) => { e.preventDefault(); onAnalyzeReel('') }}>Analyze</a>
          <button onClick={onViewSaved} className="nav-saved-btn">💾 Saved</button>
          <button onClick={onOpenSync} className="nav-saved-btn">{syncOn ? '☁️ 已同步' : '☁️ 同步'}</button>
        </div>
      </div>

      <div className="hero-content">
        <div className="content-card">
          <div className="content-label">🎥 Reel Studio</div>
          <div className="content-title">Let's Analyze<br />Trending Content</div>
          <div className="content-desc">
            一条链接，自动抓取 + 转文字 + AI 深度分析。支持 Instagram、TikTok、小红书、Facebook。
          </div>

          <div className="input-section">
            <label className="input-label">ANALYZE A VIDEO</label>
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="贴上 IG / TikTok / 小红书 / FB 视频链接"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button onClick={handleAnalyze}>✨ Analyze</button>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat">
              <div className="stat-value">{reelCount}</div>
              <div className="stat-label">Analyzed</div>
            </div>
            <div className="stat">
              <div className="stat-value">98%</div>
              <div className="stat-label">Accuracy</div>
            </div>
            <div className="stat">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Live</div>
            </div>
          </div>
        </div>

        <div className="visual-showcase">
          <div className="showcase-item" style={{ bottom: '100px', left: '0', transform: 'rotate(-5deg)' }}>
            <div className="showcase-user">🔗 贴上链接</div>
            <div className="showcase-title">自动抓取 reel 内容</div>
            <div className="showcase-likes">Step 1</div>
          </div>
          <div className="showcase-item" style={{ bottom: '50px', right: '0', transform: 'rotate(3deg)' }}>
            <div className="showcase-user">🎙️ 语音转文字</div>
            <div className="showcase-title">AI 自动转录文字稿</div>
            <div className="showcase-likes">Step 2</div>
          </div>
          <div className="showcase-item" style={{ bottom: '0', left: '100px', transform: 'rotate(5deg)' }}>
            <div className="showcase-user">🧠 AI 深度分析</div>
            <div className="showcase-title">Hook 评分 + 改进建议</div>
            <div className="showcase-likes">Step 3</div>
          </div>
        </div>
      </div>
    </div>
  )
}
