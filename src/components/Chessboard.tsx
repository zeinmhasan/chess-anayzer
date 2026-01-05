/**
 * Interactive Chessboard Component
 * 
 * Features:
 * - Display chess position from FEN
 * - Interactive move navigation (first, prev, next, last)
 * - Optional move input for playing moves
 * - Responsive design with board size auto-adjustment
 * - Accessible controls with ARIA labels
 */

'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';
import type { Square } from 'react-chessboard/dist/chessboard/types';

export interface ChessboardProps {
  /** Current position in FEN notation */
  position: string;
  
  /** Board orientation - which side is at bottom */
  orientation?: 'white' | 'black';
  
  /** Callback when a move is made (for interactive mode) */
  onMove?: (from: Square, to: Square, promotion?: string) => boolean;
  
  /** Whether the board is interactive (can make moves) */
  interactive?: boolean;
  
  /** Highlighted squares (e.g., last move) */
  highlightSquares?: Square[];
  
  /** Board width in pixels (auto if not specified) */
  boardWidth?: number;
  
  /** Custom arrows to draw on board */
  arrows?: Array<[Square, Square]>;
  
  /** Custom CSS class */
  className?: string;
}

function ChessboardComponent({
  position,
  orientation = 'white',
  onMove,
  interactive = false,
  highlightSquares = [],
  boardWidth,
  arrows: _arrows = [], // Prefixed - arrows feature not yet implemented
  className = '',
}: ChessboardProps) {
  const [boardSize, setBoardSize] = useState(boardWidth || 500);

  // Auto-adjust board size based on viewport
  useEffect(() => {
    if (boardWidth) return; // Don't auto-resize if width is specified

    const updateSize = () => {
      const minDimension = Math.min(window.innerWidth - 32, 600);
      setBoardSize(Math.max(300, minDimension));
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [boardWidth]);

  // Build custom square styles for highlighting
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  highlightSquares.forEach(square => {
    customSquareStyles[square] = {
      backgroundColor: 'rgba(255, 255, 0, 0.4)',
    };
  });

  // Handle piece drop (for interactive mode)
  const handlePieceDrop = useCallback((sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
    if (!interactive || !onMove) return false;

    // Check if it's a pawn promotion
    const isPawnPromotion = 
      piece[1].toLowerCase() === 'p' && 
      (targetSquare[1] === '8' || targetSquare[1] === '1');

    if (isPawnPromotion) {
      // Default to queen promotion (can be enhanced with a dialog)
      return onMove(sourceSquare, targetSquare, 'q');
    }

    return onMove(sourceSquare, targetSquare);
  }, [interactive, onMove]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Chessboard */}
      <div 
        className="rounded-lg overflow-hidden shadow-2xl"
        style={{ width: boardSize, height: boardSize }}
      >
        <ReactChessboard
          position={position}
          boardOrientation={orientation}
          boardWidth={boardSize}
          onPieceDrop={interactive ? handlePieceDrop : undefined}
          customSquareStyles={customSquareStyles}
          arePiecesDraggable={interactive}
          customBoardStyle={{
            borderRadius: '4px',
          }}
          customDarkSquareStyle={{
            backgroundColor: '#779952',
          }}
          customLightSquareStyle={{
            backgroundColor: '#edeed1',
          }}
        />
      </div>

      {/* Board info */}
      <div className="mt-2 text-sm text-gray-400 text-center">
        <span className="capitalize">{orientation}</span> to move
      </div>
    </div>
  );
}

// Memoized Chessboard component
const Chessboard = memo(ChessboardComponent);
export default Chessboard;

/**
 * Chessboard with Navigation Controls
 * 
 * Includes first/prev/next/last move buttons
 */
export interface NavigableChessboardProps extends ChessboardProps {
  /** Current move index */
  currentMoveIndex: number;
  
  /** Total number of moves */
  totalMoves: number;
  
  /** Callback when move index changes */
  onMoveIndexChange: (index: number) => void;
}

export const NavigableChessboard = memo(function NavigableChessboard({
  currentMoveIndex,
  totalMoves,
  onMoveIndexChange,
  ...chessboardProps
}: NavigableChessboardProps) {
  const canGoPrevious = currentMoveIndex > 0;
  const canGoNext = currentMoveIndex < totalMoves;

  const handleFirst = useCallback(() => onMoveIndexChange(0), [onMoveIndexChange]);
  const handlePrevious = useCallback(() => canGoPrevious && onMoveIndexChange(currentMoveIndex - 1), [canGoPrevious, currentMoveIndex, onMoveIndexChange]);
  const handleNext = useCallback(() => canGoNext && onMoveIndexChange(currentMoveIndex + 1), [canGoNext, currentMoveIndex, onMoveIndexChange]);
  const handleLast = useCallback(() => onMoveIndexChange(totalMoves), [onMoveIndexChange, totalMoves]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Home') handleFirst();
      if (e.key === 'End') handleLast();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFirst, handleLast, handleNext, handlePrevious]);

  return (
    <div className="flex flex-col items-center">
      {/* Chessboard */}
      <Chessboard {...chessboardProps} />

      {/* Navigation Controls */}
      <div className="mt-4 flex items-center gap-2">
        {/* First Move */}
        <button
          onClick={handleFirst}
          disabled={!canGoPrevious}
          aria-label="First move"
          className={`
            p-2 rounded transition-colors
            ${canGoPrevious 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Previous Move */}
        <button
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          aria-label="Previous move"
          className={`
            p-2 rounded transition-colors
            ${canGoPrevious 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Move Counter */}
        <div className="px-4 py-2 bg-gray-800 rounded text-white font-mono text-sm min-w-[100px] text-center">
          {currentMoveIndex} / {totalMoves}
        </div>

        {/* Next Move */}
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Next move"
          className={`
            p-2 rounded transition-colors
            ${canGoNext 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Last Move */}
        <button
          onClick={handleLast}
          disabled={!canGoNext}
          aria-label="Last move"
          className={`
            p-2 rounded transition-colors
            ${canGoNext 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-2 text-xs text-gray-500">
        Use ← → arrow keys to navigate
      </div>
    </div>
  );
});
