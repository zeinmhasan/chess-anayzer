/**
 * Chess Game Analysis API Endpoint
 * 
 * POST /api/analyze
 * Analyze a chess game using Stockfish engine
 * 
 * Request Body:
 * {
 *   "pgn": "1. e4 e5 2. Nf3...",  // PGN string (required)
 *   "depth": 18,                   // Stockfish depth (optional, default: 18)
 *   "gameId": "unique-id"          // Optional ID for caching
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": GameAnalysis,
 *   "meta": { "duration": "45s" }
 * }
 * 
 * curl Example:
 * ```bash
 * curl -X POST http://localhost:3000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6",
 *     "depth": 15
 *   }'
 * 
 * # With game ID for caching
 * curl -X POST http://localhost:3000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "pgn": "1. e4 e5 2. Nf3 Nc6...",
 *     "gameId": "chess-com-12345",
 *     "depth": 18
 *   }'
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import type { GameAnalysis } from '@/types/chess';

// NOTE: Server-side Stockfish analysis is complex in Node.js environment
// For production, consider:
// 1. Client-side analysis (browser WASM) - Best for most use cases
// 2. External worker service with actual Stockfish binary
// 3. Queue system with dedicated analysis servers
//
// This endpoint currently returns a mock response for demonstration.
// Real implementation would require stockfish binary or external service.

// Simple in-memory cache for analysis results
const analysisCache = new Map<string, { analysis: GameAnalysis; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Analysis queue to prevent concurrent heavy operations
const analysisQueue = new Set<string>();
const MAX_CONCURRENT_ANALYSIS = 3;

interface AnalyzeRequest {
  pgn: string;
  depth?: number;
  gameId?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    let body: AnalyzeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
        { status: 400 }
      );
    }

    // Validate PGN
    if (!body.pgn || typeof body.pgn !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_PGN',
          message: 'PGN is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Validate depth
    const depth = body.depth || 18;
    if (depth < 5 || depth > 25) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_DEPTH',
          message: 'Depth must be between 5 and 25',
        },
        { status: 400 }
      );
    }

    // Generate cache key
    const gameId = body.gameId || `pgn-${hashString(body.pgn)}`;
    const cacheKey = `${gameId}-depth${depth}`;

    // Check cache
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[API] Cache HIT for ${cacheKey}`);
      return NextResponse.json({
        success: true,
        data: cached.analysis,
        meta: {
          cached: true,
          cachedAt: new Date(cached.timestamp).toISOString(),
          duration: `${Date.now() - startTime}ms`,
        },
      });
    }

    // Check queue limits
    if (analysisQueue.size >= MAX_CONCURRENT_ANALYSIS) {
      return NextResponse.json(
        {
          success: false,
          error: 'QUEUE_FULL',
          message: `Analysis queue is full (${analysisQueue.size}/${MAX_CONCURRENT_ANALYSIS}). Please try again in a moment.`,
        },
        { status: 503 }
      );
    }

    // Check if already analyzing this game
    if (analysisQueue.has(cacheKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ALREADY_ANALYZING',
          message: 'This game is already being analyzed. Please wait.',
        },
        { status: 409 }
      );
    }

    // Add to queue
    analysisQueue.add(cacheKey);

    try {
      console.log(`[API] Server-side analysis not fully implemented`);
      console.log(`[API] Please use client-side analysis for better performance`);
      
      // Return suggestion to use client-side
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_IMPLEMENTED',
          message: 'Server-side Stockfish analysis is not available. Please use client-side analysis for better performance and scalability.',
          suggestion: {
            alternative: 'client-side',
            reason: 'Stockfish WASM works best in browser environment',
            endpoint: '/analyze' // Client-side analysis page
          }
        },
        { status: 501 } // Not Implemented
      );

    } catch (error) {
      console.error('[API Error] Analysis route:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    } finally {
      // Remove from queue
      analysisQueue.delete(cacheKey);
    }
  } catch (error) {
    console.error('[API Error] /api/analyze:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'ANALYSIS_FAILED',
        message: `Analysis failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Simple string hash function for generating cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * GET endpoint to check analysis status or list cached analyses
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const gameId = searchParams.get('gameId');

  if (gameId) {
    // Check if specific game is in cache
    const cacheKey = Array.from(analysisCache.keys()).find(key => key.startsWith(gameId));
    
    if (cacheKey) {
      const cached = analysisCache.get(cacheKey);
      return NextResponse.json({
        success: true,
        data: {
          gameId,
          cached: true,
          analysis: cached?.analysis,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId,
        cached: false,
      },
    });
  }

  // Return queue status
  return NextResponse.json({
    success: true,
    data: {
      queueSize: analysisQueue.size,
      maxConcurrent: MAX_CONCURRENT_ANALYSIS,
      cacheSize: analysisCache.size,
      cacheEntries: Array.from(analysisCache.keys()),
    },
  });
}
