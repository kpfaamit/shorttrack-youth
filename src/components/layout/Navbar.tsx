import { NavLink } from 'react-router-dom';
import type { Category } from '../../types/data';

interface NavbarProps {
  category: Category | 'all';
  onCategoryChange: (c: Category | 'all') => void;
}

const categories: { value: Category; label: string }[] = [
  { value: 'senior', label: 'Senior' },
  { value: 'junior', label: 'Junior' },
  { value: 'youth_ja', label: 'Youth JA' },
  { value: 'youth_jb', label: 'Youth JB' },
  { value: 'youth_jc', label: 'Youth JC' },
  { value: 'youth_jd', label: 'Youth JD' },
  { value: 'youth_je', label: 'Youth JE' },
  { value: 'youth_jf', label: 'Youth JF' },
  { value: 'youth_jg', label: 'Youth JG' },
];

const navLink = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-white/20 text-white'
      : 'text-white/70 hover:text-white hover:bg-white/10'
  }`;

export default function Navbar({ category, onCategoryChange }: NavbarProps) {
  return (
    <header className="bg-[#2646A7] sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 text-white font-extrabold text-lg">
            ⛸️ ShortTrack Analytics
          </NavLink>

          {/* Nav groups */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Compete */}
            <div className="flex items-center gap-0.5 mr-4">
              <span className="text-white/40 text-xs font-bold uppercase tracking-wider mr-2">Compete</span>
              <NavLink to="/" end className={navLink}>🎯 Race Prep</NavLink>
              <NavLink to="/scouting" className={navLink}>🔍 Scouting</NavLink>
              <NavLink to="/progress" className={navLink}>📈 Progress</NavLink>
            </div>
            {/* Analyze */}
            <div className="flex items-center gap-0.5">
              <span className="text-white/40 text-xs font-bold uppercase tracking-wider mr-2">Analyze</span>
              <NavLink to="/leaderboards" className={navLink}>🏆 Leaders</NavLink>
              <NavLink to="/analytics" className={navLink}>📊 Analytics</NavLink>
              <NavLink to="/models" className={navLink}>🤖 Models</NavLink>
              <NavLink to="/about" className={navLink}>ℹ️ About</NavLink>
            </div>
          </nav>

          {/* Category selector */}
          <select
            value={category}
            onChange={e => onCategoryChange(e.target.value as Category)}
            className="bg-white/15 text-white border border-white/25 rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            {categories.map(c => (
              <option key={c.value} value={c.value} className="text-gray-900">{c.label}</option>
            ))}
          </select>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex flex-wrap gap-1 pb-3">
          <NavLink to="/" end className={navLink}>🎯 Race Prep</NavLink>
          <NavLink to="/scouting" className={navLink}>🔍 Scouting</NavLink>
          <NavLink to="/progress" className={navLink}>📈 Progress</NavLink>
          <NavLink to="/leaderboards" className={navLink}>🏆 Leaders</NavLink>
          <NavLink to="/analytics" className={navLink}>📊 Analytics</NavLink>
          <NavLink to="/models" className={navLink}>🤖 Models</NavLink>
          <NavLink to="/about" className={navLink}>ℹ️ About</NavLink>
        </nav>
      </div>
    </header>
  );
}
