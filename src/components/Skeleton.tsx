'use client';

import { memo } from 'react';

// ============================================================================
// Skeleton Components for Loading States
// ============================================================================

interface SkeletonProps {
  className?: string;
}

export const Skeleton = memo(function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-700/50 rounded ${className}`}
      aria-hidden="true"
    />
  );
});

// Game Card Skeleton
export const GameCardSkeleton = memo(function GameCardSkeleton() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
});

// Chessboard Skeleton
export const ChessboardSkeleton = memo(function ChessboardSkeleton() {
  return (
    <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      <div className="grid grid-cols-8 grid-rows-8 h-full">
        {Array.from({ length: 64 }).map((_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const isDark = (row + col) % 2 === 1;
          return (
            <div
              key={i}
              className={`${isDark ? 'bg-gray-700' : 'bg-gray-600'} animate-pulse`}
            />
          );
        })}
      </div>
    </div>
  );
});

// Move List Skeleton
export const MoveListSkeleton = memo(function MoveListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  );
});

// Analysis Panel Skeleton
export const AnalysisPanelSkeleton = memo(function AnalysisPanelSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-3">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
});

// Graph Skeleton
export const GraphSkeleton = memo(function GraphSkeleton() {
  return (
    <div className="h-32 w-full bg-gray-800 rounded-lg p-4">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="h-20 flex items-end justify-between gap-1">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i} 
            className="flex-1 animate-pulse bg-gray-700/50 rounded"
            style={{ height: `${30 + Math.random() * 50}%` }}
          />
        ))}
      </div>
    </div>
  );
});

// Full Page Loading Skeleton
export const FullPageSkeleton = memo(function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
});

export default Skeleton;
