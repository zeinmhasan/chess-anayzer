/**
 * Chess.com Games API Endpoint
 * 
 * GET /api/chess-com/games
 * Fetch games for a Chess.com user with filtering options
 * 
 * Query Parameters:
 * - username: Chess.com username (required)
 * - year: Year (optional, e.g., 2024)
 * - month: Month (optional, 01-12)
 * - limit: Number of games to return (optional, default: 10)
 * 
 * Examples:
 * - Get recent games: /api/chess-com/games?username=hikaru&limit=20
 * - Get specific month: /api/chess-com/games?username=hikaru&year=2024&month=01
 * 
 * curl Examples:
 * ```bash
 * # Get 10 most recent games
 * curl "http://localhost:3000/api/chess-com/games?username=hikaru&limit=10"
 * 
 * # Get all games from January 2024
 * curl "http://localhost:3000/api/chess-com/games?username=hikaru&year=2024&month=01"
 * 
 * # Get all available archives
 * curl "http://localhost:3000/api/chess-com/games?username=hikaru&archives=true"
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getGameArchives,
  getRecentGames,
  getMonthlyGames,
  ChessComAPIError,
} from '@/lib/chess-com-api';

// Rate limiting (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const archivesOnly = searchParams.get('archives') === 'true';

    // Validate username
    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username is required',
          message: 'Please provide a Chess.com username',
        },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientId = request.ip || 'unknown';
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Maximum ${RATE_LIMIT} requests per minute. Please try again later.`,
        },
        { status: 429 }
      );
    }

    // If archives only
    if (archivesOnly) {
      const archives = await getGameArchives(username);
      const duration = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        data: {
          username,
          archives: archives.archives,
          totalMonths: archives.archives.length,
        },
        meta: {
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If specific month requested
    if (year && month) {
      const gamesResponse = await getMonthlyGames(username, year, month);
      const duration = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        data: {
          username,
          year,
          month,
          games: gamesResponse.games,
          totalGames: gamesResponse.games.length,
        },
        meta: {
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get recent games
    const games = await getRecentGames(username, limit);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        username,
        games,
        totalGames: games.length,
        limit,
      },
      meta: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    if (error instanceof ChessComAPIError) {
      return NextResponse.json(
        {
          success: false,
          error: error.name,
          message: error.message,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching games',
      },
      { status: 500 }
    );
  }
}
