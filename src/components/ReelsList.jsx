import './ReelsList.css'

export default function ReelsList({
  reels,
  onSelectReel,
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  savedReelIds,
  onToggleSave,
  totalReels
}) {
  return (
    <section className="reels-list-section">
      <div className="reels-container">
        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 Search by title or creator..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="controls">
          <div className="filter-group">
            <label>Category</label>
            <select value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)}>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sort-group">
            <label>Sort by</label>
            <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
              <option value="latest">Latest</option>
              <option value="popular">Most Popular</option>
              <option value="hookScore">Highest Score</option>
            </select>
          </div>
        </div>

        <div className="section-header">
          <h2>🔥 Analyzed Reels</h2>
          <p>{reels.length} of {totalReels} reels</p>
        </div>

        {reels.length === 0 ? (
          <div className="no-results">
            <p>No reels found. Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="reels-grid">
            {reels.map((reel) => (
              <div
                key={reel.id}
                className="reel-card"
                onClick={() => onSelectReel(reel)}
              >
                <div className="reel-badge">Analyzed</div>
                {savedReelIds.includes(reel.id) && <div className="reel-saved">💾</div>}
                <div className="reel-user">{reel.creator}</div>
                <div className="reel-title">{reel.title}</div>
                <div className="reel-footer">
                  <span className="reel-likes">♥ {reel.likes.toLocaleString()}</span>
                  <button
                    className="save-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleSave(reel.id)
                    }}
                  >
                    {savedReelIds.includes(reel.id) ? '❤️' : '🤍'}
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
