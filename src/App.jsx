import { useState, useEffect } from 'react'
import './App.css'
import HeroSection from './components/HeroSection'
import ReelsList from './components/ReelsList'
import ReelDetail from './components/ReelDetail'
import SavedReels from './components/SavedReels'
import AnalyzeForm from './components/AnalyzeForm'

const INITIAL_REELS = [
  { id: 1, creator: '@reythean_ruizhi', title: '少数人敢走的路', likes: 3, transcript: '少数人敢走的路。Most people follow the same path, but some brave souls dare to walk a different road.', hookScore: 6.5, category: '个人成长' },
  { id: 2, creator: '@timtiah', title: 'Why most men don\'t change wallets', likes: 352, transcript: 'Ever wonder why men keep using the same wallet for years? There\'s a psychological attachment.', hookScore: 8.8, category: '心理学' },
  { id: 3, creator: '@reythean_ruizhi', title: '今天差一点，就回不了KL了', likes: 24, transcript: '今天差一点，就回不了KL了。Close call today. Almost didn\'t make it back to Kuala Lumpur.', hookScore: 7.2, category: '旅游故事' },
  { id: 4, creator: '@timtiah', title: 'Malaysia is considering a new law', likes: 361, transcript: 'Malaysia is considering a new law. One that could fundamentally change family dynamics.', hookScore: 8.5, category: '社会' },
  { id: 5, creator: '@timtiah', title: 'Malaysia is opening a brand new LRT line', likes: 4400, transcript: 'Malaysia is opening a brand new LRT line this week. But infrastructure tells a bigger story.', hookScore: 9.1, category: '新闻' },
  { id: 6, creator: '@immichellechong', title: 'Every property is a good property', likes: 4300, transcript: 'Every property is a good property. As long as you understand why you\'re buying it.', hookScore: 8.7, category: '房产' },
  { id: 7, creator: '@timtiah', title: 'Most Malaysians think car insurance companies', likes: 3100, transcript: 'Most Malaysians think car insurance companies are making money from us. But here\'s the part no one talks about.', hookScore: 8.3, category: '金融' },
  { id: 8, creator: '@timtiah', title: 'Your running club might be hurting alcohol companies', likes: 4100, transcript: 'Your running club might be hurting alcohol companies. Health consciousness is rising.', hookScore: 8.6, category: '健康' },
  { id: 9, creator: '@reythean_ruizhi', title: 'Video by reythean_ruizhi', likes: 19, transcript: 'No verbal content. A visual story told through stunning cinematography.', hookScore: 7.8, category: '视觉艺术' }
]

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedReel, setSelectedReel] = useState(null)
  const [reels, setReels] = useState(INITIAL_REELS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [savedReelIds, setSavedReelIds] = useState(() => {
    const saved = localStorage.getItem('savedReels')
    return saved ? JSON.parse(saved) : []
  })
  const [sortBy, setSortBy] = useState('latest')
  const [showAnalyzeForm, setShowAnalyzeForm] = useState(false)

  useEffect(() => {
    localStorage.setItem('savedReels', JSON.stringify(savedReelIds))
  }, [savedReelIds])

  const categories = ['all', ...new Set(INITIAL_REELS.map(r => r.category))]

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

  const handleAnalyzeReel = () => {
    setShowAnalyzeForm(true)
  }

  const handleAnalyzed = ({ creator, title, transcript, analysis, likes }) => {
    const newReel = {
      id: Math.max(...reels.map(r => r.id)) + 1,
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
