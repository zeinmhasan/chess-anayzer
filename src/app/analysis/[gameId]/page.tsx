'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess } from 'chess.js';
import { 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  RotateCcw, Eye, EyeOff, Play, Pause,
  TrendingUp, TrendingDown, Minus, Zap, Target, ThumbsUp,
  BookOpen, AlertTriangle, XCircle, Star, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { 
  Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Area, AreaChart 
} from 'recharts';
import InteractiveChessboard from '@/components/InteractiveChessboard';
import EvaluationBar from '@/components/EvaluationBar';
import { StockfishEngine } from '@/lib/stockfish';
import type { Square } from 'react-chessboard/dist/chessboard/types';

interface GameData {
  id: string; pgn: string; white: string; black: string;
  whiteRating: number; blackRating: number; timeClass: string;
  date: string; result: string; url: string;
}

type MoveClassification = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'forced';

interface StockfishEvaluation {
  score: number; bestMove: string; bestMoveSan?: string; mate?: number;
  depth: number; time: number; nodes: number; pv?: string[];
}

interface RealAnalyzedMove {
  moveNumber: number; notation: string; from: string; to: string; piece: string;
  captured?: string; promotion?: string; fen: string; fenBefore: string; isWhite: boolean;
  evalBefore: StockfishEvaluation; evalAfter: StockfishEvaluation;
  bestMove: { uci: string; san: string; eval: StockfishEvaluation } | null;
  classification: MoveClassification; centipawnLoss: number;
  isCapture: boolean; isCheck: boolean; isCheckmate: boolean;
  isCastling: boolean; isPromotion: boolean;
}

interface RealGameAnalysis {
  gameId: string; moves: RealAnalyzedMove[];
  whiteAccuracy: number; blackAccuracy: number;
  whiteMoveStats: Record<MoveClassification, number>;
  blackMoveStats: Record<MoveClassification, number>;
  evaluations: number[]; analysisDepth: number; analyzedAt: string;
}

const classificationConfig: Record<MoveClassification, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  brilliant: { icon: <Star className="w-4 h-4" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Brilliant' },
  great: { icon: <Zap className="w-4 h-4" />, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Great' },
  best: { icon: <Target className="w-4 h-4" />, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Best' },
  excellent: { icon: <ThumbsUp className="w-4 h-4" />, color: 'text-green-300', bgColor: 'bg-green-400/20', label: 'Excellent' },
  good: { icon: <ThumbsUp className="w-4 h-4" />, color: 'text-lime-400', bgColor: 'bg-lime-500/20', label: 'Good' },
  book: { icon: <BookOpen className="w-4 h-4" />, color: 'text-amber-600', bgColor: 'bg-amber-500/20', label: 'Book' },
  inaccuracy: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Inaccuracy' },
  mistake: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Mistake' },
  blunder: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-500', bgColor: 'bg-red-500/20', label: 'Blunder' },
  forced: { icon: <Minus className="w-4 h-4" />, color: 'text-gray-500', bgColor: 'bg-gray-600/20', label: 'Forced' },
};

function formatEval(score: number, mate?: number): string {
  if (mate !== undefined && mate !== null) return mate > 0 ? `+M${Math.abs(mate)}` : `-M${Math.abs(mate)}`;
  const pawns = score / 100;
  if (Math.abs(pawns) >= 10) return pawns > 0 ? '+9.9+' : '-9.9-';
  return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

function getAccuracyColor(acc: number): string {
  if (acc >= 90) return 'text-green-400';
  if (acc >= 80) return 'text-lime-400';
  if (acc >= 70) return 'text-yellow-400';
  if (acc >= 60) return 'text-orange-400';
  return 'text-red-400';
}

function getAccuracyBgColor(acc: number): string {
  if (acc >= 90) return 'bg-green-500';
  if (acc >= 80) return 'bg-lime-500';
  if (acc >= 70) return 'bg-yellow-500';
  if (acc >= 60) return 'bg-orange-500';
  return 'bg-red-500';
}

const THRESHOLDS = { excellent: 15, good: 30, inaccuracy: 60, mistake: 120, blunder: 200 };

function classifyByLoss(cpLoss: number): MoveClassification {
  if (cpLoss <= THRESHOLDS.excellent) return 'excellent';
  if (cpLoss <= THRESHOLDS.good) return 'good';
  if (cpLoss <= THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (cpLoss <= THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

function AnalysisMoveList({ moves, selectedIndex, onMoveClick }: { 
  moves: RealAnalyzedMove[]; selectedIndex: number; onMoveClick: (i: number) => void;
}) {
  const movePairs: Array<{ moveNumber: number; white?: RealAnalyzedMove; black?: RealAnalyzedMove; whiteIndex?: number; blackIndex?: number }> = [];
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.isWhite) {
      movePairs.push({ moveNumber: move.moveNumber, white: move, whiteIndex: i });
    } else {
      const lastPair = movePairs[movePairs.length - 1];
      if (lastPair && lastPair.moveNumber === move.moveNumber && !lastPair.black) {
        lastPair.black = move; lastPair.blackIndex = i;
      } else {
        movePairs.push({ moveNumber: move.moveNumber, black: move, blackIndex: i });
      }
    }
  }
  
  return (
    <div className="space-y-0.5">
      {movePairs.map((pair, idx) => (
        <div key={idx} className="flex items-stretch text-xs">
          <div className="w-6 text-gray-500 font-mono text-right pr-1 py-0.5 flex-shrink-0">{pair.moveNumber}.</div>
          <div className="flex-1 min-w-0">
            {pair.white && pair.whiteIndex !== undefined ? (
              <button onClick={() => onMoveClick(pair.whiteIndex!)}
                className={`w-full text-left px-1 py-0.5 rounded flex items-center gap-1 transition-colors ${selectedIndex === pair.whiteIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>
                <span className={`flex-shrink-0 w-3 h-3 ${classificationConfig[pair.white.classification].color}`}>
                  {classificationConfig[pair.white.classification].icon}
                </span>
                <span className="truncate font-medium">{pair.white.notation}</span>
              </button>
            ) : <div className="px-1 py-0.5"></div>}
          </div>
          <div className="flex-1 min-w-0">
            {pair.black && pair.blackIndex !== undefined ? (
              <button onClick={() => onMoveClick(pair.blackIndex!)}
                className={`w-full text-left px-1 py-0.5 rounded flex items-center gap-1 transition-colors ${selectedIndex === pair.blackIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>
                <span className={`flex-shrink-0 w-3 h-3 ${classificationConfig[pair.black.classification].color}`}>
                  {classificationConfig[pair.black.classification].icon}
                </span>
                <span className="truncate font-medium">{pair.black.notation}</span>
              </button>
            ) : <div className="px-1 py-0.5"></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [analysis, setAnalysis] = useState<RealGameAnalysis | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [showMoveDetails, setShowMoveDetails] = useState(true);
  const [showBestMove, setShowBestMove] = useState(false);
  
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [explorationPosition, setExplorationPosition] = useState<string | null>(null);
  const [explorationBestMove, setExplorationBestMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<{
    classification: MoveClassification;
    evalBefore: number;
    evalAfter: number;
    bestMove?: string;
    isGameMove: boolean;
  } | null>(null);
  const [isAnalyzingMove, setIsAnalyzingMove] = useState(false);
  
  const engineRef = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    const loadAnalysis = () => {
      setIsLoading(true);
      setError(null);
      try {
        const storedGameData = localStorage.getItem('pendingAnalysis');
        if (storedGameData) {
          const game: GameData = JSON.parse(storedGameData);
          if (game.id === gameId) setGameData(game);
        }
        const storedAnalysis = localStorage.getItem(`analysis_${gameId}`);
        if (!storedAnalysis) {
          setError('Analysis not found. Redirecting...');
          setTimeout(() => router.replace(`/analysis/loading/${gameId}`), 1500);
          return;
        }
        const analysisData: RealGameAnalysis = JSON.parse(storedAnalysis);
        setAnalysis(analysisData);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading analysis:', err);
        setError('Failed to load analysis data.');
        setIsLoading(false);
      }
    };
    loadAnalysis();
  }, [gameId, router]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.terminate();
        engineRef.current = null;
      }
    };
  }, []);

  const currentPosition = useMemo(() => {
    if (explorationPosition) return explorationPosition;
    if (!analysis) return new Chess().fen();
    if (currentMoveIndex === -1) {
      if (analysis.moves.length > 0) return analysis.moves[0].fenBefore;
      return new Chess().fen();
    }
    return analysis.moves[currentMoveIndex]?.fen || new Chess().fen();
  }, [analysis, currentMoveIndex, explorationPosition]);

  const currentEval = useMemo(() => {
    if (!analysis || currentMoveIndex === -1) return { score: 20, mate: undefined };
    const move = analysis.moves[currentMoveIndex];
    if (!move) return { score: 0, mate: undefined };
    const evalData = move.evalAfter;
    const flipSign = move.isWhite ? -1 : 1;
    return { score: evalData.score * flipSign, mate: evalData.mate !== undefined ? evalData.mate * flipSign : undefined };
  }, [analysis, currentMoveIndex]);

  const currentMove = useMemo(() => {
    if (!analysis || currentMoveIndex === -1) return null;
    return analysis.moves[currentMoveIndex];
  }, [analysis, currentMoveIndex]);

  const bestMoveArrow = useMemo(() => {
    if (!currentMove?.bestMove) return null;
    const uci = currentMove.bestMove.uci;
    if (uci.length < 4) return null;
    return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
  }, [currentMove]);

  const moveIndicator = useMemo(() => {
    if (!currentMove) return undefined;
    return { square: currentMove.to as Square, classification: currentMove.classification };
  }, [currentMove]);

  const graphData = useMemo(() => {
    if (!analysis) return [];
    return analysis.moves.map((move, i) => {
      const score = analysis.evaluations[i] || 0;
      return {
        moveNumber: i + 1,
        moveNotation: `${move.moveNumber}${move.isWhite ? '.' : '...'} ${move.notation}`,
        score: Math.max(-500, Math.min(500, score)),
        rawScore: score, isWhite: move.isWhite, classification: move.classification,
      };
    });
  }, [analysis]);

  const goToStart = useCallback(() => { setCurrentMoveIndex(-1); setExplorationPosition(null); setExplorationBestMove(null); setMoveFeedback(null); }, []);
  const goBack = useCallback(() => { setCurrentMoveIndex(prev => Math.max(-1, prev - 1)); setExplorationPosition(null); setExplorationBestMove(null); setMoveFeedback(null); }, []);
  const goForward = useCallback(() => { if (analysis) { setCurrentMoveIndex(prev => Math.min(analysis.moves.length - 1, prev + 1)); setExplorationPosition(null); setExplorationBestMove(null); setMoveFeedback(null); } }, [analysis]);
  const goToEnd = useCallback(() => { if (analysis) { setCurrentMoveIndex(analysis.moves.length - 1); setExplorationPosition(null); setExplorationBestMove(null); setMoveFeedback(null); } }, [analysis]);
  const goToMove = useCallback((index: number) => { setCurrentMoveIndex(index); setExplorationPosition(null); setExplorationBestMove(null); setMoveFeedback(null); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goBack();
      if (e.key === 'ArrowRight') goForward();
      if (e.key === 'ArrowUp' || e.key === 'Home') goToStart();
      if (e.key === 'ArrowDown' || e.key === 'End') goToEnd();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, goForward, goToStart, goToEnd]);

  const handleUserMove = useCallback(async (from: Square, to: Square, promotion?: string) => {
    if (!interactiveMode || !analysis) return { isValid: false };
    
    setIsAnalyzingMove(true);
    setMoveFeedback(null);
    
    try {
      const fen = explorationPosition || currentPosition;
      const chess = new Chess(fen);
      
      let moveResult;
      try {
        moveResult = chess.move({ from, to, promotion: promotion || undefined });
      } catch {
        setIsAnalyzingMove(false);
        return { isValid: false };
      }
      
      if (!moveResult) {
        setIsAnalyzingMove(false);
        return { isValid: false };
      }
      
      const expectedMove = analysis.moves[currentMoveIndex + 1];
      const isGameMove = expectedMove && expectedMove.from === from && expectedMove.to === to;
      
      if (isGameMove) {
        setExplorationPosition(chess.fen());
        // Set the best move for the next position from game history
        const nextMove = analysis.moves[currentMoveIndex + 2];
        if (nextMove?.bestMove) {
          const uci = nextMove.bestMove.uci;
          if (uci.length >= 4) {
            setExplorationBestMove({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
          }
        } else {
          setExplorationBestMove(null);
        }
        setMoveFeedback({
          classification: expectedMove.classification,
          evalBefore: expectedMove.evalBefore.score * (expectedMove.isWhite ? 1 : -1),
          evalAfter: expectedMove.evalAfter.score * (expectedMove.isWhite ? -1 : 1),
          bestMove: expectedMove.bestMove?.san,
          isGameMove: true,
        });
        setIsAnalyzingMove(false);
        return { isValid: true, classification: expectedMove.classification, isGameMove: true };
      }
      
      if (!engineRef.current) {
        engineRef.current = new StockfishEngine();
        await engineRef.current.init();
      }
      
      const engine = engineRef.current;
      
      let evalBefore = 0;
      if (currentMoveIndex >= 0 && analysis.moves[currentMoveIndex]) {
        const prevMove = analysis.moves[currentMoveIndex];
        evalBefore = prevMove.evalAfter.score * (prevMove.isWhite ? -1 : 1);
      } else if (currentMoveIndex === -1 && analysis.moves[0]) {
        evalBefore = analysis.moves[0].evalBefore.score;
      }
      
      const evalAfterResult = await engine.analyzePosition(chess.fen(), { depth: 12 });
      const isWhiteMove = chess.turn() === 'b';
      const evalAfter = evalAfterResult.score * (isWhiteMove ? -1 : 1);
      
      const cpLoss = Math.max(0, isWhiteMove ? (evalBefore - evalAfter) : (evalAfter - evalBefore));
      
      const currentPosAnalysis = await engine.analyzePosition(fen, { depth: 12 });
      const bestMoveSan = currentPosAnalysis.bestMoveSan;
      
      let classification: MoveClassification;
      if (bestMoveSan && moveResult.san === bestMoveSan) {
        classification = 'best';
      } else {
        classification = classifyByLoss(cpLoss);
      }
      
      // Also get the best move for the NEW position (after user's move)
      const newPosAnalysis = await engine.analyzePosition(chess.fen(), { depth: 12 });
      if (newPosAnalysis.bestMove && newPosAnalysis.bestMove.length >= 4) {
        setExplorationBestMove({
          from: newPosAnalysis.bestMove.slice(0, 2) as Square,
          to: newPosAnalysis.bestMove.slice(2, 4) as Square,
        });
      } else {
        setExplorationBestMove(null);
      }
      
      setExplorationPosition(chess.fen());
      setMoveFeedback({
        classification,
        evalBefore: evalBefore,
        evalAfter: evalAfter,
        bestMove: bestMoveSan,
        isGameMove: false,
      });
      
      setIsAnalyzingMove(false);
      return { isValid: true, classification, isGameMove: false };
      
    } catch (err) {
      console.error('Error analyzing move:', err);
      setIsAnalyzingMove(false);
      return { isValid: false };
    }
  }, [interactiveMode, analysis, currentMoveIndex, currentPosition, explorationPosition]);

  const toggleInteractiveMode = useCallback(() => {
    setInteractiveMode(prev => !prev);
    setExplorationPosition(null);
    setExplorationBestMove(null);
    setMoveFeedback(null);
  }, []);

  const returnToGamePosition = useCallback(() => {
    setExplorationPosition(null);
    setExplorationBestMove(null);
    setMoveFeedback(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div><p className="text-gray-400">Loading analysis...</p></div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center"><div className="text-red-500 text-6xl mb-4">⚠</div><p className="text-xl mb-2">Analysis Error</p><p className="text-gray-400 mb-4">{error || 'Failed to load analysis'}</p></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/games')} className="p-1.5 hover:bg-gray-800 rounded"><ChevronLeft size={18} /></button>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{gameData?.white || 'White'} vs {gameData?.black || 'Black'}</h1>
            <p className="text-xs text-gray-400">{gameData?.date} • {gameData?.timeClass}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={toggleInteractiveMode} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${interactiveMode ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {interactiveMode ? <Play size={14} /> : <Pause size={14} />}
            <span className="hidden sm:inline">{interactiveMode ? 'Interactive' : 'View'}</span>
          </button>
          <button onClick={() => setShowBestMove(!showBestMove)} className={`p-1.5 rounded-lg transition-colors ${showBestMove ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`} title="Show best move">
            {showBestMove ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')} className="p-1.5 hover:bg-gray-800 rounded-lg" title="Flip board"><RotateCcw size={16} /></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left sidebar - Moves list (hidden on mobile, shown on lg) */}
        <aside className="hidden lg:flex w-56 xl:w-64 border-r border-gray-800 bg-gray-900 flex-col flex-shrink-0">
          <div className="p-2 border-b border-gray-800 font-semibold text-sm flex items-center justify-between">
            <span>Moves</span>
            <span className="text-xs text-gray-500">{analysis.moves.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin">
            <AnalysisMoveList moves={analysis.moves} selectedIndex={currentMoveIndex} onMoveClick={goToMove} />
          </div>
        </aside>

        {/* Center - Chessboard and controls */}
        <section className="flex-1 flex flex-col items-center justify-center bg-gray-950 p-2 sm:p-4 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-2">
            {/* Top player info */}
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${orientation === 'white' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}>
                  {orientation === 'white' ? 'B' : 'W'}
                </div>
                <span className="font-medium text-sm truncate max-w-[150px]">
                  {orientation === 'white' ? (gameData?.black || 'Black') : (gameData?.white || 'White')}
                </span>
                <span className="text-gray-500 text-xs">({orientation === 'white' ? (gameData?.blackRating || '?') : (gameData?.whiteRating || '?')})</span>
              </div>
              <div className={`text-xs font-semibold ${getAccuracyColor(orientation === 'white' ? analysis.blackAccuracy : analysis.whiteAccuracy)}`}>
                {(orientation === 'white' ? analysis.blackAccuracy : analysis.whiteAccuracy).toFixed(1)}%
              </div>
            </div>

            {/* Board with eval bar side by side */}
            <div className="flex gap-2">
              {/* Eval bar - left side, same height as board */}
              <div className="hidden sm:block flex-shrink-0">
                <EvaluationBar score={currentEval.score} mate={currentEval.mate} height={400} showLabel={true} />
              </div>
              
              {/* Chessboard */}
              <div className="relative">
                <InteractiveChessboard 
                  position={currentPosition} 
                  orientation={orientation} 
                  interactive={interactiveMode}
                  onUserMove={handleUserMove}
                  highlightSquares={currentMove && !explorationPosition ? [currentMove.from as Square, currentMove.to as Square] : []} 
                  moveIndicator={!explorationPosition ? moveIndicator : undefined}
                  bestMoveArrow={explorationPosition ? explorationBestMove : bestMoveArrow}
                  showBestMove={showBestMove}
                  boardWidth={400}
                />
                {isAnalyzingMove && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="bg-gray-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Analyzing...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Feedback and exploration banner - compact inline design */}
            {(moveFeedback || explorationPosition) && (
              <div className="flex flex-col gap-1.5">
                {moveFeedback && (
                  <div className="bg-gray-800 rounded-lg p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${classificationConfig[moveFeedback.classification].bgColor} ${classificationConfig[moveFeedback.classification].color}`}>
                        {classificationConfig[moveFeedback.classification].label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {(moveFeedback.evalBefore / 100).toFixed(1)} → {(moveFeedback.evalAfter / 100).toFixed(1)}
                      </span>
                      {moveFeedback.bestMove && moveFeedback.classification !== 'best' && (
                        <span className="text-xs text-green-400">Best: {moveFeedback.bestMove}</span>
                      )}
                    </div>
                    <button onClick={() => setMoveFeedback(null)} className="text-gray-500 hover:text-white p-0.5">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {explorationPosition && (
                  <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-1.5">
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <Info size={14} />
                      <span className="text-xs">Exploring variation</span>
                    </div>
                    <button onClick={returnToGamePosition} className="text-xs text-yellow-400 hover:text-yellow-300 underline">
                      Return to game
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom player info */}
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${orientation === 'white' ? 'bg-white text-gray-900' : 'bg-gray-700 text-white'}`}>
                  {orientation === 'white' ? 'W' : 'B'}
                </div>
                <span className="font-medium text-sm truncate max-w-[150px]">
                  {orientation === 'white' ? (gameData?.white || 'White') : (gameData?.black || 'Black')}
                </span>
                <span className="text-gray-500 text-xs">({orientation === 'white' ? (gameData?.whiteRating || '?') : (gameData?.blackRating || '?')})</span>
              </div>
              <div className={`text-xs font-semibold ${getAccuracyColor(orientation === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy)}`}>
                {(orientation === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy).toFixed(1)}%
              </div>
            </div>

            {/* Navigation controls */}
            <div className="flex items-center justify-center gap-0.5 bg-gray-900 p-1.5 rounded-lg">
              <button onClick={goToStart} disabled={currentMoveIndex === -1} className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"><ChevronsLeft size={18} /></button>
              <button onClick={goBack} disabled={currentMoveIndex === -1} className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
              <div className="px-2 py-0.5 min-w-[80px] text-center text-sm">
                {currentMoveIndex === -1 ? <span className="text-gray-500">Start</span> : currentMove ? <span className="font-mono">{currentMove.moveNumber}{currentMove.isWhite ? '.' : '...'} {currentMove.notation}</span> : null}
              </div>
              <button onClick={goForward} disabled={currentMoveIndex === analysis.moves.length - 1} className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
              <button onClick={goToEnd} disabled={currentMoveIndex === analysis.moves.length - 1} className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"><ChevronsRight size={18} /></button>
            </div>

            {interactiveMode && (
              <div className="text-center text-xs text-gray-400 bg-gray-800/50 rounded py-1.5">
                <span className="text-green-400">●</span> Drag pieces to try moves
              </div>
            )}
          </div>
        </section>

        {/* Right sidebar - Analysis details */}
        <aside className="hidden lg:flex w-72 xl:w-80 border-l border-gray-800 bg-gray-900 flex-col flex-shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Current evaluation */}
            <div className="p-3 border-b border-gray-800">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1.5">Evaluation</h3>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${currentEval.score > 50 ? 'text-white' : currentEval.score < -50 ? 'text-gray-400' : 'text-gray-300'}`}>
                  {formatEval(currentEval.score, currentEval.mate)}
                </span>
                <span className="text-xs text-gray-500">
                  {currentEval.mate !== undefined 
                    ? (currentEval.mate > 0 ? 'White mates' : 'Black mates') 
                    : currentEval.score > 100 
                      ? <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> White better</span> 
                      : currentEval.score < -100 
                        ? <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400" /> Black better</span> 
                        : <span className="flex items-center gap-1"><Minus className="w-3 h-3" /> Equal</span>}
                </span>
              </div>
            </div>

            {/* Current move analysis */}
            {currentMove && (
              <div className="p-3 border-b border-gray-800">
                <button onClick={() => setShowMoveDetails(!showMoveDetails)} className="w-full flex items-center justify-between text-left">
                  <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Move Analysis</h3>
                  {showMoveDetails ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                </button>
                {showMoveDetails && (
                  <div className="mt-2 space-y-2">
                    <div className={`p-2 rounded-lg ${classificationConfig[currentMove.classification].bgColor}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`${classificationConfig[currentMove.classification].color}`}>{classificationConfig[currentMove.classification].icon}</span>
                        <span className={`font-medium text-sm ${classificationConfig[currentMove.classification].color}`}>{classificationConfig[currentMove.classification].label}</span>
                      </div>
                      <div className="text-base font-bold">{currentMove.moveNumber}{currentMove.isWhite ? '.' : '...'} {currentMove.notation}</div>
                      {currentMove.centipawnLoss > 0 && currentMove.classification !== 'book' && currentMove.classification !== 'forced' && (
                        <div className="text-xs text-gray-400 mt-0.5">-{(currentMove.centipawnLoss / 100).toFixed(2)} pawns</div>
                      )}
                    </div>
                    {currentMove.bestMove && currentMove.notation !== currentMove.bestMove.san && (
                      <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-1.5 mb-0.5"><Target className="w-3 h-3 text-green-400" /><span className="text-xs text-green-400">Best move</span></div>
                        <div className="text-sm font-bold text-green-300">{currentMove.moveNumber}{currentMove.isWhite ? '.' : '...'} {currentMove.bestMove.san}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Accuracy bars */}
            <div className="p-3 border-b border-gray-800">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">Accuracy</h3>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white"></div>{gameData?.white || 'White'}</span>
                    <span className={`font-bold ${getAccuracyColor(analysis.whiteAccuracy)}`}>{analysis.whiteAccuracy.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${getAccuracyBgColor(analysis.whiteAccuracy)}`} style={{ width: `${analysis.whiteAccuracy}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-600"></div>{gameData?.black || 'Black'}</span>
                    <span className={`font-bold ${getAccuracyColor(analysis.blackAccuracy)}`}>{analysis.blackAccuracy.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${getAccuracyBgColor(analysis.blackAccuracy)}`} style={{ width: `${analysis.blackAccuracy}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Move statistics */}
            <div className="p-3">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">Move Stats</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="text-gray-400 mb-1 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white"></div>White</div>
                  {(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as MoveClassification[]).map(cls => (
                    analysis.whiteMoveStats[cls] > 0 && (
                      <div key={cls} className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 ${classificationConfig[cls].color}`}>
                          {classificationConfig[cls].icon}
                          <span className="hidden xl:inline">{classificationConfig[cls].label}</span>
                        </span>
                        <span className="font-mono">{analysis.whiteMoveStats[cls]}</span>
                      </div>
                    )
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-gray-400 mb-1 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>Black</div>
                  {(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as MoveClassification[]).map(cls => (
                    analysis.blackMoveStats[cls] > 0 && (
                      <div key={cls} className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 ${classificationConfig[cls].color}`}>
                          {classificationConfig[cls].icon}
                          <span className="hidden xl:inline">{classificationConfig[cls].label}</span>
                        </span>
                        <span className="font-mono">{analysis.blackMoveStats[cls]}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-gray-800 text-xs text-gray-500">
                <p>Depth {analysis.analysisDepth} • {new Date(analysis.analyzedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom evaluation graph */}
      <div className="h-28 bg-gray-900 border-t border-gray-800 px-4 py-2 hidden lg:block flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={graphData} onClick={(data) => { if (data && data.activeTooltipIndex !== undefined) { setCurrentMoveIndex(data.activeTooltipIndex); setExplorationPosition(null); setExplorationBestMove(null); setMoveFeedback(null); } }}>
            <defs>
              <linearGradient id="whiteGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} /><stop offset="100%" stopColor="#ffffff" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="moveNumber" stroke="#6B7280" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis hide domain={[-500, 500]} />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#F3F4F6', padding: '4px 8px', fontSize: '12px' }} labelFormatter={(value, payload) => { if (payload && payload[0]) return payload[0].payload.moveNotation; return `Move ${value}`; }} formatter={(value: number) => [formatEval(value * 100), 'Eval']} />
            <ReferenceLine y={0} stroke="#4B5563" strokeWidth={1.5} />
            <Area type="monotone" dataKey="score" stroke="none" fill="url(#whiteGradient)" fillOpacity={1} />
            <Line type="monotone" dataKey="score" stroke="#60A5FA" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#fff', stroke: '#60A5FA', strokeWidth: 2 }} />
            {currentMoveIndex >= 0 && <ReferenceLine x={currentMoveIndex + 1} stroke="#FBBF24" strokeWidth={1.5} strokeDasharray="4 4" />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
