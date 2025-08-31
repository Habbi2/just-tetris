# Deployment Guide for Tetris Online

## 🚀 Deploy to Vercel

### Option 1: Deploy with Vercel CLI

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

4. **Set Environment Variables**:
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Option 2: Deploy via GitHub

1. **Push to GitHub**:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/tetris-online.git
git push -u origin main
```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables

### Option 3: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/tetris-online&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY)

## 🗄️ Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Create Database Tables

#### Single Player Setup
Run this SQL in your Supabase SQL Editor:

```sql
-- Create the scores table
CREATE TABLE scores (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  lines INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index for better performance
CREATE INDEX idx_scores_score ON scores (score DESC);

-- Enable Row Level Security (optional)
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Anyone can view scores" ON scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scores" ON scores FOR INSERT WITH CHECK (true);
```

#### Multiplayer Setup (Required for Multiplayer Mode)
**Important**: Run the contents of `MULTIPLAYER_SETUP.sql` to enable multiplayer features:

```sql
-- Copy and paste the entire contents of MULTIPLAYER_SETUP.sql
-- This includes tables for: game_rooms, game_players, game_state, attack_queue
-- Plus RLS policies and helper functions
```

### 3. Configure Environment Variables

In Vercel, add these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your-anon-key`

## 🎮 Game Features

### Single Player Mode
- Classic Tetris gameplay with hold piece and next piece preview
- Combo scoring system  
- Real-time leaderboard
- Progressive difficulty levels
- Ghost piece landing preview

### Multiplayer Mode
- **Matchmaking**: Quick match or create/join private rooms
- **Real-time 1v1 battles**: Synchronized game state between players
- **Attack system**: Send garbage lines to opponents when clearing multiple lines
- **Live opponent view**: See your opponent's grid in real-time
- **Room codes**: Share 6-character codes to play with friends

### Game Controls
- **A/D or Arrow Keys**: Move piece left/right
- **S or Down Arrow**: Soft drop
- **W or Up Arrow**: Rotate piece
- **Space**: Hard drop
- **Shift**: Hold piece (once per spawn)

## 🔧 Production Optimizations

### Performance
- Static generation for main pages
- Dynamic imports for game components
- Optimized bundle splitting
- Phaser 3 with pixel-perfect rendering
- Real-time state synchronization

### SEO
- Meta tags configured
- OpenGraph support
- Responsive design

### Security
- Environment variables properly scoped
- Row Level Security enabled
- Client-side validation

## 🐛 Troubleshooting

### Build Issues
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors
- Verify Supabase configuration
- Run `MULTIPLAYER_SETUP.sql` for multiplayer features

### Runtime Issues
- Check browser console for errors
- Verify Supabase connection and real-time subscriptions
- Ensure environment variables are set
- Check WebSocket connections for multiplayer

### Performance Issues
- Monitor Supabase usage (especially real-time)
- Check Vercel function logs
- Optimize game rendering if needed
- Consider database query optimization for high traffic

### Multiplayer Issues
- Verify all multiplayer tables exist
- Check real-time subscription status in Supabase
- Ensure RLS policies allow proper access
- Test with multiple browser windows locally
