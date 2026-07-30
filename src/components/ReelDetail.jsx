import './ReelDetail.css'

export default function ReelDetail({ reel, onBack }) {
  const handleSave = () => {
    alert('Analysis saved as markdown!')
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

          <div className="detail-video">▶ Video preview</div>

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
            <div className="insight-item">
              <span className="insight-icon">✨</span>
              <span>Strong hook within first 3 seconds</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">📊</span>
              <span>High engagement rate for content type</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">🎯</span>
              <span>Clear call-to-action or narrative flow</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">👥</span>
              <span>Resonates with target audience demographics</span>
            </div>
          </div>

          <div className="detail-buttons">
            <button className="btn btn-secondary" onClick={onBack}>Close</button>
            <button className="btn btn-primary" onClick={handleSave}>Save as .md</button>
          </div>
        </div>
      </div>
    </div>
  )
}
