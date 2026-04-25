import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import MazeLogo from '../../components/MazeLogo';

const navItems = [
  { label: 'Product', href: '#product' },
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/60 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-sky-500/20 shadow-lg shadow-emerald-500/10">
            <MazeLogo className="h-6 w-6" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Maze<span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors duration-200 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden text-sm font-semibold text-zinc-300 transition-colors duration-200 hover:text-white sm:inline-flex">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 sm:inline-flex"
          >
            Start Free
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-black/90 backdrop-blur-xl md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-5 py-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <div className="flex gap-3 pt-3">
              <Link to="/login" className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white">
                Sign in
              </Link>
              <Link to="/signup" className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:shadow-emerald-500/30">
                Start Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
