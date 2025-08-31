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
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6">
        <h2 className="text-2xl font-semibold text-white mb-4 text-center">
          🏆 Leaderboard 🏆
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6">
      <h2 className="text-2xl font-semibold text-white mb-6 text-center">
        🏆 Leaderboard 🏆
      </h2>
      
      {scores.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-300 text-lg mb-2">No scores yet!</p>
          <p className="text-gray-400">Be the first to play!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scores.map((score, index) => (
            <div
              key={score.id}
              className={`p-4 rounded-lg backdrop-blur-sm border transition-all duration-200 hover:scale-105 ${
                index < 3
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xl font-bold text-white w-8">
                    {getRankEmoji(index)}
                  </span>
                  <div>
                    <p className="font-semibold text-white truncate max-w-32">
                      {score.player_name}
                    </p>
                    <p className="text-xs text-gray-300">
                      {formatDate(score.created_at)}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-400">
                    {score.score.toLocaleString()}
                  </p>
                  <div className="flex space-x-3 text-xs text-gray-300">
                    <span>Lv.{score.level}</span>
                    <span>{score.lines} lines</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-center text-sm text-gray-400">
          Scores update in real-time!
        </p>
      </div>
    </div>
  )
}
