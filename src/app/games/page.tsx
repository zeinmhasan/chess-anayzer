'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getRecentGames, parseChessComGame } from '@/lib/chess-com-api';
import type { ParsedGame } from '@/types/chess';
import { useToast } from '@/components/Toast';
import { GameCardSkeleton } from '@/components/Skeleton';
import { 
  ArrowLeft, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  Calendar, 
  Trophy, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown
} from 'lucide-react';

type SortOption = 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc';
type FilterResult = 'all' | 'win' | 'loss' | 'draw';
type FilterTimeControl = 'all' | 'bullet' | 'blitz' | 'rapid' | 'daily';

const ITEMS_PER_PAGE = 10;

function GameSelectorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get('username');
  const toast = useToast();
  
  const [games, setGames] = useState<ParsedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<FilterResult>('all');
  const [timeControlFilter, setTimeControlFilter] = useState<FilterTimeControl>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchGames = useCallback(async () => {
    if (!username) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch last 50 games for a good selection
      const rawGames = await getRecentGames(username, 50);
      const parsedGames = rawGames.map(parseChessComGame);
      setGames(parsedGames);
      if (parsedGames.length > 0) {
        toast.success(`Loaded ${parsedGames.length} games`, `Found games for ${username}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch games';
      setError(message);
      toast.error('Failed to load games', message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]); // Removed toast from deps to prevent infinite loop

  useEffect(() => {
    if (username) {
      fetchGames();
    }
  }, [username, fetchGames]);

  const filteredGames = useMemo(() => {
    let filtered = [...games];

    // Search (Opponent name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.white.toLowerCase().includes(query) || 
        g.black.toLowerCase().includes(query)
      );
    }

    // Result Filter
    if (resultFilter !== 'all') {
      filtered = filtered.filter(g => {
        const userIsWhite = g.white.toLowerCase() === username?.toLowerCase();
        
        const whiteWon = g.result === 'win';
        const isDraw = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(g.result);
        
        if (resultFilter === 'win') {
          return (userIsWhite && whiteWon) || (!userIsWhite && !whiteWon && !isDraw);
        }
        if (resultFilter === 'loss') {
          return (userIsWhite && !whiteWon && !isDraw) || (!userIsWhite && whiteWon);
        }
        if (resultFilter === 'draw') {
          return isDraw;
        }
        return true;
      });
    }

    // Time Control Filter
    if (timeControlFilter !== 'all') {
      filtered = filtered.filter(g => g.timeClass === timeControlFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      const getRating = (g: ParsedGame) => g.white.toLowerCase() === username?.toLowerCase() ? g.whiteRating : g.blackRating;

      switch (sortBy) {
        case 'date-desc': return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc': return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'rating-desc': return (getRating(b) || 0) - (getRating(a) || 0);
        case 'rating-asc': return (getRating(a) || 0) - (getRating(b) || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [games, searchQuery, resultFilter, timeControlFilter, sortBy, username]);

  // Pagination
  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE);
  const paginatedGames = filteredGames.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleAnalyze = (gameId: string) => {
    // Find the game and store it in localStorage for the analysis page
    const game = games.find(g => g.id === gameId);
    if (game) {
      // Check if we already have analysis for this game
      const existingAnalysis = localStorage.getItem(`analysis_${gameId}`);
      
      // Store game data for analysis
      localStorage.setItem('pendingAnalysis', JSON.stringify({
        id: game.id,
        pgn: game.pgn,
        white: game.white,
        black: game.black,
        whiteRating: game.whiteRating,
        blackRating: game.blackRating,
        timeClass: game.timeClass,
        date: game.date,
        result: game.result,
        url: game.url
      }));
      
      // If already analyzed, go directly to analysis page
      // Otherwise, go to loading page for Stockfish analysis
      if (existingAnalysis) {
        router.push(`/analysis/${gameId}`);
      } else {
        router.push(`/analysis/loading/${gameId}`);
      }
      return;
    }
    router.push(`/analysis/${gameId}`);
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No username provided</h2>
          <button 
            onClick={() => router.push('/')}
            className="text-blue-400 hover:underline flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Games for {username}</h1>
              <p className="text-gray-400 text-sm">Select a game to analyze</p>
            </div>
          </div>
          <button 
            onClick={fetchGames}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters & Controls */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search opponent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Result Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value as FilterResult)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">All Results</option>
                <option value="win">Wins</option>
                <option value="loss">Losses</option>
                <option value="draw">Draws</option>
              </select>
            </div>

            {/* Time Control Filter */}
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={timeControlFilter}
                onChange={(e) => setTimeControlFilter(e.target.value as FilterTimeControl)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">All Time Controls</option>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            {/* Sort */}
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="rating-desc">Highest Rating</option>
                <option value="rating-asc">Lowest Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-900 text-red-200 p-4 rounded-lg mb-6 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            {error}
          </div>
        )}

        {/* Games List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-gray-700/50">
            <p className="text-gray-400 text-lg">No games found matching your filters.</p>
            <button 
              onClick={() => {
                setSearchQuery('');
                setResultFilter('all');
                setTimeControlFilter('all');
              }}
              className="mt-4 text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedGames.map((game) => {
              const isWhite = game.white.toLowerCase() === username?.toLowerCase();
              const userRating = isWhite ? game.whiteRating : game.blackRating;
              const opponentName = isWhite ? game.black : game.white;
              const opponentRating = isWhite ? game.blackRating : game.whiteRating;
              
              // Determine result color
              // Note: This logic is simplified and depends on 'win' string in result
              // Ideally we'd parse the PGN result (1-0, 0-1, 1/2-1/2)
              let resultColor = 'text-gray-400';
              let resultText = game.result;
              
              // Heuristic for result display
              // If I am white and result is 'win', I won.
              // If I am black and result is 'checkmated', I lost (likely).
              // This is tricky with just the 'result' string from API which describes HOW the game ended, not necessarily who won in a simple way without the 'winner' field.
              // However, the API usually provides a 'winner' field in the raw data, but our ParsedGame might not have it.
              // Let's check ParsedGame type again.
              // It has 'result'. In parseChessComGame, result = game.white.result.
              // This is definitely the result of the WHITE player.
              
              const whiteResult = game.result;

              if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(whiteResult)) {
                resultColor = 'text-gray-400';
                resultText = 'Draw';
              } else if (whiteResult === 'win') {
                if (isWhite) { resultColor = 'text-green-400'; resultText = 'Won'; }
                else { resultColor = 'text-red-400'; resultText = 'Lost'; }
              } else {
                // White lost (checkmated, resigned, timeout, etc)
                if (isWhite) { resultColor = 'text-red-400'; resultText = 'Lost'; }
                else { resultColor = 'text-green-400'; resultText = 'Won'; }
              }

              return (
                <div 
                  key={game.id}
                  className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-4 transition-all hover:border-blue-500/50 hover:shadow-lg group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Game Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`font-bold text-lg ${isWhite ? 'text-blue-400' : 'text-white'}`}>
                          {isWhite ? username : opponentName}
                        </span>
                        <span className="text-gray-500 text-sm">({isWhite ? userRating : opponentRating})</span>
                        <span className="text-gray-600 font-mono px-2">vs</span>
                        <span className={`font-bold text-lg ${!isWhite ? 'text-blue-400' : 'text-white'}`}>
                          {!isWhite ? username : opponentName}
                        </span>
                        <span className="text-gray-500 text-sm">({!isWhite ? userRating : opponentRating})</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5 bg-gray-900/50 px-2 py-1 rounded">
                          <Clock className="w-3 h-3" />
                          <span className="capitalize">{game.timeClass}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>{game.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Trophy className={`w-3 h-3 ${resultColor}`} />
                          <span className={resultColor}>{resultText}</span>
                          <span className="text-gray-600 text-xs">({game.result.replace('_', ' ')})</span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-3">
                      <a 
                        href={game.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="View on Chess.com"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleAnalyze(game.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-blue-900/20"
                      >
                        Analyze
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-gray-400">
              Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
// Loading fallback for Suspense
function GameSelectorFallback() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading games...</p>
      </div>
    </div>
  );
}

// Export wrapped in Suspense
export default function GameSelectorPage() {
  return (
    <Suspense fallback={<GameSelectorFallback />}>
      <GameSelectorContent />
    </Suspense>
  );
}