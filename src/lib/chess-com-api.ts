/**
 * Chess.com Public API Client
 * 
 * This module provides functions to interact with Chess.com's public API.
 * No authentication required for public API endpoints.
 * 
 * API Documentation: https://www.chess.com/news/view/published-data-api
 * Base URL: https://api.chess.com/pub
 * 
 * Rate Limiting: Chess.com requests respectful usage of their API.
 * Recommended: Add delays between requests if fetching large amounts of data.
 */

import axios, { AxiosError } from "axios";
import type {
  ChessComArchive,
  ChessComGamesResponse,
  ChessComPlayer,
  ChessComGame,
  ParsedGame,
} from "@/types/chess";

const BASE_URL = "https://api.chess.com/pub";
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Custom error class for Chess.com API errors
 */
export class ChessComAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "ChessComAPIError";
  }
}

/**
 * Validate Chess.com username format
 * Usernames: 3-25 characters, alphanumeric, underscores, hyphens
 * 
 * @param username - Chess.com username to validate
 * @returns true if valid
 */
export function validateUsername(username: string): boolean {
  if (!username || typeof username !== "string") return false;
  
  // Chess.com usernames: 3-25 chars, alphanumeric + underscore + hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]{3,25}$/;
  return usernameRegex.test(username);
}

/**
 * Fetch player profile from Chess.com
 * 
 * @param username - Chess.com username
 * @returns Player profile data
 * @throws {ChessComAPIError} If player not found or API error
 * 
 * @example
 * ```typescript
 * const player = await getPlayerProfile("hikaru");
 * console.log(player.username, player.title);
 * ```
 */
export async function getPlayerProfile(
  username: string
): Promise<ChessComPlayer> {
  if (!validateUsername(username)) {
    throw new ChessComAPIError(
      "Invalid username format. Must be 3-25 characters, alphanumeric with underscores or hyphens."
    );
  }

  try {
    const response = await axios.get<ChessComPlayer>(
      `${BASE_URL}/player/${username.toLowerCase()}`,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "ChessAnalysisWebsite/1.0",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new ChessComAPIError(
          `Player "${username}" not found on Chess.com`,
          404,
          error
        );
      }
      throw new ChessComAPIError(
        `Failed to fetch player profile: ${axiosError.message}`,
        axiosError.response?.status,
        error
      );
    }
    throw new ChessComAPIError(
      "An unexpected error occurred while fetching player profile",
      undefined,
      error
    );
  }
}

/**
 * Get list of monthly game archives for a player
 * Returns array of URLs for each month that has games
 * 
 * @param username - Chess.com username
 * @returns Object containing array of archive URLs
 * @throws {ChessComAPIError} If player not found or API error
 * 
 * @example
 * ```typescript
 * const archives = await getGameArchives("hikaru");
 * console.log(archives.archives); // ["https://api.chess.com/pub/player/hikaru/games/2024/01", ...]
 * ```
 */
export async function getGameArchives(
  username: string
): Promise<ChessComArchive> {
  if (!validateUsername(username)) {
    throw new ChessComAPIError("Invalid username format");
  }

  try {
    const response = await axios.get<ChessComArchive>(
      `${BASE_URL}/player/${username.toLowerCase()}/games/archives`,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "ChessAnalysisWebsite/1.0",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new ChessComAPIError(
          `No game archives found for player "${username}"`,
          404,
          error
        );
      }
      throw new ChessComAPIError(
        `Failed to fetch game archives: ${axiosError.message}`,
        axiosError.response?.status,
        error
      );
    }
    throw new ChessComAPIError(
      "An unexpected error occurred while fetching game archives",
      undefined,
      error
    );
  }
}

/**
 * Fetch games from a specific month
 * 
 * @param username - Chess.com username
 * @param year - Year (YYYY)
 * @param month - Month (MM, zero-padded)
 * @returns Object containing array of games
 * @throws {ChessComAPIError} If games not found or API error
 * 
 * @example
 * ```typescript
 * const games = await getMonthlyGames("hikaru", "2024", "01");
 * console.log(games.games.length);
 * ```
 */
export async function getMonthlyGames(
  username: string,
  year: string,
  month: string
): Promise<ChessComGamesResponse> {
  if (!validateUsername(username)) {
    throw new ChessComAPIError("Invalid username format");
  }

  // Validate year and month format
  if (!/^\d{4}$/.test(year)) {
    throw new ChessComAPIError("Invalid year format. Must be YYYY (e.g., 2024)");
  }
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    throw new ChessComAPIError(
      "Invalid month format. Must be MM (01-12, zero-padded)"
    );
  }

  try {
    const response = await axios.get<ChessComGamesResponse>(
      `${BASE_URL}/player/${username.toLowerCase()}/games/${year}/${month}`,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "ChessAnalysisWebsite/1.0",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new ChessComAPIError(
          `No games found for ${username} in ${year}/${month}`,
          404,
          error
        );
      }
      throw new ChessComAPIError(
        `Failed to fetch monthly games: ${axiosError.message}`,
        axiosError.response?.status,
        error
      );
    }
    throw new ChessComAPIError(
      "An unexpected error occurred while fetching monthly games",
      undefined,
      error
    );
  }
}

/**
 * Fetch games directly from an archive URL
 * Helper function when you already have the archive URL
 * 
 * @param archiveUrl - Full archive URL from getGameArchives
 * @returns Object containing array of games
 * @throws {ChessComAPIError} If fetch fails
 * 
 * @example
 * ```typescript
 * const url = "https://api.chess.com/pub/player/hikaru/games/2024/01";
 * const games = await getGamesFromArchiveUrl(url);
 * ```
 */
export async function getGamesFromArchiveUrl(
  archiveUrl: string
): Promise<ChessComGamesResponse> {
  try {
    const response = await axios.get<ChessComGamesResponse>(archiveUrl, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        "User-Agent": "ChessAnalysisWebsite/1.0",
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new ChessComAPIError(
        `Failed to fetch games from archive URL: ${axiosError.message}`,
        axiosError.response?.status,
        error
      );
    }
    throw new ChessComAPIError(
      "An unexpected error occurred while fetching games from archive URL",
      undefined,
      error
    );
  }
}

/**
 * Fetch recent games for a player
 * Gets games from the most recent available month
 * 
 * @param username - Chess.com username
 * @param limit - Maximum number of games to return (default: 10)
 * @returns Array of games
 * @throws {ChessComAPIError} If player has no games or API error
 * 
 * @example
 * ```typescript
 * const recentGames = await getRecentGames("hikaru", 20);
 * recentGames.forEach(game => console.log(game.url));
 * ```
 */
export async function getRecentGames(
  username: string,
  limit: number = 10
): Promise<ChessComGame[]> {
  const archives = await getGameArchives(username);

  if (!archives.archives || archives.archives.length === 0) {
    throw new ChessComAPIError(`No games found for player "${username}"`);
  }

  // Get the most recent archive (last in array)
  const recentArchiveUrl = archives.archives[archives.archives.length - 1];
  const gamesResponse = await getGamesFromArchiveUrl(recentArchiveUrl);

  // Return most recent games (games are already sorted by end_time)
  return gamesResponse.games.slice(-limit).reverse();
}

/**
 * Fetch all games for a player
 * WARNING: This can take a long time for players with many games
 * Consider using getRecentGames or specific month fetching instead
 * 
 * @param username - Chess.com username
 * @param onProgress - Optional callback to track progress
 * @returns Array of all games
 * @throws {ChessComAPIError} If player has no games or API error
 * 
 * @example
 * ```typescript
 * const allGames = await getAllGames("hikaru", (current, total) => {
 *   console.log(`Fetching: ${current}/${total} months`);
 * });
 * ```
 */
export async function getAllGames(
  username: string,
  onProgress?: (current: number, total: number) => void
): Promise<ChessComGame[]> {
  const archives = await getGameArchives(username);

  if (!archives.archives || archives.archives.length === 0) {
    throw new ChessComAPIError(`No games found for player "${username}"`);
  }

  const allGames: ChessComGame[] = [];
  const totalArchives = archives.archives.length;

  for (let i = 0; i < totalArchives; i++) {
    const archiveUrl = archives.archives[i];
    
    try {
      const gamesResponse = await getGamesFromArchiveUrl(archiveUrl);
      allGames.push(...gamesResponse.games);
      
      if (onProgress) {
        onProgress(i + 1, totalArchives);
      }

      // Add small delay to be respectful to Chess.com API
      if (i < totalArchives - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn(`Failed to fetch archive ${archiveUrl}:`, error);
      // Continue with other archives
    }
  }

  return allGames;
}

/**
 * Parse Chess.com game data into a cleaner format
 * Extracts relevant information and formats it consistently
 * 
 * @param game - Raw Chess.com game object
 * @returns Parsed game object
 * 
 * @example
 * ```typescript
 * const rawGame = await getRecentGames("hikaru", 1);
 * const parsed = parseChessComGame(rawGame[0]);
 * console.log(parsed.white, "vs", parsed.black);
 * ```
 */
export function parseChessComGame(game: ChessComGame): ParsedGame {
  // Generate a unique ID from the game URL
  const urlParts = game.url.split("/");
  const gameId = urlParts[urlParts.length - 1] || game.uuid;

  // Format date from timestamp
  const date = new Date(game.end_time * 1000).toISOString().split("T")[0];

  return {
    id: gameId,
    white: game.white.username,
    black: game.black.username,
    whiteRating: game.white.rating,
    blackRating: game.black.rating,
    result: game.white.result,
    timeControl: game.time_control,
    timeClass: game.time_class,
    date,
    pgn: game.pgn,
    url: game.url,
    endTime: game.end_time,
    rated: game.rated,
  };
}

/**
 * Parse multiple Chess.com games
 * 
 * @param games - Array of raw Chess.com game objects
 * @returns Array of parsed game objects
 */
export function parseChessComGames(games: ChessComGame[]): ParsedGame[] {
  return games.map(parseChessComGame);
}

/**
 * Extract PGN string from Chess.com game
 * Chess.com includes metadata in PGN, this extracts just the moves
 * 
 * @param pgn - Full PGN string from Chess.com
 * @returns Object with headers and moves separated
 */
export function extractPGNData(pgn: string): {
  headers: Record<string, string>;
  moves: string;
} {
  const lines = pgn.split("\n");
  const headers: Record<string, string> = {};
  const moveLines: string[] = [];

  let isMovesSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Parse header lines (e.g., [Event "Live Chess"])
    if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
      const match = trimmedLine.match(/\[([^\s]+)\s+"([^"]+)"\]/);
      if (match) {
        headers[match[1]] = match[2];
      }
    }
    // Empty line separates headers from moves
    else if (trimmedLine === "" && Object.keys(headers).length > 0) {
      isMovesSection = true;
    }
    // Collect move lines
    else if (isMovesSection && trimmedLine !== "") {
      moveLines.push(trimmedLine);
    }
  }

  return {
    headers,
    moves: moveLines.join(" ").trim(),
  };
}

/**
 * Filter games by time class
 * 
 * @param games - Array of games
 * @param timeClass - Time class to filter by (bullet, blitz, rapid, daily)
 * @returns Filtered games
 */
export function filterGamesByTimeClass(
  games: ChessComGame[],
  timeClass: "bullet" | "blitz" | "rapid" | "daily"
): ChessComGame[] {
  return games.filter((game) => game.time_class === timeClass);
}

/**
 * Filter games where user played as white or black
 * 
 * @param games - Array of games
 * @param username - Username to check
 * @param color - Color to filter by
 * @returns Filtered games
 */
export function filterGamesByColor(
  games: ChessComGame[],
  username: string,
  color: "white" | "black"
): ChessComGame[] {
  const lowerUsername = username.toLowerCase();
  return games.filter(
    (game) => game[color].username.toLowerCase() === lowerUsername
  );
}
