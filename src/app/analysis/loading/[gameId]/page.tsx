'use client';

/**
 * Analysis Loading Page
 * 
 * Halaman ini menjalankan analisis Stockfish yang sebenarnya
 * sebelum user dapat melihat hasil analisis.
 * 
 * Alur:
 * 1. Load game dari localStorage
 * 2. Initialize Stockfish engine
 * 3. Analisis setiap posisi dengan depth yang cukup
 * 4. Simpan hasil ke localStorage
 * 5. Redirect ke halaman hasil analisis
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess } from 'chess.js';
import { StockfishEngine } from '@/lib/stockfish';
import type { StockfishEvaluation } from '@/types/chess';
import { AlertCircle, CheckCircle2, Loader2, Cpu, Zap, Brain } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GameData {
  id: string;
  pgn: string;
  white: string;
  black: string;
  whiteRating: number;
  blackRating: number;
  timeClass: string;
  date: string;
  result: string;
  url: string;
}

export type MoveClassification = 
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'forced';

export interface RealAnalyzedMove {
  moveNumber: number;
  notation: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  fen: string;
  fenBefore: string;
  isWhite: boolean;
  
  // Real evaluations from Stockfish
  evalBefore: StockfishEvaluation;
  evalAfter: StockfishEvaluation;
  bestMove: {
    uci: string;
    san: string;
    eval: StockfishEvaluation;
  } | null;
  
  // Classification
  classification: MoveClassification;
  centipawnLoss: number;
  
  // Flags
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
  isPromotion: boolean;
}

export interface RealGameAnalysis {
  gameId: string;
  moves: RealAnalyzedMove[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteMoveStats: Record<MoveClassification, number>;
  blackMoveStats: Record<MoveClassification, number>;
  evaluations: number[]; // Evaluation after each move
  analysisDepth: number;
  analyzedAt: string;
}

// ============================================================================
// Analysis Configuration
// ============================================================================

const ANALYSIS_CONFIG = {
  depth: 16, // Depth yang baik untuk analisis (bisa ditingkatkan)
  openingBookMoves: 6, // 6 langkah pertama dianggap book moves
  
  // Thresholds dalam centipawns (1 pawn = 100 cp)
  thresholds: {
    excellent: 15,   // 0.15 pawn - hampir perfect
    good: 30,        // 0.3 pawn - gerakan bagus
    inaccuracy: 60,  // 0.6 pawn - sedikit tidak akurat
    mistake: 120,    // 1.2 pawn - kesalahan
    blunder: 200,    // 2.0 pawn - blunder besar
  },
  
  // Winning threshold (untuk mendeteksi missed wins)
  winningThreshold: 200, // 2 pawns advantage = winning
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get centipawn value from evaluation (considering mate scores)
 */
function getCentipawns(evaluation: StockfishEvaluation): number {
  if (evaluation.mate !== undefined && evaluation.mate !== null) {
    // Mate scores: positive = white mates, negative = black mates
    // Convert to very high centipawn values
    return evaluation.mate > 0 
      ? 10000 - Math.abs(evaluation.mate) * 10
      : -10000 + Math.abs(evaluation.mate) * 10;
  }
  return evaluation.score;
}

// Centipawn loss is calculated inline during move analysis

/**
 * Classify move based on centipawn loss
 */
function classifyMove(
  cpLoss: number,
  playedMove: string,
  bestMoveSan: string | null,
  moveIndex: number,
  legalMovesCount: number,
  _evalBefore: StockfishEvaluation,
  _evalAfter: StockfishEvaluation,
  _isWhite: boolean
): MoveClassification {
  // First N moves are book moves
  if (moveIndex < ANALYSIS_CONFIG.openingBookMoves * 2) {
    return 'book';
  }
  
  // Only one legal move = forced
  if (legalMovesCount === 1) {
    return 'forced';
  }
  
  // Played the best move
  if (bestMoveSan && playedMove === bestMoveSan) {
    // Could enhance with brilliant move detection:
    // - Check if only winning move in losing/equal position
    // - Check for sacrifice that leads to advantage
    // For now, just mark as "best"
    return 'best';
  }
  
  // Classify based on centipawn loss
  const { excellent, good, inaccuracy, mistake } = ANALYSIS_CONFIG.thresholds;
  
  if (cpLoss <= excellent) {
    return 'excellent';
  } else if (cpLoss <= good) {
    return 'good';
  } else if (cpLoss <= inaccuracy) {
    return 'inaccuracy';
  } else if (cpLoss <= mistake) {
    return 'mistake';
  } else {
    return 'blunder';
  }
}

/**
 * Calculate accuracy from moves using a formula similar to chess.com
 * Based on centipawn loss per move
 */
function calculateAccuracy(moves: RealAnalyzedMove[]): number {
  // Filter out book moves
  const analyzedMoves = moves.filter(m => m.classification !== 'book' && m.classification !== 'forced');
  
  if (analyzedMoves.length === 0) return 100;
  
  // Use a formula where accuracy decreases with centipawn loss
  // This is a simplified version of chess.com's formula
  // accuracy = 103.1668 * exp(-0.04354 * avgCpLoss) - 3.1669
  // We'll use a simpler but effective formula:
  
  let totalAccuracy = 0;
  
  for (const move of analyzedMoves) {
    // Each move's accuracy: 100% at 0 cpLoss, decreasing exponentially
    // accuracy_move = max(0, 100 * exp(-cpLoss / 100))
    const moveAccuracy = Math.max(0, 100 * Math.exp(-move.centipawnLoss / 80));
    totalAccuracy += moveAccuracy;
  }
  
  const avgAccuracy = totalAccuracy / analyzedMoves.length;
  
  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, Math.round(avgAccuracy * 10) / 10));
}

// ============================================================================
// Analysis Loading Component
// ============================================================================

export default function AnalysisLoadingPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  
  const [status, setStatus] = useState<'loading' | 'analyzing' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [gameData, setGameData] = useState<GameData | null>(null);
  
  const engineRef = useRef<StockfishEngine | null>(null);
  const isAnalyzingRef = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.terminate();
        engineRef.current = null;
      }
    };
  }, []);
  
  const runAnalysis = useCallback(async () => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    
    try {
      // 1. Load game from localStorage
      setProgress({ current: 0, total: 100, message: 'Loading game data...' });
      
      const storedData = localStorage.getItem('pendingAnalysis');
      if (!storedData) {
        throw new Error('No game data found. Please select a game first.');
      }
      
      const game: GameData = JSON.parse(storedData);
      if (game.id !== gameId) {
        throw new Error('Game ID mismatch. Please select the game again.');
      }
      
      setGameData(game);
      
      // 2. Parse PGN
      setProgress({ current: 5, total: 100, message: 'Parsing game...' });
      
      const chess = new Chess();
      try {
        chess.loadPgn(game.pgn);
      } catch {
        throw new Error('Failed to parse game PGN.');
      }
      
      const history = chess.history({ verbose: true });
      const totalMoves = history.length;
      
      if (totalMoves === 0) {
        throw new Error('No moves found in this game.');
      }
      
      // 3. Initialize Stockfish with retry logic
      setProgress({ current: 10, total: 100, message: 'Starting analysis engine...' });
      setStatus('analyzing');
      
      const engine = new StockfishEngine();
      engineRef.current = engine;
      
      // Retry initialization up to 3 times
      let initAttempts = 0;
      const maxAttempts = 3;
      
      while (initAttempts < maxAttempts) {
        try {
          initAttempts++;
          if (initAttempts > 1) {
            setProgress({ 
              current: 10, 
              total: 100, 
              message: `Initializing engine (attempt ${initAttempts}/${maxAttempts})...` 
            });
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          await engine.init();
          break; // Success!
        } catch (initErr) {
          console.warn(`Stockfish init attempt ${initAttempts} failed:`, initErr);
          
          if (initAttempts >= maxAttempts) {
            throw new Error(`Engine failed to start after ${maxAttempts} attempts. Please try again.`);
          }
          
          // Terminate and recreate engine for next attempt
          engine.terminate();
          engineRef.current = new StockfishEngine();
        }
      }
      
      // Use the successfully initialized engine
      const activeEngine = engineRef.current!;
      
      // 4. Analyze each position
      const analyzedMoves: RealAnalyzedMove[] = [];
      const evaluations: number[] = [];
      
      // Reset to starting position
      chess.reset();
      
      // Get initial position evaluation
      const startEval = await activeEngine.analyzePosition(chess.fen(), { depth: ANALYSIS_CONFIG.depth });
      let previousEval = startEval;
      
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const isWhite = chess.turn() === 'w';
        const moveNumber = Math.floor(i / 2) + 1;
        
        // Update progress
        const progressPercent = 10 + Math.round((i / totalMoves) * 85);
        setProgress({
          current: progressPercent,
          total: 100,
          message: `Analyzing move ${moveNumber}${isWhite ? '.' : '...'} ${move.san}`,
        });
        
        // Position before move
        const fenBefore = chess.fen();
        const evalBefore = previousEval;
        
        // Get best move for this position
        let bestMoveData: RealAnalyzedMove['bestMove'] = null;
        try {
          const analysis = await activeEngine.analyzePosition(fenBefore, { depth: ANALYSIS_CONFIG.depth });
          
          if (analysis.bestMove) {
            // Convert UCI to SAN
            const tempChess = new Chess(fenBefore);
            const from = analysis.bestMove.slice(0, 2);
            const to = analysis.bestMove.slice(2, 4);
            const promotion = analysis.bestMove.length > 4 ? analysis.bestMove[4] : undefined;
            
            try {
              const sanMove = tempChess.move({ from, to, promotion });
              if (sanMove) {
                bestMoveData = {
                  uci: analysis.bestMove,
                  san: sanMove.san,
                  eval: analysis,
                };
              }
            } catch {
              // Move parsing failed, skip best move
            }
          }
        } catch {
          // Best move calculation failed, continue
        }
        
        // Get legal moves count (for forced move detection)
        const legalMoves = chess.moves();
        const legalMovesCount = legalMoves.length;
        
        // Make the actual move
        chess.move(move);
        
        // Position after move
        const fenAfter = chess.fen();
        const evalAfter = await activeEngine.analyzePosition(fenAfter, { depth: ANALYSIS_CONFIG.depth });
        
        // Calculate centipawn loss
        // Compare: what would eval be after best move vs what it is after played move
        let cpLoss = 0;
        if (bestMoveData) {
          const bestMoveEval = getCentipawns(bestMoveData.eval);
          const playedMoveEval = getCentipawns(evalAfter);
          
          // Since evalAfter is from opponent's perspective, we need to flip
          // If white played: loss = bestMoveEval - (-playedMoveEval)
          // If black played: loss = -bestMoveEval - playedMoveEval
          if (isWhite) {
            cpLoss = Math.max(0, bestMoveEval - (-playedMoveEval));
          } else {
            cpLoss = Math.max(0, -bestMoveEval - playedMoveEval);
          }
        }
        
        // Classify the move
        const classification = classifyMove(
          cpLoss,
          move.san,
          bestMoveData?.san || null,
          i,
          legalMovesCount,
          evalBefore,
          evalAfter,
          isWhite
        );
        
        // Create analyzed move
        const analyzedMove: RealAnalyzedMove = {
          moveNumber,
          notation: move.san,
          from: move.from,
          to: move.to,
          piece: move.piece,
          captured: move.captured,
          promotion: move.promotion,
          fen: fenAfter,
          fenBefore,
          isWhite,
          evalBefore,
          evalAfter,
          bestMove: bestMoveData,
          classification,
          centipawnLoss: cpLoss,
          isCapture: !!move.captured,
          isCheck: chess.isCheck(),
          isCheckmate: chess.isCheckmate(),
          isCastling: move.san === 'O-O' || move.san === 'O-O-O',
          isPromotion: !!move.promotion,
        };
        
        analyzedMoves.push(analyzedMove);
        
        // Store evaluation for the graph (from white's perspective)
        evaluations.push(getCentipawns(evalAfter) * (isWhite ? -1 : 1));
        
        // Update previous eval for next iteration
        previousEval = evalAfter;
      }
      
      // 5. Calculate statistics
      setProgress({ current: 95, total: 100, message: 'Calculating statistics...' });
      
      const whiteMoves = analyzedMoves.filter(m => m.isWhite);
      const blackMoves = analyzedMoves.filter(m => !m.isWhite);
      
      const whiteAccuracy = calculateAccuracy(whiteMoves);
      const blackAccuracy = calculateAccuracy(blackMoves);
      
      // Count move classifications
      const countStats = (moves: RealAnalyzedMove[]): Record<MoveClassification, number> => {
        const stats: Record<MoveClassification, number> = {
          brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
          book: 0, inaccuracy: 0, mistake: 0, blunder: 0, forced: 0,
        };
        moves.forEach(m => stats[m.classification]++);
        return stats;
      };
      
      const whiteMoveStats = countStats(whiteMoves);
      const blackMoveStats = countStats(blackMoves);
      
      // 6. Save analysis result
      const analysisResult: RealGameAnalysis = {
        gameId,
        moves: analyzedMoves,
        whiteAccuracy,
        blackAccuracy,
        whiteMoveStats,
        blackMoveStats,
        evaluations,
        analysisDepth: ANALYSIS_CONFIG.depth,
        analyzedAt: new Date().toISOString(),
      };
      
      localStorage.setItem(`analysis_${gameId}`, JSON.stringify(analysisResult));
      
      // 7. Cleanup and redirect
      setProgress({ current: 100, total: 100, message: 'Analysis complete!' });
      setStatus('done');
      
      engine.terminate();
      engineRef.current = null;
      
      // Short delay to show completion, then redirect
      setTimeout(() => {
        router.replace(`/analysis/${gameId}`);
      }, 1000);
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStatus('error');
      
      if (engineRef.current) {
        engineRef.current.terminate();
        engineRef.current = null;
      }
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [gameId, router]);
  
  // Start analysis on mount
  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);
  
  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Analysis Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/games')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Select Another Game
            </button>
            <button
              onClick={() => {
                setStatus('loading');
                setError(null);
                runAnalysis();
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Loading/Analyzing state
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-lg w-full">
        {/* Status Icon */}
        <div className="mb-6">
          {status === 'done' ? (
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto animate-pulse" />
          ) : status === 'analyzing' ? (
            <div className="relative">
              <Cpu className="w-20 h-20 text-blue-500 mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
              </div>
            </div>
          ) : (
            <Loader2 className="w-20 h-20 text-blue-500 mx-auto animate-spin" />
          )}
        </div>
        
        {/* Title */}
        <h2 className="text-2xl font-bold mb-2">
          {status === 'done' ? 'Analysis Complete!' : 'Analyzing Game'}
        </h2>
        
        {/* Game Info */}
        {gameData && (
          <p className="text-gray-400 mb-6">
            {gameData.white} vs {gameData.black}
            <span className="text-gray-600 mx-2">•</span>
            {gameData.timeClass}
          </p>
        )}
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-800 rounded-full h-3 mb-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress.current}%` }}
          />
        </div>
        
        {/* Progress Text */}
        <div className="flex justify-between text-sm mb-6">
          <span className="text-gray-400">{progress.message}</span>
          <span className="text-blue-400 font-mono">{progress.current}%</span>
        </div>
        
        {/* Analysis Info */}
        {status === 'analyzing' && (
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
              <Brain className="w-5 h-5 text-purple-400" />
              <span>Stockfish depth {ANALYSIS_CONFIG.depth}</span>
              <span className="text-gray-600">•</span>
              <span>Real-time engine analysis</span>
            </div>
          </div>
        )}
        
        {/* Tips */}
        <div className="mt-8 text-sm text-gray-500">
          <p>Analysis may take 1-2 minutes depending on game length.</p>
          <p className="mt-1">Do not close this page.</p>
        </div>
      </div>
    </div>
  );
}
