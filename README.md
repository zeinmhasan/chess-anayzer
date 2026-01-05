<p align="center">
  <img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons/chess.svg" width="100" height="100" alt="Chess Analyzer Logo">
</p>

<h1 align="center">♟️ Chess Analyzer</h1>

<p align="center">
  <strong>Free Chess Game Analysis Tool</strong><br>
  Analyze your Chess.com games with Stockfish engine - No premium required!
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-3.0-38bdf8?style=for-the-badge&logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/Stockfish-16-green?style=for-the-badge" alt="Stockfish">
</p>

---

## ✨ Features

### 🎯 Game Analysis
- **Real Stockfish Analysis** - Powered by Stockfish WASM running in your browser
- **Move Classification** - Brilliant, Great, Best, Good, Inaccuracy, Mistake, Blunder
- **Accuracy Calculation** - Get accuracy percentages like Chess.com premium

### 🎮 Interactive Board
- **Drag & Drop** - Move pieces to explore variations
- **Live Evaluation** - Get instant feedback on your moves
- **Best Move Arrows** - See the engine's recommended moves
- **Classification Icons** - Visual indicators on each move (like Chess.com)

### 📊 Visual Analytics
- **Evaluation Graph** - Track advantage throughout the game
- **Move Statistics** - Count of each move classification
- **Critical Moments** - Identify turning points in your games

### 🔗 Chess.com Integration
- **Fetch Games** - Load games directly from Chess.com
- **Any User** - Analyze games from any public Chess.com profile
- **All Time Controls** - Bullet, Blitz, Rapid, and Daily games

---

## 🚀 Demo

1. Enter a Chess.com username (e.g., `hikaru`, `magnuscarlsen`)
2. Select a game from the list
3. Wait for Stockfish analysis to complete
4. Explore the interactive analysis!

---

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Quick Start

```bash
# Clone the repository
git clone https://github.com/zeinmhasan/chess-anayzer.git
cd chess-anayzer

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker (Optional)

```bash
# Build and run with Docker
docker build -t chess-analyzer .
docker run -p 3000:3000 chess-analyzer

# Or use Docker Compose
docker-compose up
```

---

## 🎯 Usage

### Analyze a Game

1. **Enter Username** - Type any Chess.com username on the homepage
2. **Select Game** - Browse and select a game from the list
3. **Wait for Analysis** - Stockfish will analyze each move (depth 16)
4. **Explore Results** - Navigate through moves and see evaluations

### Interactive Mode

- Toggle **Interactive Mode** to move pieces on the board
- Try alternative moves and see instant evaluations
- Click **"Return to game"** to go back to the original position

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous move |
| `→` | Next move |
| `↑` / `Home` | Go to start |
| `↓` / `End` | Go to end |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Chess Engine** | Stockfish WASM |
| **Chess Logic** | chess.js |
| **Board UI** | react-chessboard |
| **Charts** | Recharts |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── analyze/          # Game analysis endpoint
│   │   ├── analysis/         # Cached analysis retrieval
│   │   └── chess-com/        # Chess.com API proxy
│   ├── analysis/             # Analysis pages
│   │   ├── [gameId]/         # Game analysis view
│   │   └── loading/          # Loading/analyzing page
│   ├── games/                # Game selection page
│   └── page.tsx              # Homepage
├── components/               # React Components
│   ├── InteractiveChessboard.tsx
│   ├── EvaluationBar.tsx
│   ├── EvaluationGraph.tsx
│   └── ...
├── lib/                      # Utilities
│   ├── stockfish.ts          # Stockfish engine wrapper
│   ├── chess-analyzer.ts     # Analysis logic
│   └── chess-com-api.ts      # Chess.com API client
└── types/                    # TypeScript types
```

---

## ⚙️ Configuration

### Analysis Depth

The default analysis depth is 16. You can modify this in `src/app/analysis/loading/[gameId]/page.tsx`:

```typescript
const ANALYSIS_DEPTH = 16; // Increase for more accurate analysis
```

### Move Classification Thresholds

Customize move classification in `src/lib/chess-analyzer.ts`:

```typescript
const THRESHOLDS = {
  excellent: 15,    // 0-15 cp loss = Excellent
  good: 30,         // 15-30 cp loss = Good
  inaccuracy: 60,   // 30-60 cp loss = Inaccuracy
  mistake: 120,     // 60-120 cp loss = Mistake
  blunder: 200,     // 120+ cp loss = Blunder
};
```

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Stockfish](https://stockfishchess.org/) - The powerful open-source chess engine
- [Chess.com](https://www.chess.com/) - For their public API
- [chess.js](https://github.com/jhlywa/chess.js) - Chess logic library
- [react-chessboard](https://github.com/Clariity/react-chessboard) - Beautiful React chessboard

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/zeinmhasan">zeinmhasan</a>
</p>

<p align="center">
  ⭐ Star this repo if you find it useful!
</p>
