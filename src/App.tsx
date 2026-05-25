import { useState, useEffect } from 'react';
import { LayoutList, Columns3, Settings, HardDrive, AlertCircle, LayoutGrid } from 'lucide-react';
import { Toaster } from 'sonner';
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

  const theme = store.state.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle('dark', dark);

    if (theme === 'dark') { apply(true); return; }
    if (theme === 'light') { apply(false); return; }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [theme]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Jason" className="w-7 h-7 object-contain" />
            <span className="font-bold text-gray-900 dark:text-white text-base tracking-tight">Jason</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
              {totalGoals} goal{totalGoals !== 1 ? 's' : ''} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Storage status */}
            {serverOnline !== null && (
              <span
                className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                  serverOnline
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
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
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === 'list'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <LayoutList size={14} /> List<kbd className="ml-1 text-[9px] opacity-40 font-mono">1</kbd>
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === 'kanban'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Columns3 size={14} /> Kanban<kbd className="ml-1 text-[9px] opacity-40 font-mono">2</kbd>
              </button>
              <button
                onClick={() => setView('blocks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === 'blocks'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <LayoutGrid size={14} /> Task Blocks<kbd className="ml-1 text-[9px] opacity-40 font-mono">3</kbd>
              </button>
            </div>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 w-full px-6 py-6 ${view !== 'list' ? 'overflow-hidden flex flex-col' : ''}`}>
        {view === 'list' && <ListView store={store} onOpenDetail={setDetailItem} />}
        {view === 'kanban' && (
          <div className="flex-1 overflow-hidden">
            <KanbanView store={store} onOpenDetail={setDetailItem} />
          </div>
        )}
        {view === 'blocks' && (
          <div className="flex-1 overflow-auto">
            <BlockView store={store} onOpenDetail={setDetailItem} />
          </div>
        )}
      </main>

      {settingsOpen && <SettingsPanel store={store} onClose={() => setSettingsOpen(false)} />}
      {detailItem && <DetailPanel item={detailItem} store={store} onClose={() => setDetailItem(null)} onNavigate={setDetailItem} />}
      <Toaster position="bottom-right" />
    </div>
  );
}
