import { useState, useEffect } from 'react';
import { LayoutList, Columns3, Settings, Flag, HardDrive, AlertCircle, LayoutGrid } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { ListView } from './components/ListView';
import { KanbanView } from './components/KanbanView';
import { BlockView } from './components/BlockView';
import { SettingsPanel } from './components/SettingsPanel';
import { DetailPanel } from './components/DetailPanel';
import type { DetailItem } from './types';

type View = 'list' | 'kanban' | 'blocks';

function useServerStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () =>
      fetch('/api/data', { method: 'GET', signal: AbortSignal.timeout(1500) })
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);
  return online;
}

export default function App() {
  const store = useAppStore();
  const serverOnline = useServerStatus();
  const [view, setView] = useState<View>('list');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '1') setView('list');
      else if (e.key === '2') setView('kanban');
      else if (e.key === '3') setView('blocks');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const totalGoals = Object.keys(store.state.goals).length;
  const totalTasks = Object.keys(store.state.tasks).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Flag size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base tracking-tight">Jason</span>
            <span className="text-xs text-gray-400 hidden sm:block">
              {totalGoals} goal{totalGoals !== 1 ? 's' : ''} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Storage status */}
            {serverOnline !== null && (
              <span
                className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                  serverOnline
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
                title={serverOnline ? 'Saving to data.json on disk' : 'File server offline — saving to browser only'}
              >
                {serverOnline
                  ? <><HardDrive size={11} /> Saved to disk</>
                  : <><AlertCircle size={11} /> Browser only</>
                }
              </span>
            )}

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutList size={14} /> List
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === 'kanban'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Columns3 size={14} /> Kanban
              </button>
              <button
                onClick={() => setView('blocks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === 'blocks'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid size={14} /> Task Blocks
              </button>
            </div>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 max-w-7xl mx-auto w-full px-6 py-6 ${view !== 'list' ? 'overflow-hidden flex flex-col' : ''}`}>
        {view === 'list' && <ListView store={store} onOpenDetail={setDetailItem} />}
        {view === 'kanban' && (
          <div className="flex-1 overflow-hidden">
            <KanbanView store={store} />
          </div>
        )}
        {view === 'blocks' && (
          <div className="flex-1 overflow-auto">
            <BlockView store={store} onOpenDetail={setDetailItem} />
          </div>
        )}
      </main>

      {settingsOpen && <SettingsPanel store={store} onClose={() => setSettingsOpen(false)} />}
      {detailItem && <DetailPanel item={detailItem} store={store} onClose={() => setDetailItem(null)} />}
    </div>
  );
}
