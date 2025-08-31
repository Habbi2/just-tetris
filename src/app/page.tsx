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
    <main className="min-h-screen relative overflow-hidden">
      {/* Simplified floating particles background - reduced for performance */}
      <div className="particles">
        <div className="particle" style={{left: '20%', animationDelay: '0s'}}></div>
        <div className="particle" style={{left: '50%', animationDelay: '-2s'}}></div>
        <div className="particle" style={{left: '80%', animationDelay: '-4s'}}></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        <h1 className="text-6xl font-bold text-center mb-8 glitch" data-text="🧱 TETRIS ONLINE 🧱">
          🧱 TETRIS ONLINE 🧱
        </h1>
        
        {gameMode === 'menu' && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Menu Section */}
            <div className="lg:w-1/2 flex flex-col items-center justify-center">
              <div className="retro-card rounded-xl p-8 max-w-md w-full">
                <h2 className="text-3xl font-bold text-center mb-8 neon-glow" style={{color: 'var(--neon-cyan)'}}>
                  READY TO PLAY?
                </h2>
                <div className="space-y-6">
                  <input
                    type="text"
                    placeholder="ENTER YOUR NAME"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-6 py-4 rounded-lg bg-black/50 border-2 border-cyan-400/50 text-white placeholder-cyan-300 focus:border-cyan-400 focus:outline-none text-center font-bold uppercase tracking-wider backdrop-blur-sm"
                    onKeyPress={(e) => e.key === 'Enter' && startSinglePlayer()}
                  />
                  <button
                    onClick={startSinglePlayer}
                    disabled={!playerName.trim()}
                    className="w-full py-4 px-6 pixel-btn border-cyan-400 text-cyan-400 hover:text-white hover:border-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  >
                    SINGLE PLAYER
                  </button>
                  <button
                    onClick={startMatchmaking}
                    disabled={!playerName.trim()}
                    className="w-full py-4 px-6 pixel-btn border-pink-400 text-pink-400 hover:text-white hover:border-pink-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  >
                    MULTIPLAYER
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
