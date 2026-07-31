import './ReelDetail.css'

export default function ReelDetail({ reel, onBack, isSaved, onToggleSave }) {
  const handleSave = () => {
    alert('✅ Analysis saved as markdown!')
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
            <button className="btn btn-primary" onClick={handleSave}>Save as .md</button>
          </div>
        </div>
      </div>
    </div>
  )
}
