import { Link } from 'react-router-dom';
import MazeLogo from '../../components/MazeLogo';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <Link to="/" className="flex items-center gap-3 text-white transition-opacity hover:opacity-80">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-sky-500/20">
            <MazeLogo className="h-5 w-5" />
          </span>
          <span className="font-bold">
            Maze<span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">AI</span>
          </span>
        </Link>
        <div className="flex flex-wrap gap-6">
          <a href="#product" className="transition-colors duration-200 hover:text-white">Product</a>
          <a href="#features" className="transition-colors duration-200 hover:text-white">Features</a>
          <a href="#how-it-works" className="transition-colors duration-200 hover:text-white">How it works</a>
        </div>
        <p className="text-zinc-600">© {new Date().getFullYear()} MazeAI. All rights reserved.</p>
      </div>
    </footer>
  );
}
