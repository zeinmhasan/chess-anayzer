/**
 * Chess.com API Proxy Endpoint
 * 
 * This endpoint acts as a proxy to Chess.com's public API.
 * It helps avoid CORS issues and allows adding server-side caching.
 * 
 * Routes:
 * - GET /api/chess-com?action=player&username=hikaru
 * - GET /api/chess-com?action=archives&username=hikaru
 * - GET /api/chess-com?action=recent&username=hikaru&limit=10
 * - GET /api/chess-com?action=monthly&username=hikaru&year=2024&month=01
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPlayerProfile,
  getGameArchives,
  getRecentGames,
  getMonthlyGames,
  parseChessComGames,
  ChessComAPIError,
} from "@/lib/chess-com-api";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const username = searchParams.get("username");

    // Validate required parameters
    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Handle different actions
    switch (action) {
      case "player": {
        const player = await getPlayerProfile(username);
        return NextResponse.json(player);
      }

      case "archives": {
        const archives = await getGameArchives(username);
        return NextResponse.json(archives);
      }

      case "recent": {
        const limitParam = searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 10;
        
        if (isNaN(limit) || limit < 1 || limit > 100) {
          return NextResponse.json(
            { error: "Limit must be between 1 and 100" },
            { status: 400 }
          );
        }

        const games = await getRecentGames(username, limit);
        const parsed = parseChessComGames(games);
        
        return NextResponse.json({
          username,
          count: parsed.length,
          games: parsed,
        });
      }

      case "monthly": {
        const year = searchParams.get("year");
        const month = searchParams.get("month");

        if (!year || !month) {
          return NextResponse.json(
            { error: "Year and month are required for monthly action" },
            { status: 400 }
          );
        }

        const gamesResponse = await getMonthlyGames(username, year, month);
        const parsed = parseChessComGames(gamesResponse.games);
        
        return NextResponse.json({
          username,
          year,
          month,
          count: parsed.length,
          games: parsed,
        });
      }

      default:
        return NextResponse.json(
          {
            error: "Invalid action. Valid actions: player, archives, recent, monthly",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    // Handle ChessComAPIError
    if (error instanceof ChessComAPIError) {
      return NextResponse.json(
        {
          error: error.message,
          statusCode: error.statusCode,
        },
        { status: error.statusCode || 500 }
      );
    }

    // Handle unexpected errors
    console.error("Chess.com API proxy error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
