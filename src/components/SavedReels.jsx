import './SavedReels.css'

export default function SavedReels({ reels, onSelectReel, onBack, onToggleSave }) {
  return (
    <section className="saved-section">
      <div className="saved-container">
        <button className="back-button" onClick={onBack}>← Back</button>
        <div className="saved-header">
          <h2>💾 Saved Reels</h2>
          <p>{reels.length} saved</p>
        </div>

        {reels.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📌</div>
            <h3>No saved reels yet</h3>
            <p>Click the heart icon to save your favorite reels</p>
          </div>
        ) : (
          <div className="saved-grid">
            {reels.map((reel) => (
              <div
                key={reel.id}
                className="saved-card"
                onClick={() => onSelectReel(reel)}
              >
                <div className="saved-user">{reel.creator}</div>
                <div className="saved-title">{reel.title}</div>
                <div className="saved-footer">
                  <span className="saved-likes">♥ {reel.likes.toLocaleString()}</span>
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleSave(reel.id)
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
