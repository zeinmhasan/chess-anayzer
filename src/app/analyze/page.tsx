'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getRecentGames, parseChessComGame } from '@/lib/chess-com-api';
import type { ParsedGame } from '@/types/chess';
import { ArrowLeft, RefreshCw, ExternalLink, Clock, Calendar, Trophy } from 'lucide-react';

function GameSelectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get('username');
  
  const [games, setGames] = useState<ParsedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    if (!username) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch last 20 games
      const rawGames = await getRecentGames(username, 20);
      const parsedGames = rawGames.map(parseChessComGame);
      setGames(parsedGames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (username) {
      fetchGames();
    }
  }, [username, fetchGames]);

  const handleSelectGame = (game: ParsedGame) => {
    // In a real app, we might want to store the PGN in a context or pass it via state
    // For now, we'll just navigate to the analysis page with the game ID
    // We might need to fetch the PGN again on the analysis page or pass it differently
    // But the analysis page currently uses mock data. 
    // I should probably update the analysis page to accept PGN or fetch it.
    // For this task, I'll just navigate.
    router.push(`/analysis/${game.id}`);
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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Games for {username}</h1>
              <p className="text-gray-400 text-sm">Select a game to analyze</p>
            </div>
          </div>
          <button 
            onClick={fetchGames}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-800 h-24 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No games found for this user.
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <div 
                key={game.id}
                onClick={() => handleSelectGame(game)}
                className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/50 hover:shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${game.white.toLowerCase() === username.toLowerCase() ? 'text-blue-400' : 'text-white'}`}>
                          {game.white}
                        </span>
                        <span className="text-gray-500 text-sm">({game.whiteRating})</span>
                      </div>
                      <span className="text-gray-600 font-mono">vs</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${game.black.toLowerCase() === username.toLowerCase() ? 'text-blue-400' : 'text-white'}`}>
                          {game.black}
                        </span>
                        <span className="text-gray-500 text-sm">({game.blackRating})</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span className="capitalize">{game.timeClass} ({game.timeControl})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{game.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Trophy className={`w-4 h-4 ${
                          (game.white.toLowerCase() === username.toLowerCase() && game.result === 'win') ||
                          (game.black.toLowerCase() === username.toLowerCase() && game.result === 'win') 
                            ? 'text-green-400' 
                            : 'text-gray-400'
                        }`} />
                        <span className="capitalize">{game.result.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function GameSelectionFallback() {
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
export default function GameSelectionPage() {
  return (
    <Suspense fallback={<GameSelectionFallback />}>
      <GameSelectionContent />
    </Suspense>
  );
}
