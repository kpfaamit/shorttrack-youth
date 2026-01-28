import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { useData } from './hooks/useData';
import { useFilters } from './hooks/useFilters';
import RacePrep from './pages/RacePrep';
import Scouting from './pages/Scouting';
import Progress from './pages/Progress';
import Leaderboards from './pages/Leaderboards';
import Analytics from './pages/Analytics';
import ModelsPage from './pages/ModelsPage';
import About from './pages/About';

export default function App() {
  const data = useData();
  const { filters, setCategory } = useFilters();

  if (data.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">⛸️</div>
          <p className="text-gray-500 font-semibold">Loading data...</p>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-600 font-semibold">Failed to load data</p>
          <p className="text-gray-500 text-sm mt-1">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar category={filters.category} onCategoryChange={setCategory} />

        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route
              path="/"
              element={
                <RacePrep
                  skaters={data.skaters}
                  models={data.models}
                  category={filters.category}
                />
              }
            />
            <Route
              path="/scouting"
              element={
                <Scouting
                  skaters={data.skaters}
                  category={filters.category}
                />
              }
            />
            <Route
              path="/progress"
              element={
                <Progress
                  skaters={data.skaters}
                  category={filters.category}
                />
              }
            />
            <Route
              path="/leaderboards"
              element={
                <Leaderboards
                  skaters={data.skaters}
                  category={filters.category}
                />
              }
            />
            <Route
              path="/analytics"
              element={
                <Analytics
                  skaters={data.skaters}
                  heats={data.heats}
                  passes={data.passes}
                  crashes={data.crashes}
                  incidents={data.incidents}
                  category={filters.category}
                />
              }
            />
            <Route
              path="/models"
              element={<ModelsPage models={data.models} />}
            />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>

        <footer className="border-t border-gray-200 bg-white mt-12 py-6 text-center text-gray-400 text-sm">
          <p>Data: ISU World Tour & Junior World Cup 2025-2026</p>
          <p className="mt-1">Built by Daniel Chen</p>
        </footer>
      </div>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
