/**
 * Stockfish Chess Engine Integration
 * 
 * This module provides a wrapper around the Stockfish chess engine.
 * It handles UCI protocol communication, position analysis, and move evaluation.
 * 
 * Features:
 * - Asynchronous analysis with timeout support
 * - Multiple concurrent analysis support
 * - Position evaluation (centipawns)
 * - Best move calculation
 * - Mate detection
 * 
 * Usage:
 * ```typescript
 * const engine = new StockfishEngine();
 * await engine.init();
 * const result = await engine.analyzePosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
 * console.log(result.score, result.bestMove);
 * ```
 */

import type {
  StockfishEvaluation,
  StockfishAnalysisOptions,
  StockfishState,
} from "@/types/chess";

/**
 * Default analysis options
 */
const DEFAULT_OPTIONS: Required<StockfishAnalysisOptions> = {
  depth: 12,
  maxTime: 10000,
  multiPv: 1,
  skillLevel: 20,
};

/**
 * Custom error class for Stockfish-related errors
 */
export class StockfishError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "StockfishError";
  }
}

/**
 * Stockfish Engine Class
 * Manages a single Stockfish worker instance with UCI protocol communication
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, (line: string) => void> = new Map();
  private state: StockfishState = {
    isReady: false,
    isAnalyzing: false,
    error: null,
  };
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the Stockfish engine
   * Must be called before any analysis
   * 
   * @throws {StockfishError} If initialization fails
   */
  async init(): Promise<void> {
    // Return existing init promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.state.isReady) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Check if we're in browser environment
        if (typeof window === "undefined") {
          throw new StockfishError(
            "Stockfish can only run in browser environment",
            "ENV_ERROR"
          );
        }

        // Create Stockfish worker
        // Try different paths for stockfish.js
        const workerPath = "/stockfish.js";
        
        try {
          this.worker = new Worker(workerPath);
        } catch (workerError) {
          // If Worker creation fails, provide helpful error
          const errorMsg = workerError instanceof Error ? workerError.message : "Unknown error";
          throw new StockfishError(
            `Failed to create Stockfish worker. Make sure stockfish.js exists in public folder.\nError: ${errorMsg}`,
            "WORKER_CREATE_ERROR",
            workerError
          );
        }

        // Set up message handler
        this.worker.onmessage = (event) => {
          const line = event.data;
          this.handleMessage(line);
        };

        // Set up error handler
        this.worker.onerror = (error) => {
          const errorMsg = error.message || "Unknown worker error";
          this.state.error = errorMsg;
          
          // Provide more helpful error message
          const helpMsg = `Stockfish worker error: ${errorMsg}\n\n` +
            `Troubleshooting:\n` +
            `1. Verify stockfish.js exists in public folder\n` +
            `2. Check browser console for CORS errors\n` +
            `3. Try restarting dev server\n` +
            `4. Check if file is corrupted (should be ~1.5MB)`;
          
          reject(
            new StockfishError(helpMsg, "WORKER_ERROR", error)
          );
        };

        // Wait for UCI ready confirmation
        let uciOkReceived = false;
        let readyOkReceived = false;

        const checkReady = () => {
          if (uciOkReceived && readyOkReceived) {
            this.state.isReady = true;
            this.state.error = null;
            resolve();
          }
        };

        this.messageHandlers.set("init-uciok", (line) => {
          if (line === "uciok") {
            uciOkReceived = true;
            checkReady();
          }
        });

        this.messageHandlers.set("init-readyok", (line) => {
          if (line === "readyok") {
            readyOkReceived = true;
            checkReady();
          }
        });

        // Send UCI initialization commands
        this.sendCommand("uci");
        this.sendCommand("isready");

        // Timeout for initialization
        setTimeout(() => {
          if (!this.state.isReady) {
            this.initPromise = null; // Reset so retry works
            this.cleanup();
            reject(
              new StockfishError(
                "Stockfish initialization timeout",
                "INIT_TIMEOUT"
              )
            );
          }
        }, 15000);
      } catch (error) {
        this.initPromise = null; // Reset so retry works
        this.state.error =
          error instanceof Error ? error.message : "Unknown error";
        reject(
          new StockfishError(
            "Failed to initialize Stockfish",
            "INIT_ERROR",
            error
          )
        );
      }
    });

    return this.initPromise;
  }

  /**
   * Send a command to Stockfish
   */
  private sendCommand(command: string): void {
    if (!this.worker) {
      throw new StockfishError("Worker not initialized", "WORKER_NOT_INIT");
    }
    this.worker.postMessage(command);
  }

  /**
   * Handle incoming messages from Stockfish
   */
  private handleMessage(line: string): void {
    // Call all registered message handlers
    this.messageHandlers.forEach((handler) => {
      try {
        handler(line);
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  /**
   * Parse Stockfish info output
   * Extracts evaluation, depth, nodes, time, and best move from UCI info lines
   */
  private parseInfoLine(line: string): Partial<StockfishEvaluation> {
    const result: Partial<StockfishEvaluation> = {};

    // Parse depth
    const depthMatch = line.match(/depth (\d+)/);
    if (depthMatch) {
      result.depth = parseInt(depthMatch[1], 10);
    }

    // Parse score (centipawns or mate)
    const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
    if (scoreMatch) {
      const [, type, value] = scoreMatch;
      if (type === "cp") {
        result.score = parseInt(value, 10);
      } else if (type === "mate") {
        result.mate = parseInt(value, 10);
        // Convert mate to very high score for consistency
        const mateValue = parseInt(value, 10);
        result.score = mateValue > 0 ? 100000 - mateValue : -100000 - mateValue;
      }
    }

    // Parse nodes
    const nodesMatch = line.match(/nodes (\d+)/);
    if (nodesMatch) {
      result.nodes = parseInt(nodesMatch[1], 10);
    }

    // Parse time
    const timeMatch = line.match(/time (\d+)/);
    if (timeMatch) {
      result.time = parseInt(timeMatch[1], 10);
    }

    // Parse principal variation (best line)
    const pvMatch = line.match(/pv (.+)$/);
    if (pvMatch) {
      result.pv = pvMatch[1].split(" ");
    }

    return result;
  }

  /**
   * Analyze a chess position
   * 
   * @param fen - Position in FEN notation
   * @param options - Analysis options
   * @returns Evaluation result
   * @throws {StockfishError} If analysis fails
   * 
   * @example
   * ```typescript
   * const result = await engine.analyzePosition(
   *   "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
   *   { depth: 20 }
   * );
   * console.log(result.score); // Evaluation in centipawns
   * console.log(result.bestMove); // Best move in UCI notation
   * ```
   */
  async analyzePosition(
    fen: string,
    options: StockfishAnalysisOptions = {}
  ): Promise<StockfishEvaluation> {
    if (!this.state.isReady) {
      await this.init();
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.state.isAnalyzing = true;

    return new Promise((resolve, reject) => {
      const handlerId = `analyze-${Date.now()}-${Math.random()}`;
      let bestResult: Partial<StockfishEvaluation> = {};
      let bestMove = "";

      // Clean up function
      const cleanup = (timeoutId: NodeJS.Timeout) => {
        this.messageHandlers.delete(handlerId);
        clearTimeout(timeoutId);
        this.state.isAnalyzing = false;
      };

      // Set up timeout
      const timeoutId = setTimeout(() => {
        cleanup(timeoutId);
        this.sendCommand("stop");
        
        if (bestMove) {
          // Return best result found so far
          resolve({
            score: bestResult.score || 0,
            bestMove,
            depth: bestResult.depth || 0,
            time: opts.maxTime,
            nodes: bestResult.nodes || 0,
            pv: bestResult.pv,
            mate: bestResult.mate,
          });
        } else {
          reject(
            new StockfishError(
              `Analysis timeout after ${opts.maxTime}ms`,
              "ANALYSIS_TIMEOUT"
            )
          );
        }
      }, opts.maxTime);

      // Set up message handler for this analysis
      this.messageHandlers.set(handlerId, (line) => {
        // Parse info lines
        if (line.startsWith("info")) {
          const info = this.parseInfoLine(line);
          
          // Update best result if this line has better depth
          if (info.depth && (!bestResult.depth || info.depth >= bestResult.depth)) {
            bestResult = { ...bestResult, ...info };
          }
        }

        // Parse bestmove line (analysis complete)
        if (line.startsWith("bestmove")) {
          const match = line.match(/bestmove (\S+)/);
          if (match) {
            bestMove = match[1];
            
            cleanup(timeoutId);
            
            // Return final result
            resolve({
              score: bestResult.score || 0,
              bestMove,
              depth: bestResult.depth || opts.depth,
              time: bestResult.time || 0,
              nodes: bestResult.nodes || 0,
              pv: bestResult.pv,
              mate: bestResult.mate,
            });
          }
        }
      });

      // Send analysis commands
      try {
        this.sendCommand("ucinewgame");
        this.sendCommand(`position fen ${fen}`);
        
        // Set options
        this.sendCommand(`setoption name MultiPV value ${opts.multiPv}`);
        this.sendCommand(`setoption name Skill Level value ${opts.skillLevel}`);
        
        // Start analysis
        this.sendCommand(`go depth ${opts.depth}`);
      } catch (error) {
        cleanup(timeoutId);
        reject(
          new StockfishError(
            "Failed to start analysis",
            "ANALYSIS_ERROR",
            error
          )
        );
      }
    });
  }

  /**
   * Get the best move for a position without full evaluation
   * Faster than analyzePosition but returns less information
   * 
   * @param fen - Position in FEN notation
   * @param depth - Search depth (default: 15)
   * @returns Best move in UCI notation
   * 
   * @example
   * ```typescript
   * const bestMove = await engine.getBestMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
   * console.log(bestMove); // e.g., "e2e4"
   * ```
   */
  async getBestMove(fen: string, depth: number = 15): Promise<string> {
    const result = await this.analyzePosition(fen, { depth, maxTime: 5000 });
    return result.bestMove;
  }

  /**
   * Get current engine state
   */
  getState(): StockfishState {
    return { ...this.state };
  }

  /**
   * Check if engine is ready
   */
  isReady(): boolean {
    return this.state.isReady;
  }

  /**
   * Check if engine is currently analyzing
   */
  isAnalyzing(): boolean {
    return this.state.isAnalyzing;
  }

  /**
   * Cleanup worker resources without full state reset
   * Used during failed initialization
   */
  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.messageHandlers.clear();
  }

  /**
   * Terminate the Stockfish worker
   * Call this when done to free up resources
   */
  terminate(): void {
    this.cleanup();
    this.state = {
      isReady: false,
      isAnalyzing: false,
      error: null,
    };
    this.initPromise = null;
  }
}

// Singleton instance for convenience
let globalEngine: StockfishEngine | null = null;

/**
 * Get the global Stockfish engine instance
 * Creates one if it doesn't exist
 * 
 * @returns Global engine instance
 */
export async function getStockfishEngine(): Promise<StockfishEngine> {
  if (!globalEngine) {
    globalEngine = new StockfishEngine();
    await globalEngine.init();
  }
  return globalEngine;
}

/**
 * Analyze a position using the global engine instance
 * Convenience function for quick analysis
 * 
 * @param fen - Position in FEN notation
 * @param depth - Search depth (default: 18)
 * @returns Evaluation result
 */
export async function analyzePosition(
  fen: string,
  depth: number = 18
): Promise<StockfishEvaluation> {
  const engine = await getStockfishEngine();
  return engine.analyzePosition(fen, { depth });
}

/**
 * Get best move using the global engine instance
 * 
 * @param fen - Position in FEN notation  
 * @param depth - Search depth (default: 15)
 * @returns Best move in UCI notation
 */
export async function getBestMove(
  fen: string,
  depth: number = 15
): Promise<string> {
  const engine = await getStockfishEngine();
  return engine.getBestMove(fen, depth);
}

/**
 * Terminate the global engine instance
 * Call this when completely done with Stockfish to free resources
 */
export function terminateGlobalEngine(): void {
  if (globalEngine) {
    globalEngine.terminate();
    globalEngine = null;
  }
}
