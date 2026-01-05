/**
 * Move List Component
 * 
 * Features:
 * - Display chess moves in traditional notation
 * - Show move classifications (brilliant, blunder, etc.)
 * - Display evaluation for each move
 * - Highlight currently selected move
 * - Click to navigate to specific move
 * - Responsive scrolling list
 * - Accessible with keyboard navigation
 */

'use client';

import React, { useRef, useEffect, memo, forwardRef } from 'react';
import type { AnalyzedMove, MoveClassification } from '@/lib/chess-analyzer';

export interface MoveListProps {
  /** Array of analyzed moves */
  moves: AnalyzedMove[];
  
  /** Currently selected move index */
  selectedIndex: number;
  
  /** Callback when a move is clicked */
  onMoveClick: (index: number) => void;
  
  /** Show evaluation scores */
  showEvaluation?: boolean;
  
  /** Show classification badges */
  showClassification?: boolean;
  
  /** Compact mode (smaller text) */
  compact?: boolean;
  
  /** Custom CSS class */
  className?: string;
}

function MoveListComponent({
  moves,
  selectedIndex,
  onMoveClick,
  showEvaluation = true,
  showClassification = true,
  compact = false,
  className = '',
}: MoveListProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected move
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Group moves by move number (white + black = 1 move number)
  const groupedMoves: Array<{
    moveNumber: number;
    white?: AnalyzedMove;
    whiteIndex: number;
    black?: AnalyzedMove;
    blackIndex: number;
  }> = [];

  moves.forEach((move, index) => {
    if (move.isWhite) {
      groupedMoves.push({
        moveNumber: move.moveNumber,
        white: move,
        whiteIndex: index,
        black: undefined,
        blackIndex: -1,
      });
    } else {
      // Add to previous group
      const lastGroup = groupedMoves[groupedMoves.length - 1];
      if (lastGroup && lastGroup.moveNumber === move.moveNumber) {
        lastGroup.black = move;
        lastGroup.blackIndex = index;
      }
    }
  });

  return (
    <div 
      className={`bg-gray-800 rounded-lg overflow-hidden ${className}`}
      role="list"
      aria-label="Move list"
    >
      {/* Header */}
      <div className="bg-gray-900 px-4 py-2 font-semibold text-sm border-b border-gray-700">
        Moves ({moves.length})
      </div>

      {/* Move List */}
      <div className="overflow-y-auto max-h-[600px]">
        {groupedMoves.map((group) => (
          <div
            key={group.moveNumber}
            className="border-b border-gray-700 hover:bg-gray-750"
          >
            <div className="flex items-stretch">
              {/* Move Number */}
              <div className="w-12 flex items-center justify-center bg-gray-900 text-gray-400 text-sm font-mono">
                {group.moveNumber}.
              </div>

              {/* White Move */}
              <MoveCell
                move={group.white}
                index={group.whiteIndex}
                isSelected={selectedIndex === group.whiteIndex}
                onClick={() => group.white && onMoveClick(group.whiteIndex)}
                showEvaluation={showEvaluation}
                showClassification={showClassification}
                compact={compact}
                ref={selectedIndex === group.whiteIndex ? selectedRef : null}
              />

              {/* Black Move */}
              <MoveCell
                move={group.black}
                index={group.blackIndex}
                isSelected={selectedIndex === group.blackIndex}
                onClick={() => group.black && onMoveClick(group.blackIndex)}
                showEvaluation={showEvaluation}
                showClassification={showClassification}
                compact={compact}
                ref={selectedIndex === group.blackIndex ? selectedRef : null}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Individual Move Cell Component
 */
interface MoveCellProps {
  move?: AnalyzedMove;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  showEvaluation: boolean;
  showClassification: boolean;
  compact: boolean;
}

const MoveCell = forwardRef<HTMLDivElement, MoveCellProps>(function MoveCell({ 
  move, 
  isSelected, 
  onClick, 
  showEvaluation, 
  showClassification,
  compact 
}, ref) {
  if (!move) {
    return <div className="flex-1" />;
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        flex-1 px-3 py-2 cursor-pointer transition-colors
        ${isSelected 
          ? 'bg-blue-600 text-white' 
          : 'hover:bg-gray-700'
        }
        ${compact ? 'text-sm' : 'text-base'}
      `}
      aria-label={`Move ${move.moveNumber}: ${move.notation}`}
      aria-current={isSelected ? 'true' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Move Notation */}
        <div className="flex items-center gap-2">
          <span className="font-bold font-mono">
            {move.notation}
          </span>
          
          {/* Classification Badge */}
          {showClassification && (
            <ClassificationBadge 
              classification={move.classification}
              compact={compact}
            />
          )}
        </div>

        {/* Evaluation */}
        {showEvaluation && (
          <div className={`
            font-mono tabular-nums
            ${compact ? 'text-xs' : 'text-sm'}
            ${isSelected ? 'text-blue-100' : 'text-gray-400'}
          `}>
            {formatEvaluation(move.evalAfter.score, move.evalAfter.mate)}
          </div>
        )}
      </div>

      {/* Centipawn Loss Indicator */}
      {move.centipawnLoss > 0 && (
        <div className="mt-1">
          <CentipawnLossBar 
            cpLoss={move.centipawnLoss}
            compact={compact}
          />
        </div>
      )}
    </div>
  );
});

/**
 * Classification Badge Component
 */
interface ClassificationBadgeProps {
  classification: MoveClassification;
  compact: boolean;
}

function ClassificationBadge({ classification, compact }: ClassificationBadgeProps) {
  const config: Record<string, { color: string; symbol: string; label: string }> = {
    brilliant: { color: 'bg-cyan-500', symbol: '!!', label: 'Brilliant' },
    great: { color: 'bg-green-500', symbol: '!', label: 'Great' },
    best: { color: 'bg-green-600', symbol: '★', label: 'Best' },
    excellent: { color: 'bg-lime-500', symbol: '◆', label: 'Excellent' },
    good: { color: 'bg-lime-600', symbol: '', label: 'Good' },
    book: { color: 'bg-gray-500', symbol: '📖', label: 'Book' },
    forced: { color: 'bg-gray-600', symbol: '→', label: 'Forced' },
    inaccuracy: { color: 'bg-yellow-500', symbol: '?!', label: 'Inaccuracy' },
    mistake: { color: 'bg-orange-500', symbol: '?', label: 'Mistake' },
    blunder: { color: 'bg-red-500', symbol: '??', label: 'Blunder' },
  };

  const classConfig = config[classification];
  
  // Handle unknown classification gracefully
  if (!classConfig) {
    return null;
  }

  const { color, symbol, label } = classConfig;

  // Only show badges for notable moves
  if (classification === 'good' || classification === 'book' || classification === 'forced') {
    return null;
  }

  return (
    <span
      className={`
        ${color} text-white font-bold rounded
        ${compact ? 'text-xs px-1' : 'text-xs px-1.5 py-0.5'}
      `}
      title={label}
      aria-label={label}
    >
      {symbol || classification.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Centipawn Loss Progress Bar
 */
interface CentipawnLossBarProps {
  cpLoss: number;
  compact: boolean;
}

function CentipawnLossBar({ cpLoss, compact }: CentipawnLossBarProps) {
  // Cap at 300 for display purposes
  const displayLoss = Math.min(cpLoss, 300);
  const percentage = (displayLoss / 300) * 100;

  // Color based on severity
  let barColor = 'bg-yellow-500';
  if (cpLoss > 200) barColor = 'bg-red-500';
  else if (cpLoss > 100) barColor = 'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-gray-700 rounded-full overflow-hidden ${compact ? 'h-1' : 'h-1.5'}`}>
        <div
          className={`${barColor} h-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={cpLoss}
          aria-valuemin={0}
          aria-valuemax={300}
          aria-label="Centipawn loss"
        />
      </div>
      <span className="text-xs text-gray-500 font-mono tabular-nums w-8 text-right">
        -{Math.round(cpLoss)}
      </span>
    </div>
  );
}

/**
 * Format evaluation score for display
 */
function formatEvaluation(score: number, mate?: number): string {
  if (mate !== undefined && mate !== null) {
    return `M${mate > 0 ? mate : -mate}`;
  }

  const evalInPawns = score / 100;
  
  if (Math.abs(evalInPawns) >= 10) {
    return evalInPawns > 0 ? '+9.9+' : '-9.9-';
  }

  return evalInPawns > 0 
    ? `+${evalInPawns.toFixed(2)}` 
    : evalInPawns.toFixed(2);
}

const MoveList = memo(MoveListComponent);
export default MoveList;

