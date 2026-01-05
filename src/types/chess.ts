// Chess-related TypeScript interfaces

export type MoveClassification =
  | "brilliant"
  | "great"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface ChessGame {
  id: string;
  white: string;
  black: string;
  result: string;
  timeControl: string;
  date: string;
  pgn: string;
  url: string;
}

export interface AnalyzedMove {
  moveNumber: number;
  san: string;
  fen: string;
  evaluation: number;
  bestMove: string;
  classification: MoveClassification;
  centipawnLoss: number;
  isWhite: boolean;
}

export interface CriticalMoment {
  moveNumber: number;
  fen: string;
  description: string;
  evaluationChange: number;
}

export interface Opening {
  name: string;
  eco: string;
}

export interface MoveStatistics {
  brilliant: number;
  great: number;
  good: number;
  book: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface GameAnalysis {
  gameId: string;
  moves: AnalyzedMove[];
  whiteAccuracy: number;
  blackAccuracy: number;
  opening: Opening;
  statistics: {
    white: MoveStatistics;
    black: MoveStatistics;
  };
  criticalMoments: CriticalMoment[];
  evaluations: number[];
}

export interface PlayerStats {
  username: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  accuracies?: {
    white: number;
    black: number;
  };
  tcn?: string;
  uuid: string;
  initial_setup?: string;
  fen?: string;
  time_class: string;
  rules: string;
  white: {
    rating: number;
    result: string;
    username: string;
    "@id": string;
  };
  black: {
    rating: number;
    result: string;
    username: string;
    "@id": string;
  };
}

export interface ChessComArchive {
  archives: string[];
}

export interface ChessComGamesResponse {
  games: ChessComGame[];
}

export interface ChessComPlayer {
  "@id": string;
  url: string;
  username: string;
  player_id: number;
  title?: string;
  status: string;
  name?: string;
  avatar?: string;
  location?: string;
  country: string;
  joined: number;
  last_online: number;
  followers: number;
  is_streamer: boolean;
  verified: boolean;
}

export interface ChessComError {
  code: number;
  message: string;
}

export interface ParsedGame {
  id: string;
  white: string;
  black: string;
  whiteRating: number;
  blackRating: number;
  result: string;
  timeControl: string;
  timeClass: string;
  date: string;
  pgn: string;
  url: string;
  endTime: number;
  rated: boolean;
}

// Stockfish Analysis Types

/**
 * Stockfish evaluation result for a position
 */
export interface StockfishEvaluation {
  /** Evaluation in centipawns (positive = white advantage) */
  score: number;
  /** Best move in UCI notation (e.g., "e2e4") */
  bestMove: string;
  /** Best move in SAN notation (e.g., "e4") */
  bestMoveSan?: string;
  /** Mate score (positive = white mates in N moves) */
  mate?: number;
  /** Search depth reached */
  depth: number;
  /** Time spent analyzing (milliseconds) */
  time: number;
  /** Nodes searched */
  nodes: number;
  /** Principal variation (best line) */
  pv?: string[];
}

/**
 * Stockfish analysis options
 */
export interface StockfishAnalysisOptions {
  /** Search depth (default: 18) */
  depth?: number;
  /** Max time in milliseconds (default: 10000) */
  maxTime?: number;
  /** Number of lines to analyze (default: 1) */
  multiPv?: number;
  /** Skill level 0-20 (default: 20) */
  skillLevel?: number;
}

/**
 * Stockfish engine state
 */
export interface StockfishState {
  isReady: boolean;
  isAnalyzing: boolean;
  error: string | null;
}
