'use client';

/**
 * Interactive Chessboard with Move Classification Icons
 * Like Chess.com - shows book icons, best move indicators, etc. on the board
 */

import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard as ReactChessboard } from 'react-chessboard';
import type { Square } from 'react-chessboard/dist/chessboard/types';
import { 
  BookOpen, Target, Zap, Star, ThumbsUp, AlertTriangle, 
  XCircle, Minus
} from 'lucide-react';

export type MoveClassification = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'forced';

// Classification visual config matching Chess.com style
const classificationStyles: Record<MoveClassification, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: React.ReactNode;
  label: string;
}> = {
  brilliant: { 
    color: '#1BACA6', 
    bgColor: 'rgba(27, 172, 166, 0.9)', 
    borderColor: '#1BACA6',
    icon: <Star className="w-3 h-3" />,
    label: 'Brilliant!'
  },
  great: { 
    color: '#5C8BB0', 
    bgColor: 'rgba(92, 139, 176, 0.9)', 
    borderColor: '#5C8BB0',
    icon: <Zap className="w-3 h-3" />,
    label: 'Great move!'
  },
  best: { 
    color: '#96BC4B', 
    bgColor: 'rgba(150, 188, 75, 0.9)', 
    borderColor: '#96BC4B',
    icon: <Target className="w-3 h-3" />,
    label: 'Best move'
  },
  excellent: { 
    color: '#96BC4B', 
    bgColor: 'rgba(150, 188, 75, 0.8)', 
    borderColor: '#96BC4B',
    icon: <ThumbsUp className="w-3 h-3" />,
    label: 'Excellent'
  },
  good: { 
    color: '#A3BF4F', 
    bgColor: 'rgba(163, 191, 79, 0.8)', 
    borderColor: '#A3BF4F',
    icon: <ThumbsUp className="w-3 h-3" />,
    label: 'Good'
  },
  book: { 
    color: '#A88B65', 
    bgColor: 'rgba(168, 139, 101, 0.9)', 
    borderColor: '#A88B65',
    icon: <BookOpen className="w-3 h-3" />,
    label: 'Book move'
  },
  inaccuracy: { 
    color: '#F7C631', 
    bgColor: 'rgba(247, 198, 49, 0.9)', 
    borderColor: '#F7C631',
    icon: <AlertTriangle className="w-3 h-3" />,
    label: 'Inaccuracy'
  },
  mistake: { 
    color: '#E58F2A', 
    bgColor: 'rgba(229, 143, 42, 0.9)', 
    borderColor: '#E58F2A',
    icon: <AlertTriangle className="w-3 h-3" />,
    label: 'Mistake'
  },
  blunder: { 
    color: '#CA3431', 
    bgColor: 'rgba(202, 52, 49, 0.9)', 
    borderColor: '#CA3431',
    icon: <XCircle className="w-3 h-3" />,
    label: 'Blunder'
  },
  forced: { 
    color: '#888888', 
    bgColor: 'rgba(136, 136, 136, 0.7)', 
    borderColor: '#888888',
    icon: <Minus className="w-3 h-3" />,
    label: 'Only move'
  },
};

export interface MoveIndicator {
  square: Square;
  classification: MoveClassification;
}

export interface InteractiveChessboardProps {
  /** Current position in FEN notation */
  position: string;
  
  /** Board orientation - which side is at bottom */
  orientation?: 'white' | 'black';
  
  /** Whether the board is interactive (can make moves) */
  interactive?: boolean;
  
  /** Callback when a move is made - return true if valid */
  onMove?: (from: Square, to: Square, promotion?: string) => boolean;
  
  /** Callback when user makes a move for analysis (returns evaluation) */
  onUserMove?: (from: Square, to: Square, promotion?: string) => Promise<{
    isValid: boolean;
    classification?: MoveClassification;
    evalBefore?: number;
    evalAfter?: number;
    bestMove?: string;
    isGameMove?: boolean;
  }>;
  
  /** Highlighted squares (e.g., last move) */
  highlightSquares?: Square[];
  
  /** Move indicator to show on the board (classification icon) */
  moveIndicator?: MoveIndicator;
  
  /** Best move arrow */
  bestMoveArrow?: { from: Square; to: Square } | null;
  
  /** Show best move arrow */
  showBestMove?: boolean;
  
  /** Board width in pixels (auto if not specified) */
  boardWidth?: number;
  
  /** Custom CSS class */
  className?: string;
  
  /** Callback when position changes via user move */
  onPositionChange?: (fen: string) => void;
}

function InteractiveChessboardComponent({
  position,
  orientation = 'white',
  interactive = true,
  onMove,
  onUserMove,
  highlightSquares = [],
  moveIndicator,
  bestMoveArrow,
  showBestMove = false,
  boardWidth,
  className = '',
}: InteractiveChessboardProps) {
  const [boardSize, setBoardSize] = useState(boardWidth || 500);
  const [pendingMove, setPendingMove] = useState<{
    from: Square;
    to: Square;
    classification?: MoveClassification;
  } | null>(null);
  
  // State for click-to-move functionality
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  // Auto-adjust board size based on viewport
  useEffect(() => {
    if (boardWidth) {
      setBoardSize(boardWidth);
      return;
    }

    const updateSize = () => {
      const minDimension = Math.min(window.innerWidth - 32, 560);
      setBoardSize(Math.max(280, minDimension));
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [boardWidth]);

  // Get legal moves for a piece on a square
  const getLegalMovesForSquare = useCallback((square: Square): Square[] => {
    try {
      const chess = new Chess(position);
      const moves = chess.moves({ square, verbose: true });
      return moves.map(move => move.to as Square);
    } catch {
      return [];
    }
  }, [position]);

  // Check if there's a piece on a square
  const hasPieceOnSquare = useCallback((square: Square): boolean => {
    try {
      const chess = new Chess(position);
      return chess.get(square) !== null;
    } catch {
      return false;
    }
  }, [position]);

  // Handle square click for click-to-move
  const handleSquareClick = useCallback((square: Square) => {
    if (!interactive) return;

    // If a square is already selected
    if (selectedSquare) {
      // If clicking the same square, deselect
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // If clicking on a legal move square, make the move
      if (legalMoves.includes(square)) {
        // Check if it's a pawn promotion
        const chess = new Chess(position);
        const piece = chess.get(selectedSquare);
        const isPawnPromotion = 
          piece?.type === 'p' && 
          (square[1] === '8' || square[1] === '1');
        
        const promotion = isPawnPromotion ? 'q' : undefined;

        // Make the move
        if (onUserMove) {
          onUserMove(selectedSquare, square, promotion).then((result) => {
            if (result.isValid && result.classification) {
              setPendingMove({
                from: selectedSquare,
                to: square,
                classification: result.classification,
              });
              setTimeout(() => setPendingMove(null), 2000);
            }
          });
        } else if (onMove) {
          onMove(selectedSquare, square, promotion);
        }

        // Clear selection
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // If clicking on another piece of same color, select that piece instead
      if (hasPieceOnSquare(square)) {
        const chess = new Chess(position);
        const clickedPiece = chess.get(square);
        const selectedPiece = chess.get(selectedSquare);
        
        if (clickedPiece && selectedPiece && clickedPiece.color === selectedPiece.color) {
          const moves = getLegalMovesForSquare(square);
          if (moves.length > 0) {
            setSelectedSquare(square);
            setLegalMoves(moves);
            return;
          }
        }
      }

      // Otherwise, deselect
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // No square selected - try to select this square if it has a piece with legal moves
    const moves = getLegalMovesForSquare(square);
    if (moves.length > 0) {
      setSelectedSquare(square);
      setLegalMoves(moves);
    }
  }, [interactive, selectedSquare, legalMoves, position, onMove, onUserMove, getLegalMovesForSquare, hasPieceOnSquare]);

  // Clear selection when position changes externally
  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [position]);

  // Build custom square styles for highlighting
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    
    // Highlight last move squares
    highlightSquares.forEach(square => {
      styles[square] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
      };
    });

    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: 'rgba(255, 255, 0, 0.6)',
        boxShadow: 'inset 0 0 0 3px rgba(255, 200, 0, 0.8)',
      };
    }

    // Highlight legal move squares with dots
    legalMoves.forEach(square => {
      const hasCapture = hasPieceOnSquare(square);
      styles[square] = {
        ...styles[square],
        background: hasCapture 
          ? 'radial-gradient(transparent 0%, transparent 79%, rgba(0,0,0,0.3) 80%)'
          : 'radial-gradient(rgba(0,0,0,0.2) 25%, transparent 25%)',
        cursor: 'pointer',
      };
    });

    // Highlight move indicator square with classification color
    if (moveIndicator) {
      const config = classificationStyles[moveIndicator.classification];
      styles[moveIndicator.square] = {
        ...styles[moveIndicator.square],
        boxShadow: `inset 0 0 0 3px ${config.borderColor}`,
      };
    }

    return styles;
  }, [highlightSquares, moveIndicator, selectedSquare, legalMoves, hasPieceOnSquare]);

  // Custom arrows for best move
  const customArrows = useMemo(() => {
    if (!showBestMove || !bestMoveArrow) return [];
    return [[bestMoveArrow.from, bestMoveArrow.to, 'rgba(0, 180, 0, 0.7)'] as [Square, Square, string]];
  }, [showBestMove, bestMoveArrow]);

  // Handle piece drag start - clear click selection
  const handlePieceDragBegin = useCallback((_piece: string, _sourceSquare: Square) => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  // Handle piece drop - must return boolean synchronously
  const handlePieceDrop = useCallback((
    sourceSquare: Square, 
    targetSquare: Square, 
    piece: string
  ): boolean => {
    if (!interactive) return false;

    // Clear click selection on drop
    setSelectedSquare(null);
    setLegalMoves([]);

    // Check if it's a pawn promotion
    const isPawnPromotion = 
      piece[1]?.toLowerCase() === 'p' && 
      (targetSquare[1] === '8' || targetSquare[1] === '1');

    const promotion = isPawnPromotion ? 'q' : undefined;

    // If we have onUserMove, trigger async analysis but return true immediately
    if (onUserMove) {
      // Async analysis in background
      onUserMove(sourceSquare, targetSquare, promotion).then((result) => {
        if (result.isValid && result.classification) {
          setPendingMove({
            from: sourceSquare,
            to: targetSquare,
            classification: result.classification,
          });
          
          // Clear pending move after animation
          setTimeout(() => setPendingMove(null), 2000);
        }
      });
      
      return true; // Optimistically allow move
    }

    // Fall back to simple onMove
    if (onMove) {
      return onMove(sourceSquare, targetSquare, promotion);
    }

    return false;
  }, [interactive, onMove, onUserMove]);

  // Get the square size for positioning icons
  const squareSize = boardSize / 8;

  // Calculate icon position based on square and orientation
  const getIconPosition = useCallback((square: Square) => {
    const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
    const rank = parseInt(square[1]) - 1; // 1=0, 2=1, etc.
    
    let x, y;
    if (orientation === 'white') {
      x = file * squareSize;
      y = (7 - rank) * squareSize;
    } else {
      x = (7 - file) * squareSize;
      y = rank * squareSize;
    }
    
    // Position at top-right corner of square
    return {
      left: x + squareSize - 20,
      top: y + 2,
    };
  }, [orientation, squareSize]);

  // Render classification icon overlay
  const renderMoveIndicator = useCallback(() => {
    const indicator = pendingMove || moveIndicator;
    if (!indicator) return null;

    const classification = pendingMove?.classification || moveIndicator?.classification;
    if (!classification) return null;

    const styleConfig = classificationStyles[classification];
    // Get square position - pendingMove has 'to', moveIndicator has 'square'
    const targetSquare = pendingMove ? pendingMove.to : (moveIndicator?.square as Square);
    const pos = getIconPosition(targetSquare);

    return (
      <div
        className="absolute z-50 pointer-events-none animate-pulse"
        style={{
          left: pos.left,
          top: pos.top,
          width: 18,
          height: 18,
        }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center shadow-lg"
          style={{
            backgroundColor: styleConfig.bgColor,
            border: `2px solid ${styleConfig.borderColor}`,
          }}
        >
          <span className="text-white">{styleConfig.icon}</span>
        </div>
      </div>
    );
  }, [pendingMove, moveIndicator, getIconPosition]);

  return (
    <div className={`relative ${className}`}>
      {/* Chessboard */}
      <div 
        className="rounded-lg overflow-hidden shadow-2xl relative"
        style={{ width: boardSize, height: boardSize }}
      >
        <ReactChessboard
          position={position}
          boardOrientation={orientation}
          boardWidth={boardSize}
          onPieceDrop={handlePieceDrop}
          onPieceDragBegin={handlePieceDragBegin}
          onSquareClick={handleSquareClick}
          customSquareStyles={customSquareStyles}
          customArrows={customArrows}
          arePiecesDraggable={interactive}
          animationDuration={200}
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
        
        {/* Move classification icon overlay */}
        {renderMoveIndicator()}
      </div>
    </div>
  );
}

const InteractiveChessboard = memo(InteractiveChessboardComponent);
export default InteractiveChessboard;

/**
 * Classification Badge Component
 * Shows the move classification with icon and label
 */
export function ClassificationBadge({ 
  classification,
  size = 'md',
  showLabel = true,
}: { 
  classification: MoveClassification;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  const config = classificationStyles[classification];
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: config.bgColor,
        color: 'white',
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <span className={iconSizes[size]}>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * Move Feedback Popup
 * Shows after user makes a move with evaluation
 */
export interface MoveFeedbackData {
  classification: MoveClassification;
  evalBefore: number;
  evalAfter: number;
  bestMove?: string;
  isGameMove: boolean;
}

interface MoveFeedbackInternalProps extends MoveFeedbackData {
  handleClose: () => void;
}

function MoveFeedbackInternal({
  classification,
  evalBefore,
  evalAfter,
  bestMove,
  isGameMove,
  handleClose,
}: MoveFeedbackInternalProps) {
  const evalChange = evalAfter - evalBefore;
  
  const formatEval = (score: number) => {
    const pawns = score / 100;
    if (Math.abs(pawns) >= 10) return pawns > 0 ? '+10+' : '-10-';
    return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-xl border border-gray-700 animate-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-3">
        <ClassificationBadge classification={classification} size="lg" />
        <button 
          onClick={handleClose}
          className="text-gray-400 hover:text-white p-1"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Evaluation change:</span>
          <span className={evalChange > 0 ? 'text-green-400' : evalChange < 0 ? 'text-red-400' : 'text-gray-300'}>
            {formatEval(evalBefore)} → {formatEval(evalAfter)}
          </span>
        </div>
        
        {bestMove && classification !== 'best' && classification !== 'book' && (
          <div className="flex justify-between">
            <span className="text-gray-400">Best move was:</span>
            <span className="text-green-400 font-mono">{bestMove}</span>
          </div>
        )}
        
        {isGameMove && (
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">
            ✓ This is the move that was played in the game
          </div>
        )}
      </div>
    </div>
  );
}

// Export wrapper with onClose prop name for external usage
export function MoveFeedback(props: MoveFeedbackData & { onClose: () => void }) {
  return <MoveFeedbackInternal {...props} handleClose={props.onClose} />;
}
