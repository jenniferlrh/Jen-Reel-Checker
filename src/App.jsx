import { useState, useEffect, useRef } from 'react'
import './App.css'
import HeroSection from './components/HeroSection'
import ReelsList from './components/ReelsList'
import ReelDetail from './components/ReelDetail'
import SavedReels from './components/SavedReels'
import AnalyzeForm from './components/AnalyzeForm'
import SyncModal from './components/SyncModal'
import AdsResearch from './components/AdsResearch'
import ScriptGenerator from './components/ScriptGenerator'
import AccessGate from './components/AccessGate'
import { apiFetch } from './lib/api'

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
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showAdsResearch, setShowAdsResearch] = useState(false)
  const [showScriptGen, setShowScriptGen] = useState(false)
  const [unlocked, setUnlocked] = useState(() => !!localStorage.getItem('accessToken'))
  const [syncCode, setSyncCode] = useState(() => localStorage.getItem('syncCode') || '')
  const syncTimer = useRef(null)
  const syncReady = useRef(false)

  useEffect(() => {
    localStorage.setItem('savedReels', JSON.stringify(savedReelIds))
  }, [savedReelIds])

  useEffect(() => {
    localStorage.setItem('reels', JSON.stringify(reels))
  }, [reels])

  // ---- Cloud sync ----
  const pullCloud = async (code, localReels, localSaved) => {
    const res = await apiFetch(`/api/library?code=${encodeURIComponent(code)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `同步失败 (${res.status})`)
    if (data.data && Array.isArray(data.data.reels) && data.data.reels.length > 0) {
      // Cloud has data: merge cloud + local (dedupe by transcript+creator)
      const cloud = data.data.reels
      const seen = new Set(cloud.map(r => `${r.creator}|${(r.transcript || '').slice(0, 80)}`))
      const merged = [
        ...cloud,
        ...localReels.filter(r => !seen.has(`${r.creator}|${(r.transcript || '').slice(0, 80)}`)),
      ].map((r, i) => ({ ...r, id: i + 1 }))
      setReels(merged)
      setSavedReelIds(data.data.savedReelIds || localSaved)
      return merged
    }
    // Cloud empty: push local up
    await apiFetch('/api/library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, reels: localReels, savedReelIds: localSaved }),
    })
    return localReels
  }

  useEffect(() => {
    if (!unlocked || !syncCode) return
    pullCloud(syncCode, reels, savedReelIds)
      .then(() => { syncReady.current = true })
      .catch(() => { syncReady.current = true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked])

  useEffect(() => {
    if (!unlocked || !syncCode || !syncReady.current) return
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      apiFetch('/api/library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: syncCode, reels, savedReelIds }),
      }).catch(() => {})
    }, 1200)
    return () => clearTimeout(syncTimer.current)
  }, [reels, savedReelIds, syncCode])

  const handleConnectSync = async (code) => {
    await pullCloud(code, reels, savedReelIds)
    localStorage.setItem('syncCode', code)
    setSyncCode(code)
    syncReady.current = true
    setShowSyncModal(false)
  }

  const handleDisconnectSync = () => {
    localStorage.removeItem('syncCode')
    setSyncCode('')
    syncReady.current = false
    setShowSyncModal(false)
  }

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

  const handleAnalyzed = ({ creator, title, transcript, analysis, likes, sourceUrl, platform }) => {
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
      improvedHooks: analysis.improvedHooks,
      sourceUrl: sourceUrl || null,
      platform: platform || null,
      editingScore: analysis.editingScore ?? null,
      editingInsights: analysis.editingInsights || null
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

  if (!unlocked) {
    return <AccessGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="app">
      {currentPage === 'home' && (
        <>
          <HeroSection
            onAnalyzeReel={handleAnalyzeReel}
            reelCount={reels.length}
            onViewSaved={() => setCurrentPage('saved')}
            onOpenSync={() => setShowSyncModal(true)}
            onOpenAds={() => setShowAdsResearch(true)}
            onOpenScriptGen={() => setShowScriptGen(true)}
            syncOn={!!syncCode}
          />
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
      {showAdsResearch && (
        <AdsResearch onClose={() => setShowAdsResearch(false)} />
      )}
      {showScriptGen && (
        <ScriptGenerator onClose={() => setShowScriptGen(false)} />
      )}
      {showSyncModal && (
        <SyncModal
          currentCode={syncCode}
          onClose={() => setShowSyncModal(false)}
          onConnect={handleConnectSync}
          onDisconnect={handleDisconnectSync}
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
