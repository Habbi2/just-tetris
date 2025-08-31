'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Room {
  id: string
  room_code: string
  status: string
  current_players: number
  max_players: number
  created_at: string
}

interface MatchmakingProps {
  playerName: string
  onJoinRoom: (roomId: string, roomCode: string, playerNumber: number) => void
  onBack: () => void
}

export default function Matchmaking({ playerName, onJoinRoom, onBack }: MatchmakingProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchAvailableRooms()
    testSupabaseConnection()
    
    // Subscribe to room changes
    const channel = supabase
      .channel('rooms')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_rooms'
      }, () => {
        fetchAvailableRooms()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const testSupabaseConnection = async () => {
    try {
      const { data, error } = await supabase.from('game_rooms').select('count').limit(1)
      if (error) {
        console.error('Supabase connection error:', error.message)
        setError('Database connection failed. Please make sure the multiplayer tables are set up.')
      }
    } catch (error) {
      console.error('Supabase connection error:', error)
      setError('Database connection failed. Please check your configuration.')
    }
  }

  const fetchAvailableRooms = async () => {
    try {
      const { data: rooms, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('status', 'waiting')
        .lt('current_players', 2)
        .order('created_at', { ascending: true })
        .limit(10)

      if (error) {
        console.error('Error fetching rooms:', error)
        if (error.message.includes('relation "game_rooms" does not exist')) {
          setError('Multiplayer tables not found. Please run the MULTIPLAYER_SETUP.sql script in your Supabase database.')
        }
        return
      }
      setRooms(rooms || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
      setError('Failed to fetch available rooms')
    }
  }

  const createRoom = async () => {
    setIsSearching(true)
    setError('')
    
    try {
      // Generate room code first
      const roomCode = await generateRoomCode()
      
      // Create new room with room code
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert([{
          room_code: roomCode,
          current_players: 1,
          status: 'waiting'
        }])
        .select()
        .single()

      if (roomError) throw roomError

      // Add player to room
      const { error: playerError } = await supabase
        .from('game_players')
        .insert([{
          room_id: room.id,
          player_name: playerName,
          player_number: 1,
          is_ready: false
        }])

      if (playerError) throw playerError

      onJoinRoom(room.id, room.room_code, 1)
    } catch (error: any) {
      setError('Failed to create room: ' + error.message)
      setIsSearching(false)
    }
  }

  const joinRoom = async (room: Room) => {
    setIsSearching(true)
    setError('')

    try {
      // Add player to room
      const { error: playerError } = await supabase
        .from('game_players')
        .insert([{
          room_id: room.id,
          player_name: playerName,
          player_number: 2,
          is_ready: false
        }])

      if (playerError) throw playerError

      // Update room player count
      const { error: updateError } = await supabase
        .from('game_rooms')
        .update({ current_players: 2 })
        .eq('id', room.id)

      if (updateError) throw updateError

      onJoinRoom(room.id, room.room_code, 2)
    } catch (error: any) {
      setError('Failed to join room: ' + error.message)
      setIsSearching(false)
    }
  }

  const joinByCode = async () => {
    if (!roomCode.trim()) return
    
    setIsSearching(true)
    setError('')

    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('status', 'waiting')
        .single()

      if (roomError || !room) {
        throw new Error('Room not found or already started')
      }

      if (room.current_players >= room.max_players) {
        throw new Error('Room is full')
      }

      await joinRoom(room)
    } catch (error: any) {
      setError('Failed to join room: ' + error.message)
      setIsSearching(false)
    }
  }

  const generateRoomCode = async (): Promise<string> => {
    // Try using the Supabase function first
    try {
      const { data, error } = await supabase.rpc('generate_room_code')
      if (!error && data) {
        return data
      }
    } catch (error) {
      console.warn('RPC function not available, using client-side generation')
    }
    
    // Fallback to client-side generation
    let code: string
    let exists = true
    let attempts = 0
    const maxAttempts = 10
    
    while (exists && attempts < maxAttempts) {
      // Generate a 6-character alphanumeric code
      code = Math.random().toString(36).substr(2, 6).toUpperCase()
      
      // Check if it already exists
      const { data: existingRooms, error } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', code)
        .limit(1)
        
      if (error) throw error
      exists = existingRooms && existingRooms.length > 0
      attempts++
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Could not generate unique room code')
    }
    
    return code!
  }

  const quickMatch = async () => {
    setIsSearching(true)
    setError('')

    try {
      // Try to join an existing room first
      if (rooms.length > 0) {
        await joinRoom(rooms[0])
      } else {
        // Create new room if none available
        await createRoom()
      }
    } catch (error: any) {
      setError('Failed to find match: ' + error.message)
      setIsSearching(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="retro-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white tracking-wider uppercase">
            Multiplayer Matchmaking
          </h2>
          <button
            onClick={onBack}
            className="pixel-btn pixel-btn-secondary"
          >
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide uppercase">Quick Match</h3>
              <button
                onClick={quickMatch}
                disabled={isSearching}
                className="w-full pixel-btn pixel-btn-success py-4"
              >
                {isSearching ? 'Searching...' : 'Find Match'}
              </button>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide uppercase">Create Private Room</h3>
              <button
                onClick={createRoom}
                disabled={isSearching}
                className="w-full pixel-btn pixel-btn-primary py-4"
              >
                {isSearching ? 'Creating...' : 'Create Room'}
              </button>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide uppercase">Join by Code</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 rounded-lg bg-black/50 backdrop-blur-sm text-white placeholder-white/50 border border-cyan-400/30 focus:border-cyan-400 focus:outline-none transition-all duration-200 font-mono tracking-wider"
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && joinByCode()}
                />
                <button
                  onClick={joinByCode}
                  disabled={isSearching || !roomCode.trim()}
                  className="pixel-btn pixel-btn-danger"
                >
                  Join
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-400/50 rounded-lg backdrop-blur-sm">
                <p className="text-red-200 font-mono">{error}</p>
              </div>
            )}
          </div>

          {/* Available Rooms */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-4 tracking-wide uppercase">Available Rooms</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {rooms.length === 0 ? (
                <div className="text-center py-8 text-cyan-400/70 font-mono tracking-wide">
                  No rooms available. Create one or try quick match!
                </div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-sm rounded-lg border border-cyan-400/30 hover:border-cyan-400/50 transition-all duration-200"
                  >
                    <div>
                      <div className="text-white font-semibold font-mono tracking-wider">Room {room.room_code}</div>
                      <div className="text-cyan-400/80 text-sm font-mono">
                        {room.current_players}/{room.max_players} players
                      </div>
                    </div>
                    <button
                      onClick={() => joinRoom(room)}
                      disabled={isSearching}
                      className="pixel-btn pixel-btn-success"
                    >
                      Join
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
