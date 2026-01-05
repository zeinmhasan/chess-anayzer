import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chess Game Analysis - Free Stockfish Analysis",
  description:
    "Free chess game analysis tool powered by Stockfish 16. Analyze your Chess.com games, find mistakes, and improve your rating.",
  keywords: ["chess", "analysis", "stockfish", "chess.com", "game review", "blunder check"],
  openGraph: {
    title: "Chess Game Analysis",
    description: "Free chess game analysis powered by Stockfish 16",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
