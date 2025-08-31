# 🎮 Tetris Multiplayer Setup Guide

## Quick Start

You're seeing the error because the multiplayer database tables haven't been created yet. Here's how to fix it:

### 1. Set up Supabase Database

1. **Open your Supabase project** at [supabase.com](https://supabase.com)
2. **Go to the SQL Editor** (left sidebar)
3. **Copy and paste the entire contents** of `MULTIPLAYER_SETUP.sql` into the editor
4. **Click "Run"** to create all the tables and functions

### 2. Verify Tables Created

After running the SQL, you should see these tables in your Database > Tables:
- `game_rooms`
- `game_players` 
- `game_state`
- `attack_queue`
- `scores` (if not already created)

### 3. Test the Connection

1. **Restart your development server**: `npm run dev`
2. **Go to Multiplayer** in the game
3. **Try creating a room** - it should now work!

## What Each Button Does

- **🟢 Find Match**: Joins an existing room or creates a new one automatically
- **🔵 Create Room**: Creates a private room with a shareable 6-character code
- **🟣 Join by Code**: Enter a room code to join a specific game

## Multiplayer Features

### 🏠 Room System
- **Room Codes**: 6-character codes to share with friends
- **Real-time Updates**: See when players join/leave
- **Ready System**: Both players must ready up to start

### ⚔️ Battle Mechanics
- **Attack Lines**: Send garbage lines when clearing multiple lines
  - 2 lines = 1 attack line
  - 3 lines = 2 attack lines  
  - 4 lines (Tetris) = 4 attack lines
- **Combo Bonuses**: Clear lines consecutively for extra attack power
- **Live Opponent View**: See your opponent's grid in real-time

### 🎯 Scoring
- Same as single player, plus combo bonuses
- Winner is last player standing
- Scores saved to leaderboard

## Troubleshooting

### "Failed to create room" Error
- ✅ **Solution**: Run `MULTIPLAYER_SETUP.sql` in Supabase SQL Editor

### "Database connection failed"  
- Check your `.env.local` file has correct Supabase credentials
- Verify your Supabase project is active

### Real-time Updates Not Working
- Make sure Supabase real-time is enabled (it's on by default)
- Check browser console for WebSocket errors

### Can't Join Rooms
- Verify all multiplayer tables exist in Supabase
- Check that RLS policies are created (they're in the SQL file)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Player 1      │    │   Player 2      │
│   (Browser)     │    │   (Browser)     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────┬─────────┬─────┘
                 │         │
           ┌─────▼─────────▼─────┐
           │   Supabase DB       │
           │   Real-time Sync    │
           └─────────────────────┘
```

### Database Tables
- **game_rooms**: Room metadata and status
- **game_players**: Player info and ready states  
- **game_state**: Live game grid and piece data
- **attack_queue**: Pending garbage lines to send

### Real-time Features
- Room updates (players joining/leaving)
- Game state synchronization  
- Attack line delivery
- Game over detection

## Performance Notes

- Game state syncs every few seconds, not every frame
- Attack lines are queued and processed smoothly
- Opponent grid updates in real-time
- Optimized for 2 players (can be extended)

## Next Steps

Once multiplayer is working:
1. **Test with a friend** using room codes
2. **Try different game modes** (quick match vs private rooms)
3. **Experiment with attack strategies** (save lines for bigger combos)
4. **Deploy to Vercel** for online play

Happy gaming! 🎮
