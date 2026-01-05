/**
 * Stockfish Chess Engine - Node.js Server Implementation
 * 
 * NOTE: This module is not fully implemented.
 * Server-side Stockfish requires native binary or external service.
 * 
 * For production use, consider:
 * 1. Client-side analysis (recommended) - use /analyze page
 * 2. External analysis service/API
 * 3. Queue system with dedicated worker servers
 */

import type { StockfishEvaluation, StockfishAnalysisOptions } from '@/types/chess';

/**
 * Placeholder for server-side Stockfish engine
 * Not implemented - use client-side analysis instead
 */
export class StockfishServerEngine {
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    throw new Error('Server-side Stockfish not implemented. Use client-side analysis at /analyze instead.');
  }

  async analyzePosition(
    _fen: string,
    _options: StockfishAnalysisOptions = {}
  ): Promise<StockfishEvaluation> {
    throw new Error('Not implemented');
  }

  async getBestMove(
    _fen: string,
    _depth: number = 18,
    _timeout: number = 30000
  ): Promise<string> {
    throw new Error('Not implemented');
  }

  stop(): void {
    // Not implemented
  }

  async terminate(): Promise<void> {
    this.isInitialized = false;
  }
}

export async function getServerEngine(): Promise<StockfishServerEngine> {
  throw new Error('Server-side analysis not implemented. Use client-side analysis at /analyze instead.');
}

export async function destroyServerEngine(): Promise<void> {
  // Not implemented
}
