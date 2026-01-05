'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, TrendingUp, Zap, BookOpen, ArrowRight } from 'lucide-react';

export default function Home() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      router.push(`/games?username=${encodeURIComponent(username.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 z-0" />
        
        <div className="container mx-auto px-4 py-24 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Master Your Chess Game
            </h1>
            <p className="text-xl text-gray-300 mb-10 leading-relaxed">
              Analyze your Chess.com games with advanced Stockfish evaluation. 
              Uncover your mistakes, find brilliant moves, and improve your rating.
            </p>

            {/* Search Box */}
            <div className="bg-gray-800/50 p-2 rounded-xl backdrop-blur-sm border border-gray-700 shadow-2xl max-w-xl mx-auto">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter Chess.com Username"
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    suppressHydrationWarning
                  />
                </div>
                <button
                  type="submit"
                  disabled={!username.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyze <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Try: <button onClick={() => setUsername('MagnusCarlsen')} className="text-blue-400 hover:underline">MagnusCarlsen</button>, <button onClick={() => setUsername('Hikaru')} className="text-blue-400 hover:underline">Hikaru</button>
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <FeatureCard 
            icon={<TrendingUp className="w-8 h-8 text-green-400" />}
            title="Performance Analysis"
            description="Visualize your game performance with evaluation graphs and accuracy scores."
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-yellow-400" />}
            title="Blunder Check"
            description="Instantly identify mistakes and blunders to stop making them in future games."
          />
          <FeatureCard 
            icon={<BookOpen className="w-8 h-8 text-purple-400" />}
            title="Opening Insights"
            description="Learn which openings work best for you and where you deviate from theory."
          />
        </div>

        {/* Example Screenshots Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">See it in Action</h2>
          <div className="relative max-w-5xl mx-auto">
            {/* Main Dashboard Screenshot Placeholder */}
            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700 aspect-video relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />
              
              {/* Mock UI for Screenshot */}
              <div className="absolute inset-0 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-gray-400 text-sm">Analysis Dashboard</div>
                </div>
                <div className="flex-1 flex gap-4">
                  <div className="w-64 bg-gray-700/30 rounded-lg hidden md:block p-4 space-y-2">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-8 bg-gray-700/50 rounded w-full" />
                    ))}
                  </div>
                  <div className="flex-1 bg-gray-700/30 rounded-lg flex items-center justify-center relative">
                    <div className="w-64 h-64 bg-gray-600/20 rounded grid grid-cols-8 grid-rows-8 border border-gray-600/30">
                      {/* Chessboard Pattern */}
                      {Array.from({ length: 64 }).map((_, i) => {
                        const row = Math.floor(i / 8);
                        const col = i % 8;
                        const isBlack = (row + col) % 2 === 1;
                        return <div key={i} className={isBlack ? 'bg-gray-600/30' : 'bg-transparent'} />;
                      })}
                    </div>
                    {/* Evaluation Bar Mock */}
                    <div className="absolute left-4 top-4 bottom-4 w-2 bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-1/2 bg-white w-full" />
                    </div>
                  </div>
                  <div className="w-72 bg-gray-700/30 rounded-lg hidden lg:block p-4">
                    <div className="h-32 bg-gray-700/50 rounded mb-4" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-700/50 rounded w-3/4" />
                      <div className="h-4 bg-gray-700/50 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-8 text-left">
                <h3 className="text-2xl font-bold mb-2">Deep Analysis</h3>
                <p className="text-gray-300">Review every move with Stockfish 16 engine running directly in your browser.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Chess Analyzer. Not affiliated with Chess.com.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 p-6 rounded-xl hover:bg-gray-800/50 transition-colors">
      <div className="mb-4 bg-gray-900/50 w-16 h-16 rounded-lg flex items-center justify-center border border-gray-700">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
