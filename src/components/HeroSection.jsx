import { useState } from 'react'
import './HeroSection.css'

export default function HeroSection({ onAnalyzeReel, reelCount, onViewSaved }) {
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
          <a href="#features">Features</a>
          <a href="#analyze">Analyze</a>
          <button onClick={onViewSaved} className="nav-saved-btn">💾 Saved</button>
        </div>
        <div className="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <div className="hero-content">
        <div className="content-card">
          <div className="content-label">🎥 Reel Studio</div>
          <div className="content-title">Let's Analyze<br />Trending Content</div>
          <div className="content-desc">
            Discover what makes Instagram reels go viral. AI-powered analysis with real-time insights and actionable data for creators.
          </div>
          <button className="cta-button">Get Started</button>

          <div className="input-section">
            <label className="input-label">ANALYZE A REEL</label>
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="instagram.com/reel/... or @handle"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button onClick={handleAnalyze}>Analyze</button>
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
            <div className="showcase-user">@reythean_ruizhi</div>
            <div className="showcase-title">少数人敢走的路</div>
            <div className="showcase-likes">♥ 3</div>
          </div>
          <div className="showcase-item" style={{ bottom: '50px', right: '0', transform: 'rotate(3deg)' }}>
            <div className="showcase-user">@timtiah</div>
            <div className="showcase-title">Why men don't change wallets</div>
            <div className="showcase-likes">♥ 352</div>
          </div>
          <div className="showcase-item" style={{ bottom: '0', left: '100px', transform: 'rotate(5deg)' }}>
            <div className="showcase-user">@immichellechong</div>
            <div className="showcase-title">Every property is good</div>
            <div className="showcase-likes">♥ 4.3K</div>
          </div>
        </div>
      </div>
    </div>
  )
}
