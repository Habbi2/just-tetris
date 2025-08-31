# 🧱 Tetris Online

A modern, multiplayer Tetris game built with Next.js, Phaser.js, and Supabase. Play the classic Tetris game online with real-time leaderboards and compete with players worldwide!

## ✨ Features

- 🎮 Classic Tetris gameplay with modern graphics
- 🏆 Real-time leaderboard with Supabase
- 🌐 Online multiplayer scoring system
- 📱 Responsive design that works on desktop and mobile
- ⚡ Built with Next.js for optimal performance
- 🎨 Beautiful UI with Tailwind CSS
- 🚀 Ready for Vercel deployment

## 🎯 How to Play

### Controls
- **A / Left Arrow**: Move piece left
- **D / Right Arrow**: Move piece right
- **S / Down Arrow**: Soft drop (faster fall)
- **W / Up Arrow**: Rotate piece
- **Space**: Hard drop (instant fall)
- **R**: Restart game (when game over)

### Objective
- Complete horizontal lines to clear them and earn points
- The game gets faster as you level up
- Try to achieve the highest score and climb the leaderboard!

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- A Supabase account and project

### 1. Clone and Install
```bash
git clone <your-repo>
cd tetris-online
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. In the Supabase SQL Editor, create the scores table:

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

-- Enable Row Level Security (optional, for security)
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow anyone to read scores
CREATE POLICY "Anyone can view scores" ON scores FOR SELECT USING (true);

-- Create a policy to allow anyone to insert scores
CREATE POLICY "Anyone can insert scores" ON scores FOR INSERT WITH CHECK (true);
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the placeholder values with your actual Supabase credentials.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Deployment on Vercel

### Method 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/tetris-online)

### Method 2: Manual Deploy

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Method 3: GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in the Vercel dashboard
4. Deploy automatically on every push

## 🏗️ Project Structure

```
src/
├── app/
│   ├── globals.css      # Global styles with Tailwind
│   ├── layout.tsx       # Root layout component
│   └── page.tsx         # Main game page
├── components/
│   ├── TetrisGame.tsx   # Main Phaser game component
│   └── Leaderboard.tsx  # Real-time leaderboard
└── lib/
    └── supabase.ts      # Supabase configuration
```

## 🎮 Game Features

### Tetris Mechanics
- Seven different piece types (I, O, T, S, Z, L, J)
- Proper piece rotation and collision detection
- Line clearing with scoring system
- Progressive difficulty (speed increases with level)
- Classic Tetris scoring: 100 points per line × level

### Online Features
- Real-time leaderboard updates
- Player name tracking
- Score persistence with Supabase
- Historical score viewing

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Game Engine**: Phaser.js 3
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Real-time**: Supabase Realtime

## 📱 Mobile Support

The game is designed to work on mobile devices with touch controls. However, for the best experience, we recommend playing on a desktop with a keyboard.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues

1. **Game not loading**: Check browser console for errors, ensure all dependencies are installed
2. **Supabase connection issues**: Verify environment variables are set correctly
3. **Build errors**: Make sure all TypeScript types are properly configured

### Performance Tips

- The game automatically adjusts difficulty based on cleared lines
- Use hard drop (Space) for better control and higher scores
- Focus on creating Tetrises (4-line clears) for maximum points

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Include browser version and any error messages

---

**Enjoy playing Tetris Online! 🎮✨**
