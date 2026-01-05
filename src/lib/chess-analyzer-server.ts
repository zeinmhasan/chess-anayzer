/**
 * Chess Analyzer - Server Version for Node.js
 * 
 * This is a server-side implementation that uses the Node.js Stockfish engine
 * instead of the browser version. Use this in API routes.
 */

import { Chess } from 'chess.js';
import { StockfishServerEngine } from './stockfish-server';
import type {
  GameAnalysis,
  AnalyzedMove,
  MoveClassification,
} from '@/types/chess';

/**
 * Extract moves from PGN string
 */
function extractMovesFromPGN(pgn: string): string[] {
  const lines = pgn.split('\n');
  const moveLines = lines.filter(line => !line.startsWith('[') && line.trim());
  const moveText = moveLines.join(' ');
  
  const moves = moveText
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\d+\.\s*/g, '')
    .replace(/[?!+#]/g, '')
    .split(/\s+/)
    .filter(move => move && move !== '*' && !move.match(/^(1-0|0-1|1\/2-1\/2)$/));
  
  return moves;
}

/**
 * Chess game analyzer for server-side
 */
export class ChessServerAnalyzer {
  private engine: StockfishServerEngine;
  private isInitialized = false;

  constructor() {
    this.engine = new StockfishServerEngine();
  }

  /**
   * Initialize the analyzer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.engine.init();
    this.isInitialized = true;
  }

  /**
   * Analyze a complete chess game
   */
  async analyzeGame(
    pgn: string,
    depth: number = 18,
    onProgress?: (progress: number, message: string) => void
  ): Promise<GameAnalysis> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const game = new Chess();
    const moves = extractMovesFromPGN(pgn);
    
    if (moves.length === 0) {
      throw new Error('No valid moves found in PGN');
    }

    const analysis: GameAnalysis = {
      gameId: 'server-analysis',
      moves: [],
      whiteAccuracy: 0,
      blackAccuracy: 0,
      opening: {
        name: 'Unknown',
        eco: '',
      },
      statistics: {
        white: {
          brilliant: 0,
          great: 0,
          good: 0,
          book: 0,
          inaccuracy: 0,
          mistake: 0,
          blunder: 0,
        },
        black: {
          brilliant: 0,
          great: 0,
          good: 0,
          book: 0,
          inaccuracy: 0,
          mistake: 0,
          blunder: 0,
        },
      },
      criticalMoments: [],
      evaluations: [],
    };

    let whiteAccuracySum = 0;
    let blackAccuracySum = 0;
    let whiteMovesCount = 0;
    let blackMovesCount = 0;

    // Analyze each move
    for (let i = 0; i < moves.length; i++) {
      const moveNumber = Math.floor(i / 2) + 1;
      const isWhite = i % 2 === 0;
      
      if (onProgress) {
        const progress = ((i + 1) / moves.length) * 100;
        onProgress(progress, `Analyzing move ${i + 1}/${moves.length}`);
      }

      const fenBefore = game.fen();
      
      // Get evaluation before move
      const evalBefore = await this.engine.analyzePosition(fenBefore, { depth });
      const bestMove = await this.engine.getBestMove(fenBefore, depth);

      // Make the move
      const move = game.move(moves[i]);
      if (!move) {
        throw new Error(`Invalid move at position ${i + 1}: ${moves[i]}`);
      }

      const fenAfter = game.fen();
      
      // Get evaluation after move
      const evalAfter = await this.engine.analyzePosition(fenAfter, { depth });

      // Calculate centipawn loss
      const scoreBefore = isWhite ? evalBefore.score : -evalBefore.score;
      const scoreAfter = isWhite ? -evalAfter.score : evalAfter.score;
      const cpLoss = Math.max(0, scoreBefore - scoreAfter);

      // Classify move
      const classification = this.classifyMove(cpLoss, evalBefore, move.san);
      
      // Calculate move accuracy
      const moveAccuracy = Math.max(0, 100 - cpLoss / 2);
      
      if (isWhite) {
        whiteAccuracySum += moveAccuracy;
        whiteMovesCount++;
      } else {
        blackAccuracySum += moveAccuracy;
        blackMovesCount++;
      }

      // Create move analysis
      const moveAnalysis: AnalyzedMove = {
        moveNumber,
        san: move.san,
        fen: fenAfter,
        evaluation: evalAfter.score,
        bestMove,
        classification,
        centipawnLoss: cpLoss,
        isWhite,
      };

      analysis.moves.push(moveAnalysis);
      analysis.evaluations.push(evalAfter.score);
      
      // Update statistics
      const stats = isWhite ? analysis.statistics.white : analysis.statistics.black;
      stats[classification]++;

      // Detect critical moments
      if (cpLoss >= 300 || classification === 'blunder') {
        analysis.criticalMoments.push({
          moveNumber,
          fen: fenAfter,
          description: `${isWhite ? 'White' : 'Black'} blundered with ${move.san}`,
          evaluationChange: cpLoss,
        });
      }
    }

    // Calculate overall accuracy
    analysis.whiteAccuracy = whiteMovesCount > 0 
      ? whiteAccuracySum / whiteMovesCount 
      : 0;
    analysis.blackAccuracy = blackMovesCount > 0 
      ? blackAccuracySum / blackMovesCount 
      : 0;

    return analysis;
  }

  /**
   * Classify a move based on centipawn loss
   */
  private classifyMove(
    cpLoss: number,
    evaluation: { score: number; mate?: number },
    _san: string
  ): MoveClassification {
    if (cpLoss === 0 && !evaluation.mate) {
      return 'brilliant';
    }
    if (cpLoss <= 10) {
      return 'great';
    }
    if (cpLoss <= 25) {
      return 'good';
    }
    if (cpLoss <= 50) {
      return 'book';
    }
    if (cpLoss <= 100) {
      return 'inaccuracy';
    }
    if (cpLoss <= 200) {
      return 'mistake';
    }
    return 'blunder';
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.engine.terminate();
    this.isInitialized = false;
  }
}

// Singleton for server use
let serverAnalyzerInstance: ChessServerAnalyzer | null = null;

/**
 * Get or create server analyzer singleton
 */
export async function getServerAnalyzer(): Promise<ChessServerAnalyzer> {
  if (!serverAnalyzerInstance) {
    serverAnalyzerInstance = new ChessServerAnalyzer();
    await serverAnalyzerInstance.initialize();
  }
  return serverAnalyzerInstance;
}

/**
 * Cleanup server analyzer
 */
export async function destroyServerAnalyzer(): Promise<void> {
  if (serverAnalyzerInstance) {
    await serverAnalyzerInstance.destroy();
    serverAnalyzerInstance = null;
  }
}
