import { useState } from 'react'
import './App.css'
import HeroSection from './components/HeroSection'
import ReelsList from './components/ReelsList'
import ReelDetail from './components/ReelDetail'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedReel, setSelectedReel] = useState(null)
  const [reels, setReels] = useState([
    {
      id: 1,
      creator: '@reythean_ruizhi',
      title: '少数人敢走的路',
      likes: 3,
      transcript: '少数人敢走的路。Most people follow the same path, but some brave souls dare to walk a different road. It\'s not easy, it\'s not comfortable, but it\'s real.',
      hookScore: 6.5,
      category: '个人成长'
    },
    {
      id: 2,
      creator: '@timtiah',
      title: 'Why most men don\'t change wallets',
      likes: 352,
      transcript: 'Ever wonder why men keep using the same wallet for years? It\'s not just about practicality. There\'s a psychological attachment. A wallet becomes part of your identity.',
      hookScore: 8.8,
      category: '心理学'
    },
    {
      id: 3,
      creator: '@reythean_ruizhi',
      title: '今天差一点，就回不了KL了',
      likes: 24,
      transcript: '今天差一点，就回不了KL了。Close call today. Almost didn\'t make it back to Kuala Lumpur. But here we are. Life is full of these narrow escapes.',
      hookScore: 7.2,
      category: '旅游故事'
    },
    {
      id: 4,
      creator: '@timtiah',
      title: 'Malaysia is considering a new law',
      likes: 361,
      transcript: 'Malaysia is considering a new law. One that could fundamentally change family dynamics. Adult children would become legally responsible for supporting elderly parents.',
      hookScore: 8.5,
      category: '社会'
    },
    {
      id: 5,
      creator: '@timtiah',
      title: 'Malaysia is opening a brand new LRT line',
      likes: 4400,
      transcript: 'Malaysia is opening a brand new LRT line this week. On the surface, it looks like just another railway expansion. But infrastructure tells a bigger story.',
      hookScore: 9.1,
      category: '新闻'
    },
    {
      id: 6,
      creator: '@immichellechong',
      title: 'Every property is a good property',
      likes: 4300,
      transcript: 'Every property is a good property. As long as you understand why you\'re buying it. The real estate market isn\'t about finding the perfect house.',
      hookScore: 8.7,
      category: '房产'
    },
    {
      id: 7,
      creator: '@timtiah',
      title: 'Most Malaysians think car insurance companies',
      likes: 3100,
      transcript: 'Most Malaysians think car insurance companies are making money from us. But here\'s the part no one talks about. The actual economics of insurance are complex.',
      hookScore: 8.3,
      category: '金融'
    },
    {
      id: 8,
      creator: '@timtiah',
      title: 'Your running club might be hurting alcohol companies',
      likes: 4100,
      transcript: 'Your running club might be hurting alcohol companies. Across Asia-Pacific, 30% of consumers say they\'re drinking less. Health consciousness is rising.',
      hookScore: 8.6,
      category: '健康'
    },
    {
      id: 9,
      creator: '@reythean_ruizhi',
      title: 'Video by reythean_ruizhi',
      likes: 19,
      transcript: 'No verbal content. A visual story told through stunning cinematography. The power of showing, not telling.',
      hookScore: 7.8,
      category: '视觉艺术'
    }
  ])

  const handleAnalyzeReel = (url) => {
    alert('Reel queued for analysis! It will appear in your list shortly.')
  }

  const handleViewDetail = (reel) => {
    setSelectedReel(reel)
    setCurrentPage('detail')
  }

  const handleBackToList = () => {
    setCurrentPage('home')
    setSelectedReel(null)
  }

  return (
    <div className="app">
      {currentPage === 'home' && (
        <>
          <HeroSection onAnalyzeReel={handleAnalyzeReel} reelCount={reels.length} />
          <ReelsList reels={reels} onSelectReel={handleViewDetail} />
        </>
      )}
      {currentPage === 'detail' && selectedReel && (
        <ReelDetail reel={selectedReel} onBack={handleBackToList} />
      )}
    </div>
  )
}

export default App
