// Chess game hook - akan diimplementasi kemudian
"use client";

export function useChessGame() {
  const currentMove = 0;
  const fen = "";

  // TODO: Implement chess game hook logic
  const setCurrentMove = (_move: number) => {
    // To be implemented
  };

  return {
    currentMove,
    fen,
    setCurrentMove,
  };
}
