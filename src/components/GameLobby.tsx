'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface GameLobbyProps {
  roomId: string
  roomCode: string
  playerNumber: number
  playerName: string
  onStartGame: (playerNumber: number) => void
  onLeaveRoom: () => void
}

interface Player {
  id: string
  player_name: string
  player_number: number
  is_ready: boolean
  is_connected: boolean
}

export default function GameLobby({ 
  roomId, 
  roomCode, 
  playerNumber, 
  playerName, 
  onStartGame, 
  onLeaveRoom 
}: GameLobbyProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [isReady, setIsReady] = useState(false)
  const [canStart, setCanStart] = useState(false)
  const [myPlayerNumber, setMyPlayerNumber] = useState<number>(playerNumber)
  const [hasStarted, setHasStarted] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Resolve my assigned player number from DB to prevent mismatches
    resolveMyPlayerNumber()
    fetchPlayers()
    
    // Subscribe to player changes
    const playersChannel = supabase
      .channel(`room-${roomId}-players`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_players',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchPlayers()
        resolveMyPlayerNumber()
      })
      .subscribe()

    // Subscribe to room status changes
    const roomChannel = supabase
      .channel(`room-${roomId}-status`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        if (payload.new.status === 'in_progress' && !hasStarted) {
          setHasStarted(true)
          onStartGame(myPlayerNumber)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(roomChannel)
    }
  }, [roomId, hasStarted])

  // Polling fallback to ensure UI stays in sync even if realtime isn't active
  useEffect(() => {
    const id = setInterval(() => {
      fetchPlayers()
      resolveMyPlayerNumber()
      // Poll room status as a fallback
      if (!hasStarted) {
        checkRoomStatus()
      }
    }, 2000)
    return () => clearInterval(id)
  }, [roomId, hasStarted])

  useEffect(() => {
    // Check if all players are ready and game can start
    const allReady = players.length === 2 && players.every(p => p.is_ready)
    setCanStart(allReady)
    
    // Auto-start game when both players are ready
    if (allReady && myPlayerNumber === 1) {
      setTimeout(startGame, 1000) // Small delay for better UX
    }
  }, [players, myPlayerNumber])

  // Guest fallback: if all ready and room didn't flip yet, start after short delay
  useEffect(() => {
    if (canStart && !hasStarted && myPlayerNumber === 2) {
      const t = setTimeout(async () => {
        await checkRoomStatus()
        if (!hasStarted) {
          setHasStarted(true)
          onStartGame(myPlayerNumber)
        }
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [canStart, hasStarted, myPlayerNumber])

  const fetchPlayers = async () => {
    try {
      const { data: players, error } = await supabase
        .from('game_players')
        .select('*')
        .eq('room_id', roomId)
        .order('player_number')

      if (error) throw error
      setPlayers(players || [])
      // Update my ready state from DB
      const me = (players || []).find(p => p.player_name === playerName)
      if (me) setIsReady(!!me.is_ready)
    } catch (error) {
      console.error('Error fetching players:', error)
    }
  }

  const resolveMyPlayerNumber = async () => {
    try {
      const { data: me } = await supabase
        .from('game_players')
        .select('player_number, is_ready')
        .eq('room_id', roomId)
        .eq('player_name', playerName)
        .limit(1)
        .maybeSingle()

      if (me?.player_number && me.player_number !== myPlayerNumber) {
        setMyPlayerNumber(me.player_number)
      }
      if (typeof me?.is_ready === 'boolean') {
        setIsReady(me.is_ready)
      }
    } catch (e) {
      // ignore
    }
  }

  const toggleReady = async () => {
    try {
      const newReadyState = !isReady
      
      const { error } = await supabase
        .from('game_players')
        .update({ is_ready: newReadyState })
        .eq('room_id', roomId)
        .eq('player_number', myPlayerNumber)

      if (error) throw error
      // Reflect immediately while realtime catches up
      setIsReady(newReadyState)
      // Also update local list
      setPlayers(prev => prev.map(p => (
        p.player_number === myPlayerNumber ? { ...p, is_ready: newReadyState } : p
      )))
    } catch (error) {
      console.error('Error updating ready state:', error)
    }
  }

  const startGame = async () => {
    if (myPlayerNumber !== 1) return // Only player 1 can start
    
    try {
      const { error } = await supabase
        .from('game_rooms')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', roomId)

      if (error) throw error
      // Host proceeds immediately; guest will follow via realtime/polling
      if (!hasStarted) {
        setHasStarted(true)
        onStartGame(myPlayerNumber)
      }
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  const checkRoomStatus = async () => {
    try {
      const { data } = await supabase
        .from('game_rooms')
        .select('status')
        .eq('id', roomId)
        .maybeSingle()
      if (data?.status === 'in_progress' && !hasStarted) {
        setHasStarted(true)
  onStartGame(myPlayerNumber)
      }
    } catch (_) {
      // ignore
    }
  }

  const leaveRoom = async () => {
    try {
      // Remove player from room
      await supabase
        .from('game_players')
        .delete()
        .eq('room_id', roomId)
        .eq('player_number', playerNumber)

      // Update room player count
      const remainingPlayers = players.filter(p => p.player_number !== playerNumber)
      
      if (remainingPlayers.length === 0) {
        // Delete room if no players left
        await supabase
          .from('game_rooms')
          .delete()
          .eq('id', roomId)
      } else {
        // Update player count
        await supabase
          .from('game_rooms')
          .update({ current_players: remainingPlayers.length })
          .eq('id', roomId)
      }

      onLeaveRoom()
    } catch (error) {
      console.error('Error leaving room:', error)
      onLeaveRoom() // Leave anyway
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="retro-card">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-wider uppercase">Game Lobby</h2>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400/80 font-mono tracking-wide">Room Code:</span>
              <span className="text-2xl font-mono text-yellow-400 tracking-widest">{roomCode}</span>
              <button
                onClick={copyRoomCode}
                className="pixel-btn pixel-btn-primary text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Players List */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-4 tracking-wide uppercase">Players ({players.length}/2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((num) => {
                const player = players.find(p => p.player_number === num)
                const isCurrentPlayer = player?.player_number === myPlayerNumber
                
                return (
                  <div
                    key={num}
                    className={`p-4 rounded-lg border-2 backdrop-blur-sm transition-all duration-200 ${
                      player 
                        ? isCurrentPlayer
                          ? 'bg-blue-500/20 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                          : 'bg-green-500/20 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                        : 'bg-gray-600/20 border-gray-500/50 border-dashed'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white mb-2 font-mono tracking-wider">
                        Player {num}
                        {isCurrentPlayer && ' (You)'}
                      </div>
                      
                      {player ? (
                        <>
                          <div className="text-cyan-400/90 mb-2 font-mono tracking-wide">{player.player_name}</div>
                          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium font-mono tracking-wide ${
                            player.is_ready 
                              ? 'bg-green-500/80 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' 
                              : 'bg-yellow-500/80 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                          }`}>
                            {player.is_ready ? 'Ready' : 'Not Ready'}
                          </div>
                        </>
                      ) : (
                        <div className="text-cyan-400/50 font-mono tracking-wide">Waiting for player...</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ready Button */}
          {players.find(p => p.player_number === myPlayerNumber) && (
            <div className="text-center">
              <button
                onClick={toggleReady}
                className={`pixel-btn py-4 px-8 font-semibold ${
                  isReady
                    ? 'pixel-btn-warning'
                    : 'pixel-btn-success'
                }`}
              >
                {isReady ? 'Cancel Ready' : 'Ready Up'}
              </button>
            </div>
          )}

          {/* Game Status */}
          {canStart && (
            <div className="text-center p-4 bg-green-500/20 border border-green-400/50 rounded-lg backdrop-blur-sm shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <div className="text-green-200 font-semibold font-mono tracking-wider uppercase">
                All players ready! Starting game...
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-center text-cyan-400/70 text-sm font-mono tracking-wide">
            Share the room code with your friend to let them join!
          </div>

          {/* Leave Button */}
          <div className="text-center">
            <button
              onClick={leaveRoom}
              className="pixel-btn pixel-btn-danger"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
