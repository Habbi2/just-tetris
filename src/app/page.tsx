'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Dynamically import components to avoid SSR issues with Phaser
const TetrisGame = dynamic(() => import('@/components/TetrisGame'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Loading Tetris...</div>
})

const MultiplayerTetris = dynamic(() => import('@/components/MultiplayerTetris'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Loading Multiplayer...</div>
})

const Matchmaking = dynamic(() => import('@/components/Matchmaking'), {
  ssr: false
})

const GameLobby = dynamic(() => import('@/components/GameLobby'), {
  ssr: false
})

const Leaderboard = dynamic(() => import('@/components/Leaderboard'), {
  ssr: false
})

type GameMode = 'menu' | 'singleplayer' | 'matchmaking' | 'lobby' | 'multiplayer'

export default function Home() {
  const [gameMode, setGameMode] = useState<GameMode>('menu')
  const [playerName, setPlayerName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [playerNumber, setPlayerNumber] = useState(1)
  const supabase = createClientComponentClient()

  const startSinglePlayer = () => {
    if (playerName.trim()) {
      setGameMode('singleplayer')
    }
  }

  const startMatchmaking = () => {
    if (playerName.trim()) {
      setGameMode('matchmaking')
    }
  }

  const joinRoom = (roomId: string, roomCode: string, playerNumber: number) => {
    setRoomId(roomId)
    setRoomCode(roomCode)
    setPlayerNumber(playerNumber)
    setGameMode('lobby')
  }

  const startMultiplayerGame = (resolvedPlayerNumber: number) => {
    // Ensure we carry the resolved player number from the lobby into the game
    setPlayerNumber(resolvedPlayerNumber)
    setGameMode('multiplayer')
  }

  const returnToMenu = () => {
    setGameMode('menu')
    setRoomId('')
    setRoomCode('')
    setPlayerNumber(1)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-white mb-8">
          🧱 Tetris Online 🧱
        </h1>
        
        {gameMode === 'menu' && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Menu Section */}
            <div className="lg:w-1/2 flex flex-col items-center justify-center">
              <div className="bg-black/30 backdrop-blur-sm rounded-xl p-8 max-w-md w-full">
                <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                  Ready to Play?
                </h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-gray-300 border border-white/20 focus:border-white/50 focus:outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && startSinglePlayer()}
                  />
                  <button
                    onClick={startSinglePlayer}
                    disabled={!playerName.trim()}
                    className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Single Player
                  </button>
                  <button
                    onClick={startMatchmaking}
                    disabled={!playerName.trim()}
                    className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Multiplayer
                  </button>
                </div>
              </div>
            </div>

            {/* Leaderboard Section */}
            <div className="lg:w-1/2">
              <Leaderboard />
            </div>
          </div>
        )}

        {gameMode === 'singleplayer' && (
          <TetrisGame 
            playerName={playerName} 
            onGameEnd={returnToMenu}
          />
        )}

        {gameMode === 'matchmaking' && (
          <Matchmaking
            playerName={playerName}
            onJoinRoom={joinRoom}
            onBack={returnToMenu}
          />
        )}

        {gameMode === 'lobby' && (
          <GameLobby
            roomId={roomId}
            roomCode={roomCode}
            playerNumber={playerNumber}
            playerName={playerName}
            onStartGame={startMultiplayerGame}
            onLeaveRoom={returnToMenu}
          />
        )}

        {gameMode === 'multiplayer' && (
          <MultiplayerTetris
            roomId={roomId}
            roomCode={roomCode}
            playerNumber={playerNumber}
            playerName={playerName}
            onGameEnd={returnToMenu}
          />
        )}
      </div>
    </main>
  )
}
