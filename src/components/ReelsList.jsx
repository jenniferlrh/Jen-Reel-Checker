import './ReelsList.css'

export default function ReelsList({ reels, onSelectReel }) {
  return (
    <section className="reels-list-section">
      <div className="reels-container">
        <div className="section-header">
          <h2>🔥 Recently Analyzed Reels</h2>
          <p>{reels.length} analyzed</p>
        </div>

        <div className="reels-grid">
          {reels.map((reel) => (
            <div
              key={reel.id}
              className="reel-card"
              onClick={() => onSelectReel(reel)}
            >
              <div className="reel-badge">Analyzed</div>
              <div className="reel-user">{reel.creator}</div>
              <div className="reel-title">{reel.title}</div>
              <div className="reel-footer">
                <span className="reel-likes">♥ {reel.likes.toLocaleString()}</span>
                <span className="reel-arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
