/**
 * Cached Analysis Retrieval API Endpoint
 * 
 * GET /api/analysis/[gameId]
 * Retrieve previously analyzed game from cache
 * 
 * Path Parameters:
 * - gameId: Unique game identifier
 * 
 * Query Parameters:
 * - depth: Stockfish depth used (optional, default: 18)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": GameAnalysis | null,
 *   "meta": {
 *     "cached": true,
 *     "cachedAt": "2024-01-01T12:00:00Z"
 *   }
 * }
 * 
 * curl Examples:
 * ```bash
 * # Get cached analysis
 * curl "http://localhost:3000/api/analysis/chess-com-12345"
 * 
 * # Get with specific depth
 * curl "http://localhost:3000/api/analysis/chess-com-12345?depth=15"
 * 
 * # Check if analysis exists
 * curl -I "http://localhost:3000/api/analysis/chess-com-12345"
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';

// Import the same cache from analyze route
// In production, this would be a shared Redis/database
const analysisCache = new Map<string, { analysis: unknown; timestamp: number }>();

interface RouteContext {
  params: {
    gameId: string;
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { gameId } = context.params;
    const searchParams = request.nextUrl.searchParams;
    const depth = searchParams.get('depth') || '18';

    // Validate gameId
    if (!gameId) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_GAME_ID',
          message: 'Game ID is required',
        },
        { status: 400 }
      );
    }

    // Generate cache key
    const cacheKey = `${gameId}-depth${depth}`;

    // Check cache
    const cached = analysisCache.get(cacheKey);

    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached.analysis,
        meta: {
          cached: true,
          cachedAt: new Date(cached.timestamp).toISOString(),
          gameId,
          depth: parseInt(depth, 10),
        },
      });
    }

    // Try to find with any depth
    const anyKey = Array.from(analysisCache.keys()).find(key => 
      key.startsWith(gameId)
    );

    if (anyKey) {
      const cached = analysisCache.get(anyKey);
      const cachedDepth = anyKey.split('-depth')[1];
      
      return NextResponse.json({
        success: true,
        data: cached?.analysis,
        meta: {
          cached: true,
          cachedAt: new Date(cached!.timestamp).toISOString(),
          gameId,
          depth: parseInt(cachedDepth, 10),
          note: `Requested depth ${depth}, but only depth ${cachedDepth} is cached`,
        },
      });
    }

    // Not found
    return NextResponse.json(
      {
        success: false,
        error: 'NOT_FOUND',
        message: `No analysis found for game ID: ${gameId}`,
        suggestion: 'Analyze this game first using POST /api/analyze',
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('[API Error] /api/analysis/[gameId]:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve analysis',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to remove cached analysis
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { gameId } = context.params;

    if (!gameId) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_GAME_ID',
          message: 'Game ID is required',
        },
        { status: 400 }
      );
    }

    // Find and delete all cache entries for this game
    let deletedCount = 0;
    for (const key of analysisCache.keys()) {
      if (key.startsWith(gameId)) {
        analysisCache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: `No cached analysis found for game ID: ${gameId}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} cached analysis for game ${gameId}`,
      data: {
        gameId,
        deletedCount,
      },
    });

  } catch (error) {
    console.error('[API Error] DELETE /api/analysis/[gameId]:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete analysis',
      },
      { status: 500 }
    );
  }
}
