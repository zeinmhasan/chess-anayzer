// Analysis context - akan diimplementasi kemudian
"use client";

import { createContext, useContext, ReactNode } from "react";
import type { GameAnalysis } from "@/types/chess";

interface AnalysisContextType {
  analysis: GameAnalysis | null;
  isLoading: boolean;
  error: string | null;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(
  undefined
);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  // Placeholder values until implementation
  const analysis = null;
  const isLoading = false;
  const error = null;

  return (
    <AnalysisContext.Provider value={{ analysis, isLoading, error }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return context;
}
