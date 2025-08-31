-- Multiplayer Tetris Database Schema
-- Run these commands in your Supabase SQL editor

-- Table for game rooms/matches
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished')),
  max_players INTEGER DEFAULT 2,
  current_players INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Table for players in game rooms
CREATE TABLE IF NOT EXISTS game_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_name VARCHAR(50) NOT NULL,
  player_number INTEGER NOT NULL, -- 1 or 2
  is_ready BOOLEAN DEFAULT FALSE,
  is_connected BOOLEAN DEFAULT TRUE,
  score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  lines INTEGER DEFAULT 0,
  combo INTEGER DEFAULT 0,
  is_game_over BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, player_number)
);

-- Table for real-time game state synchronization
CREATE TABLE IF NOT EXISTS game_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_number INTEGER NOT NULL,
  grid_state JSONB, -- Serialized game grid
  current_piece JSONB, -- Current falling piece
  next_piece JSONB, -- Next piece preview
  hold_piece JSONB, -- Held piece
  score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  lines INTEGER DEFAULT 0,
  combo INTEGER DEFAULT 0,
  is_game_over BOOLEAN DEFAULT FALSE,
  lines_sent INTEGER DEFAULT 0, -- Attack lines to send to opponent
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure one state row per player per room for idempotent updates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'uniq_game_state_room_player'
  ) THEN
    CREATE UNIQUE INDEX uniq_game_state_room_player 
      ON game_state (room_id, player_number);
  END IF;
END $$;

-- Table for attack lines (garbage lines sent between players)
CREATE TABLE IF NOT EXISTS attack_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  from_player INTEGER NOT NULL,
  to_player INTEGER NOT NULL,
  lines_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, can be tightened later)
CREATE POLICY "Anyone can read game rooms" ON game_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can insert game rooms" ON game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game rooms" ON game_rooms FOR UPDATE USING (true);

CREATE POLICY "Anyone can read game players" ON game_players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert game players" ON game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game players" ON game_players FOR UPDATE USING (true);

CREATE POLICY "Anyone can read game state" ON game_state FOR SELECT USING (true);
CREATE POLICY "Anyone can insert game state" ON game_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game state" ON game_state FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete game state" ON game_state FOR DELETE USING (true);

CREATE POLICY "Anyone can read attack queue" ON attack_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attack queue" ON attack_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update attack queue" ON attack_queue FOR UPDATE USING (true);

-- Function to generate unique room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  exists_check INTEGER;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT COUNT(*) INTO exists_check FROM game_rooms WHERE room_code = code;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old rooms (optional, run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM game_rooms 
  WHERE created_at < NOW() - INTERVAL '24 hours' 
  AND status IN ('finished', 'waiting');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
