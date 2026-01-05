/**
 * Chess Game Analyzer
 * 
 * Core logic for analyzing chess games using Stockfish engine.
 * Classifies moves, calculates accuracy, and identifies critical moments.
 * 
 * Features:
 * - Move classification (brilliant, good, inaccuracy, mistake, blunder)
 * - Accuracy calculation
 * - Critical moment detection
 * - Progress callbacks for real-time updates
 * - Comprehensive error handling
 */

import { Chess } from 'chess.js';
import { StockfishEngine } from './stockfish';
import type { StockfishEvaluation } from '@/types/chess';

// ============================================================================
// Types
// ============================================================================

export type MoveClassification = 
  | 'brilliant'    // Best move or nearly best with tactical flair
  | 'great'        // Best move in critical position
  | 'best'         // The engine's top choice
  | 'excellent'    // Within 0.1 pawns of best
  | 'good'         // Within 0.25 pawns of best
  | 'inaccuracy'   // 0.25-0.5 pawns lost
  | 'mistake'      // 0.5-1.5 pawns lost
  | 'blunder'      // 1.5+ pawns lost
  | 'forced'       // Only legal move
  | 'book';        // Opening book move

export interface AnalyzedMove {
  moveNumber: number;
  notation: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  
  // Position info
  fen: string;
  isWhite: boolean;
  
  // Evaluation
  evalBefore: StockfishEvaluation;
  evalAfter: StockfishEvaluation;
  bestMove?: {
    notation: string;
    eval: StockfishEvaluation;
  };
  
  // Classification
  classification: MoveClassification;
  centipawnLoss: number;
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  
  // Tactical flags
  isTactical: boolean;
  isSacrifice: boolean;
  threatsBefore: string[];
  threatsAfter: string[];
}

export interface CriticalMoment {
  moveNumber: number;
  notation: string;
  type: 'turning_point' | 'missed_win' | 'critical_mistake' | 'brilliant_move';
  evalSwing: number;
  description: string;
}

export interface GameAnalysis {
  moves: AnalyzedMove[];
  summary: {
    whiteAccuracy: number;
    blackAccuracy: number;
    totalMoves: number;
    classifications: Record<MoveClassification, number>;
    criticalMoments: CriticalMoment[];
    openingName?: string;
    gamePhases: {
      opening: { start: number; end: number };
      middlegame: { start: number; end: number };
      endgame: { start: number; end: number };
    };
  };
  result: string;
  winner?: 'white' | 'black' | 'draw';
}

export interface AnalysisProgress {
  currentMove: number;
  totalMoves: number;
  percentage: number;
  currentPosition: string;
  message: string;
}

export type AnalysisCallback = (progress: AnalysisProgress) => void;

// ============================================================================
// Constants
// ============================================================================

const ANALYSIS_CONFIG = {
  // Stockfish analysis depth
  depth: 18,
  
  // Move classification thresholds (in centipawns)
  thresholds: {
    excellent: 10,    // 0.1 pawns
    good: 25,         // 0.25 pawns
    inaccuracy: 50,   // 0.5 pawns
    mistake: 150,     // 1.5 pawns
    blunder: 150,     // 1.5+ pawns
  },
  
  // Critical moment detection
  criticalSwing: 200, // 2 pawns swing
  
  // Opening book moves (skip detailed analysis)
  openingMoves: 10,
  
  // Endgame detection (pieces count)
  endgameThreshold: 13,
};

// ============================================================================
// Main Analysis Function
// ============================================================================

export class ChessAnalyzer {
  private engine: StockfishEngine | null = null;
  private isAnalyzing = false;

  constructor() {}

  /**
   * Initialize Stockfish engine
   */
  async initialize(): Promise<void> {
    if (this.engine) return;
    
    this.engine = new StockfishEngine();
    await this.engine.init();
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.engine) {
      await this.engine.terminate();
      this.engine = null;
    }
  }

  /**
   * Check if analyzer is ready
   */
  isReady(): boolean {
    return this.engine !== null && !this.isAnalyzing;
  }

  /**
   * Analyze a chess game from PGN
   */
  async analyzeGame(
    pgn: string,
    onProgress?: AnalysisCallback
  ): Promise<GameAnalysis> {
    if (!this.engine) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;

    try {
      // Load game
      const game = new Chess();
      
      try {
        game.loadPgn(pgn);
      } catch {
        // If PGN loading fails, try to extract just the moves
        const moveText = this.extractMovesFromPGN(pgn);
        game.loadPgn(moveText);
      }

      // Get game history
      const history = game.history({ verbose: true });
      const totalMoves = history.length;

      if (totalMoves === 0) {
        throw new Error('No moves found in PGN');
      }

      // Reset to starting position
      game.reset();

      // Analyze each move
      const analyzedMoves: AnalyzedMove[] = [];
      let moveNumber = 1;

      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const isWhite = game.turn() === 'w';

        // Progress callback
        if (onProgress) {
          onProgress({
            currentMove: i + 1,
            totalMoves,
            percentage: Math.round(((i + 1) / totalMoves) * 100),
            currentPosition: game.fen(),
            message: `Analyzing ${isWhite ? 'White' : 'Black'} move ${moveNumber}...`,
          });
        }

        // Get position before move
        const fenBefore = game.fen();
        const evalBefore = await this.evaluatePosition(fenBefore);

        // Get best move for this position
        const bestMoveData = await this.getBestMove(fenBefore);

        // Make the move
        game.move(move.san);

        // Get position after move
        const fenAfter = game.fen();
        const evalAfter = await this.evaluatePosition(fenAfter);

        // Classify the move
        const classification = this.classifyMove(
          evalBefore,
          evalAfter,
          bestMoveData?.eval,
          move.san,
          bestMoveData?.notation,
          i < ANALYSIS_CONFIG.openingMoves
        );

        // Calculate centipawn loss
        const cpLoss = this.calculateCentipawnLoss(
          evalBefore,
          evalAfter,
          isWhite
        );

        // Check tactical elements
        const isTactical = move.captured !== undefined || 
                          move.promotion !== undefined ||
                          game.isCheck();
        
        const isSacrifice = move.captured !== undefined && 
                          this.isPieceSacrifice(move.piece, move.captured);

        // Create analyzed move
        const analyzedMove: AnalyzedMove = {
          moveNumber: Math.ceil((i + 1) / 2),
          notation: move.san,
          from: move.from,
          to: move.to,
          piece: move.piece,
          captured: move.captured,
          promotion: move.promotion,
          fen: fenAfter,
          isWhite,
          evalBefore,
          evalAfter,
          bestMove: bestMoveData,
          classification,
          centipawnLoss: cpLoss,
          isCapture: move.captured !== undefined,
          isCheck: game.isCheck(),
          isCheckmate: game.isCheckmate(),
          isTactical,
          isSacrifice,
          threatsBefore: [],
          threatsAfter: [],
        };

        analyzedMoves.push(analyzedMove);

        // Increment move number after black's move
        if (!isWhite) {
          moveNumber++;
        }
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(analyzedMoves, game);

      // Determine result
      const result = game.isCheckmate()
        ? game.turn() === 'w' ? '0-1' : '1-0'
        : game.isDraw()
        ? '1/2-1/2'
        : '*';

      const winner = result === '1-0' 
        ? 'white' 
        : result === '0-1' 
        ? 'black' 
        : result === '1/2-1/2'
        ? 'draw'
        : undefined;

      return {
        moves: analyzedMoves,
        summary,
        result,
        winner,
      };

    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Evaluate a position with Stockfish
   */
  private async evaluatePosition(fen: string): Promise<StockfishEvaluation> {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }

    return await this.engine.analyzePosition(fen, { depth: ANALYSIS_CONFIG.depth });
  }

  /**
   * Get best move for a position
   */
  private async getBestMove(fen: string): Promise<{ notation: string; eval: StockfishEvaluation } | undefined> {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }

    try {
      const bestMoveUCI = await this.engine.getBestMove(fen, ANALYSIS_CONFIG.depth);
      
      // Convert UCI move to SAN notation
      const tempGame = new Chess();
      tempGame.load(fen);
      
      // Parse UCI move (e.g., "e2e4" -> from: "e2", to: "e4")
      const from = bestMoveUCI.slice(0, 2);
      const to = bestMoveUCI.slice(2, 4);
      const promotion = bestMoveUCI.length > 4 ? bestMoveUCI[4] : undefined;
      
      // Make move and get SAN notation
      const moveResult = tempGame.move({ from, to, promotion });
      if (!moveResult) {
        return undefined;
      }
      
      const bestMoveSAN = moveResult.san;
      const evalAfterBest = await this.evaluatePosition(tempGame.fen());

      return {
        notation: bestMoveSAN,
        eval: evalAfterBest,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Classify a move based on evaluation changes
   */
  private classifyMove(
    evalBefore: StockfishEvaluation,
    evalAfter: StockfishEvaluation,
    bestMoveEval: StockfishEvaluation | undefined,
    playedMove: string,
    bestMove: string | undefined,
    isOpeningMove: boolean
  ): MoveClassification {
    // Opening book moves
    if (isOpeningMove) {
      return 'book';
    }

    // No best move available
    if (!bestMoveEval || !bestMove) {
      return 'good';
    }

    // Played the best move
    if (playedMove === bestMove) {
      return 'best';
    }

    // Calculate centipawn difference between played move and best move
    const cpDiff = Math.abs(
      this.getAbsoluteCentipawns(evalAfter) - 
      this.getAbsoluteCentipawns(bestMoveEval)
    );

    // Classify based on thresholds
    if (cpDiff <= ANALYSIS_CONFIG.thresholds.excellent) {
      return 'excellent';
    } else if (cpDiff <= ANALYSIS_CONFIG.thresholds.good) {
      return 'good';
    } else if (cpDiff <= ANALYSIS_CONFIG.thresholds.inaccuracy) {
      return 'inaccuracy';
    } else if (cpDiff <= ANALYSIS_CONFIG.thresholds.mistake) {
      return 'mistake';
    } else {
      return 'blunder';
    }
  }

  /**
   * Calculate centipawn loss for a move
   */
  private calculateCentipawnLoss(
    evalBefore: StockfishEvaluation,
    evalAfter: StockfishEvaluation,
    isWhite: boolean
  ): number {
    const cpBefore = this.getAbsoluteCentipawns(evalBefore);
    const cpAfter = this.getAbsoluteCentipawns(evalAfter);

    // Calculate loss from perspective of the player
    const loss = isWhite ? cpBefore - cpAfter : cpAfter - cpBefore;

    return Math.max(0, loss); // Only count losses, not gains
  }

  /**
   * Get absolute centipawn value (from white's perspective)
   */
  private getAbsoluteCentipawns(evaluation: StockfishEvaluation): number {
    if (evaluation.mate !== null && evaluation.mate !== undefined) {
      // Convert mate to large centipawn value
      return evaluation.mate > 0 ? 10000 - evaluation.mate * 100 : -10000 - evaluation.mate * 100;
    }
    return evaluation.score;
  }

  /**
   * Check if a capture is a sacrifice
   */
  private isPieceSacrifice(piece: string, captured: string): boolean {
    const pieceValues: Record<string, number> = {
      p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
    };

    const pieceValue = pieceValues[piece.toLowerCase()] || 0;
    const capturedValue = pieceValues[captured.toLowerCase()] || 0;

    return pieceValue > capturedValue;
  }

  /**
   * Calculate game summary statistics
   */
  private calculateSummary(moves: AnalyzedMove[], _game: Chess): GameAnalysis['summary'] {
    // Separate white and black moves
    const whiteMoves = moves.filter(m => m.isWhite);
    const blackMoves = moves.filter(m => !m.isWhite);

    // Calculate accuracy
    const whiteAccuracy = this.calculateAccuracy(whiteMoves);
    const blackAccuracy = this.calculateAccuracy(blackMoves);

    // Count classifications
    const classifications: Record<MoveClassification, number> = {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      forced: 0,
      book: 0,
    };

    moves.forEach(move => {
      classifications[move.classification]++;
    });

    // Identify critical moments
    const criticalMoments = this.identifyCriticalMoments(moves);

    // Detect game phases
    const gamePhases = this.detectGamePhases(moves);

    return {
      whiteAccuracy,
      blackAccuracy,
      totalMoves: moves.length,
      classifications,
      criticalMoments,
      gamePhases,
    };
  }

  /**
   * Calculate player accuracy percentage
   */
  private calculateAccuracy(moves: AnalyzedMove[]): number {
    if (moves.length === 0) return 0;

    // Skip book moves
    const analyzedMoves = moves.filter(m => m.classification !== 'book');
    if (analyzedMoves.length === 0) return 100;

    const totalCpLoss = analyzedMoves.reduce((sum, move) => sum + move.centipawnLoss, 0);
    const avgCpLoss = totalCpLoss / analyzedMoves.length;

    // Accuracy formula: 100 - (avg cp loss / 2)
    // Caps at 0% and 100%
    const accuracy = Math.max(0, Math.min(100, 100 - avgCpLoss / 2));

    return Math.round(accuracy * 10) / 10; // Round to 1 decimal
  }

  /**
   * Identify critical moments in the game
   */
  private identifyCriticalMoments(moves: AnalyzedMove[]): CriticalMoment[] {
    const moments: CriticalMoment[] = [];

    for (let i = 1; i < moves.length; i++) {
      const prevMove = moves[i - 1];
      const currentMove = moves[i];

      // Calculate evaluation swing
      const evalSwing = Math.abs(
        this.getAbsoluteCentipawns(currentMove.evalAfter) -
        this.getAbsoluteCentipawns(prevMove.evalAfter)
      );

      // Blunders are always critical
      if (currentMove.classification === 'blunder') {
        moments.push({
          moveNumber: currentMove.moveNumber,
          notation: currentMove.notation,
          type: 'critical_mistake',
          evalSwing,
          description: `${currentMove.isWhite ? 'White' : 'Black'} blunders with ${currentMove.notation}, losing ${(currentMove.centipawnLoss / 100).toFixed(2)} pawns`,
        });
      }

      // Large evaluation swings
      if (evalSwing >= ANALYSIS_CONFIG.criticalSwing) {
        moments.push({
          moveNumber: currentMove.moveNumber,
          notation: currentMove.notation,
          type: 'turning_point',
          evalSwing,
          description: `Game changes dramatically after ${currentMove.notation}`,
        });
      }

      // Missed wins (had winning position, now equal or worse)
      const prevEval = this.getAbsoluteCentipawns(prevMove.evalAfter);
      const currentEval = this.getAbsoluteCentipawns(currentMove.evalAfter);
      
      if (currentMove.isWhite && prevEval > 300 && currentEval < 50) {
        moments.push({
          moveNumber: currentMove.moveNumber,
          notation: currentMove.notation,
          type: 'missed_win',
          evalSwing,
          description: `White misses a winning advantage`,
        });
      } else if (!currentMove.isWhite && prevEval < -300 && currentEval > -50) {
        moments.push({
          moveNumber: currentMove.moveNumber,
          notation: currentMove.notation,
          type: 'missed_win',
          evalSwing,
          description: `Black misses a winning advantage`,
        });
      }
    }

    return moments;
  }

  /**
   * Detect game phases (opening, middlegame, endgame)
   */
  private detectGamePhases(moves: AnalyzedMove[]): GameAnalysis['summary']['gamePhases'] {
    let endgameStart = moves.length;

    // Find endgame start (when total pieces <= threshold)
    for (let i = 0; i < moves.length; i++) {
      const pieces = this.countPieces(moves[i].fen);
      if (pieces <= ANALYSIS_CONFIG.endgameThreshold) {
        endgameStart = i;
        break;
      }
    }

    const openingEnd = Math.min(ANALYSIS_CONFIG.openingMoves, moves.length);
    const middlegameEnd = endgameStart;

    return {
      opening: { start: 0, end: openingEnd },
      middlegame: { start: openingEnd, end: middlegameEnd },
      endgame: { start: middlegameEnd, end: moves.length },
    };
  }

  /**
   * Count total pieces on the board
   */
  private countPieces(fen: string): number {
    const position = fen.split(' ')[0];
    let count = 0;
    
    for (const char of position) {
      if (char.match(/[pnbrqkPNBRQK]/)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Extract move text from PGN, removing headers and comments
   */
  private extractMovesFromPGN(pgn: string): string {
    // Remove headers [...]
    let moveText = pgn.replace(/\[.*?\]\s*/g, '');
    
    // Remove comments {...}
    moveText = moveText.replace(/\{[^}]*\}/g, '');
    
    // Remove line comments
    moveText = moveText.replace(/;.*/g, '');
    
    // Clean up whitespace
    moveText = moveText.trim().replace(/\s+/g, ' ');
    
    return moveText;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

let analyzerInstance: ChessAnalyzer | null = null;

/**
 * Get or create analyzer singleton instance
 */
export async function getAnalyzer(): Promise<ChessAnalyzer> {
  if (!analyzerInstance) {
    analyzerInstance = new ChessAnalyzer();
    await analyzerInstance.initialize();
  }
  return analyzerInstance;
}

/**
 * Cleanup analyzer singleton
 */
export async function destroyAnalyzer(): Promise<void> {
  if (analyzerInstance) {
    await analyzerInstance.destroy();
    analyzerInstance = null;
  }
}
