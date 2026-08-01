import { useState, useEffect } from 'react'
import './App.css'
import HeroSection from './components/HeroSection'
import ReelsList from './components/ReelsList'
import ReelDetail from './components/ReelDetail'
import SavedReels from './components/SavedReels'
import AnalyzeForm from './components/AnalyzeForm'

const INITIAL_REELS = []

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedReel, setSelectedReel] = useState(null)
  const [reels, setReels] = useState(() => {
    const saved = localStorage.getItem('reels')
    return saved ? JSON.parse(saved) : INITIAL_REELS
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [savedReelIds, setSavedReelIds] = useState(() => {
    const saved = localStorage.getItem('savedReels')
    return saved ? JSON.parse(saved) : []
  })
  const [sortBy, setSortBy] = useState('latest')
  const [showAnalyzeForm, setShowAnalyzeForm] = useState(false)
  const [analyzeInitialUrl, setAnalyzeInitialUrl] = useState('')

  useEffect(() => {
    localStorage.setItem('savedReels', JSON.stringify(savedReelIds))
  }, [savedReelIds])

  useEffect(() => {
    localStorage.setItem('reels', JSON.stringify(reels))
  }, [reels])

  const categories = ['all', ...new Set(reels.map(r => r.category))]

  const filteredReels = reels.filter(reel => {
    const matchesSearch = reel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         reel.creator.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || reel.category === selectedCategory
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    if (sortBy === 'latest') return b.id - a.id
    if (sortBy === 'popular') return b.likes - a.likes
    if (sortBy === 'hookScore') return b.hookScore - a.hookScore
    return 0
  })

  const handleAnalyzeReel = (url) => {
    setAnalyzeInitialUrl(typeof url === 'string' ? url : '')
    setShowAnalyzeForm(true)
  }

  const handleAnalyzed = ({ creator, title, transcript, analysis, likes }) => {
    const newReel = {
      id: reels.length > 0 ? Math.max(...reels.map(r => r.id)) + 1 : 1,
      creator: creator || '@unknown',
      title: title || analysis.summary,
      likes: likes || 0,
      transcript,
      hookScore: analysis.hookScore,
      category: analysis.category,
      summary: analysis.summary,
      insights: analysis.insights,
      suggestions: analysis.suggestions,
      improvedHooks: analysis.improvedHooks
    }
    setReels([newReel, ...reels])
    setShowAnalyzeForm(false)
    setSelectedReel(newReel)
    setCurrentPage('detail')
  }

  const handleViewDetail = (reel) => {
    setSelectedReel(reel)
    setCurrentPage('detail')
  }

  const handleBackToList = () => {
    setCurrentPage('home')
    setSelectedReel(null)
  }

  const handleToggleSave = (reelId) => {
    setSavedReelIds(prev =>
      prev.includes(reelId) ? prev.filter(id => id !== reelId) : [...prev, reelId]
    )
  }

  const savedReels = reels.filter(r => savedReelIds.includes(r.id))
  const isSaved = selectedReel ? savedReelIds.includes(selectedReel.id) : false

  return (
    <div className="app">
      {currentPage === 'home' && (
        <>
          <HeroSection onAnalyzeReel={handleAnalyzeReel} reelCount={reels.length} onViewSaved={() => setCurrentPage('saved')} />
          <ReelsList
            reels={filteredReels}
            onSelectReel={handleViewDetail}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortBy={sortBy}
            onSortChange={setSortBy}
            savedReelIds={savedReelIds}
            onToggleSave={handleToggleSave}
            totalReels={reels.length}
          />
        </>
      )}
      {currentPage === 'detail' && selectedReel && (
        <ReelDetail
          reel={selectedReel}
          onBack={handleBackToList}
          isSaved={isSaved}
          onToggleSave={() => handleToggleSave(selectedReel.id)}
          savedCount={savedReels.length}
        />
      )}
      {showAnalyzeForm && (
        <AnalyzeForm
          initialUrl={analyzeInitialUrl}
          onClose={() => setShowAnalyzeForm(false)}
          onAnalyzed={handleAnalyzed}
        />
      )}
      {currentPage === 'saved' && (
        <SavedReels
          reels={savedReels}
          onSelectReel={handleViewDetail}
          onBack={() => setCurrentPage('home')}
          onToggleSave={handleToggleSave}
        />
      )}
    </div>
  )
}

export default App
