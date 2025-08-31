'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Score {
  id: number
  player_name: string
  score: number
  level: number
  lines: number
  created_at: string
}

export default function Leaderboard() {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchScores()
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('scores')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'scores' },
        () => fetchScores()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .order('score', { ascending: false })
        .limit(10)

      if (error) throw error
      setScores(data || [])
    } catch (error) {
      console.error('Error fetching scores:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRankEmoji = (index: number) => {
    switch (index) {
      case 0: return '🥇'
      case 1: return '🥈'
      case 2: return '🥉'
      default: return `${index + 1}.`
    }
  }

  if (loading) {
    return (
      <div className="retro-card rounded-xl p-6">
        <h2 className="text-3xl font-bold text-center mb-6" style={{color: 'var(--neon-yellow)'}}>
          🏆 LEADERBOARD 🏆
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="retro-card rounded-xl p-6">
      <h2 className="text-3xl font-bold text-center mb-6" style={{color: 'var(--neon-yellow)'}}>
        🏆 LEADERBOARD 🏆
      </h2>
      
      {scores.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-cyan-300 text-lg mb-2 font-bold">NO SCORES YET!</p>
          <p className="text-gray-400">BE THE FIRST TO PLAY!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scores.map((score, index) => (
            <div
              key={score.id}
              className={`leaderboard-entry p-4 rounded-lg ${
                index < 3
                  ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-l-4 border-l-yellow-400'
                  : 'bg-black/40 border-l-4 border-l-cyan-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-2xl font-bold w-12 text-center" style={{
                    color: index < 3 ? 'var(--neon-yellow)' : 'var(--neon-cyan)',
                    textShadow: `0 0 10px ${index < 3 ? 'var(--neon-yellow)' : 'var(--neon-cyan)'}`
                  }}>
                    {getRankEmoji(index)}
                  </span>
                  <div>
                    <p className="font-bold text-white text-lg truncate max-w-32 uppercase tracking-wide">
                      {score.player_name}
                    </p>
                    <p className="text-sm text-gray-300 font-mono">
                      {formatDate(score.created_at)}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-2xl font-bold stat-value">
                    {score.score.toLocaleString()}
                  </p>
                  <div className="flex space-x-4 text-sm text-cyan-300 font-mono">
                    <span>LV.{score.level}</span>
                    <span>{score.lines} LINES</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-cyan-400/30">
        <p className="text-center text-sm text-cyan-300 font-bold uppercase tracking-widest">
          SCORES UPDATE IN REAL-TIME!
        </p>
      </div>
    </div>
  )
}
