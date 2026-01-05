/**
 * Evaluation Bar Component
 * 
 * Features:
 * - Visual bar showing position evaluation
 * - White advantage = bar goes up, Black advantage = bar goes down
 * - Smooth transitions between evaluations
 * - Displays numeric evaluation
 * - Mate scores displayed differently
 * - Responsive height adjustment
 * - Accessible with proper ARIA labels
 */

'use client';

import { useEffect, useState, memo } from 'react';

export interface EvaluationBarProps {
  /** Evaluation score in centipawns (positive = white advantage) */
  score: number;
  
  /** Mate score (positive = white mates in N, negative = black mates in N) */
  mate?: number;
  
  /** Bar height in pixels */
  height?: number;
  
  /** Show numeric evaluation label */
  showLabel?: boolean;
  
  /** Animate transitions */
  animate?: boolean;
  
  /** Custom CSS class */
  className?: string;
}

const EvaluationBar = memo(function EvaluationBar({
  score,
  mate,
  height = 400,
  showLabel = true,
  animate = true,
  className = '',
}: EvaluationBarProps) {
  const [displayScore, setDisplayScore] = useState(score);
  const [displayMate, setDisplayMate] = useState(mate);

  // Smooth score transitions
  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      setDisplayMate(mate);
      return;
    }

    const timer = setTimeout(() => {
      setDisplayScore(score);
      setDisplayMate(mate);
    }, 50);

    return () => clearTimeout(timer);
  }, [score, mate, animate]);

  // Calculate bar percentage (0-100)
  // 0 = fully black advantage, 50 = equal, 100 = fully white advantage
  const getPercentage = (): number => {
    // Handle mate scores
    if (displayMate !== undefined && displayMate !== null) {
      return displayMate > 0 ? 100 : 0;
    }

    // Cap score at ±1000 centipawns (±10 pawns)
    const cappedScore = Math.max(-1000, Math.min(1000, displayScore));
    
    // Convert to percentage (0-100)
    // -1000cp = 0%, 0cp = 50%, +1000cp = 100%
    return ((cappedScore + 1000) / 2000) * 100;
  };

  const percentage = getPercentage();

  // Determine evaluation label
  const getEvaluationLabel = (): string => {
    if (displayMate !== undefined && displayMate !== null) {
      return `M${Math.abs(displayMate)}`;
    }

    const evalInPawns = displayScore / 100;
    
    if (Math.abs(evalInPawns) >= 10) {
      return evalInPawns > 0 ? '+9.9+' : '-9.9-';
    }

    return evalInPawns >= 0 
      ? `+${evalInPawns.toFixed(1)}` 
      : evalInPawns.toFixed(1);
  };

  // Determine who has advantage
  const advantage = 
    displayMate !== undefined && displayMate !== null
      ? displayMate > 0 ? 'white' : 'black'
      : displayScore > 50 ? 'white' 
      : displayScore < -50 ? 'black' 
      : 'equal';

  return (
    <div 
      className={`flex gap-1 ${className}`}
      role="meter"
      aria-label="Position evaluation"
      aria-valuenow={displayScore}
      aria-valuemin={-1000}
      aria-valuemax={1000}
      aria-valuetext={getEvaluationLabel()}
    >
      {/* Evaluation Bar Container */}
      <div 
        className="relative w-7 bg-gray-900 rounded overflow-hidden shadow-lg border border-gray-700"
        style={{ height: `${height}px` }}
      >
        {/* Center line (equality) */}
        <div 
          className="absolute left-0 right-0 h-0.5 bg-gray-600 z-10"
          style={{ top: '50%' }}
          aria-hidden="true"
        />

        {/* Black advantage area (bottom) */}
        <div 
          className={`
            absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-800 to-gray-900
            ${animate ? 'transition-all duration-500 ease-out' : ''}
          `}
          style={{ 
            height: `${100 - percentage}%`,
          }}
          aria-hidden="true"
        />

        {/* White advantage area (top) */}
        <div 
          className={`
            absolute top-0 left-0 right-0 bg-gradient-to-b from-gray-100 to-gray-300
            ${animate ? 'transition-all duration-500 ease-out' : ''}
          `}
          style={{ 
            height: `${percentage}%`,
          }}
          aria-hidden="true"
        />

        {/* Evaluation marker */}
        <div
          className={`
            absolute left-0 right-0 h-1 z-20
            ${advantage === 'white' ? 'bg-blue-500' : 
              advantage === 'black' ? 'bg-red-500' : 
              'bg-yellow-500'}
            ${animate ? 'transition-all duration-500 ease-out' : ''}
            shadow-lg
          `}
          style={{ 
            top: `${100 - percentage}%`,
            transform: 'translateY(-50%)',
          }}
          aria-hidden="true"
        />

        {/* Mate indicator */}
        {displayMate !== undefined && displayMate !== null && (
          <div
            className={`
              absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-bold z-30
              ${displayMate > 0 ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}
              ${animate ? 'transition-all duration-500' : ''}
            `}
            style={{ 
              top: displayMate > 0 ? '10%' : '90%',
            }}
          >
            M{Math.abs(displayMate)}
          </div>
        )}
      </div>

      {/* Compact label next to bar */}
      {showLabel && (
        <div className="flex flex-col justify-between text-xs py-1">
          <span className={`font-mono font-bold ${advantage === 'white' ? 'text-white' : advantage === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
            {getEvaluationLabel()}
          </span>
          <span className="text-gray-600 text-[10px] leading-tight">
            {advantage === 'equal' ? 'Equal' : advantage === 'white' ? 'White' : 'Black'}
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * Compact Evaluation Bar
 * Smaller version for mobile or sidebar
 */
export interface CompactEvaluationBarProps {
  score: number;
  mate?: number;
  className?: string;
}

export function CompactEvaluationBar({ 
  score, 
  mate,
  className = '' 
}: CompactEvaluationBarProps) {
  const getPercentage = (): number => {
    if (mate !== undefined && mate !== null) {
      return mate > 0 ? 100 : 0;
    }
    const cappedScore = Math.max(-1000, Math.min(1000, score));
    return ((cappedScore + 1000) / 2000) * 100;
  };

  const percentage = getPercentage();

  const getLabel = (): string => {
    if (mate !== undefined && mate !== null) {
      return `M${Math.abs(mate)}`;
    }
    const evalInPawns = score / 100;
    if (Math.abs(evalInPawns) >= 10) {
      return evalInPawns > 0 ? '+9+' : '-9-';
    }
    return evalInPawns >= 0 ? `+${evalInPawns.toFixed(1)}` : evalInPawns.toFixed(1);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Horizontal bar */}
      <div className="flex-1 h-6 bg-gray-900 rounded overflow-hidden relative">
        {/* Black side */}
        <div 
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-gray-800 to-gray-900"
          style={{ width: `${100 - percentage}%` }}
        />
        {/* White side */}
        <div 
          className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-gray-100 to-gray-300"
          style={{ width: `${percentage}%` }}
        />
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600 z-10" />
      </div>

      {/* Label */}
      <div className="w-16 text-right font-mono text-sm font-bold">
        {getLabel()}
      </div>
    </div>
  );
}

export default EvaluationBar;
